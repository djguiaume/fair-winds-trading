import perksFile from '../data/perks.json';
import { BUILDINGS, type HomeState, buildingById, islandHome, ownedIslands } from './home';

/**
 * Building perks as data (decision 0136): each perk in `src/data/perks.json` changes one game
 * number, its hook, by multiplying or adding, anywhere or only while moored at its island.
 * Buildings (`src/data/buildings.json`) list their perks by id. A hook is the one place the game
 * reads that number through `applyPerks`; the hooks are listed here and described in the perks
 * file, and a new perk on an existing hook is data only.
 */

export const HOOKS = [
  'repairPrice',
  'sailUpgradePrice',
  'shipPrice',
  'helpReward',
  'discoverRange',
  'hullDamage',
  'storageRoom',
  'forecastSec',
] as const;
export type HookId = (typeof HOOKS)[number];

export interface PerkDef {
  id: string;
  hook: HookId;
  /** The number times this. */
  multiply?: number;
  /** Plus this (after multiplying). */
  add?: number;
  /** `island`: only while moored at the island it stands on; default anywhere. */
  where?: 'anywhere' | 'island';
}

export const PERKS: PerkDef[] = perksFile.perks as PerkDef[];
export const perkById = (id: string) => PERKS.find((p) => p.id === id);

/** A building's perks, in its file's order. */
export function buildingPerks(buildingId: string): PerkDef[] {
  return (buildingById(buildingId)?.perks ?? []).flatMap((id) => perkById(id) ?? []);
}

/**
 * The perks working now: those of every building on the captain's islands, and those that work
 * at their island only on the island she is moored at. A perk counts once, however many of its
 * buildings stand: the same building on two islands does not add up.
 */
export function activePerks(home: HomeState | undefined): PerkDef[] {
  const out = new Map<string, PerkDef>();
  for (const island of ownedIslands(home))
    for (const b of Object.values(islandHome(home, island).built))
      for (const perk of buildingPerks(b))
        if (perk.where !== 'island' || home?.docked === island) out.set(perk.id, perk);
  return [...out.values()];
}

/** A game number with the perks on its hook: times every `multiply`, plus every `add`. */
export function applyPerks(home: HomeState | undefined, hook: HookId, base: number): number {
  let factor = 1,
    plus = 0;
  for (const p of activePerks(home)) {
    if (p.hook !== hook) continue;
    factor *= p.multiply ?? 1;
    plus += p.add ?? 0;
  }
  return base * factor + plus;
}

/** Does a working perk change this hook (the Repair button at home asks about `repairPrice`)? */
export function hasPerk(home: HomeState | undefined, hook: HookId, atIsland = false): boolean {
  return activePerks(home).some((p) => p.hook === hook && (!atIsland || p.where === 'island'));
}

/** Problems with the perks and buildings files, as readable lines (none: they are sound). */
export function checkPerks(): string[] {
  const out: string[] = [];
  const hooks = Object.keys(perksFile.hooks);
  for (const h of HOOKS) if (!hooks.includes(h)) out.push(`perks.json: hook "${h}" not described`);
  for (const h of hooks)
    if (!(HOOKS as readonly string[]).includes(h))
      out.push(`perks.json: no hook "${h}" in the game`);
  const ids = new Set<string>();
  for (const p of PERKS) {
    if (ids.has(p.id)) out.push(`perks.json: perk "${p.id}" twice`);
    ids.add(p.id);
    if (!(HOOKS as readonly string[]).includes(p.hook))
      out.push(`perk ${p.id}: no hook "${p.hook}"`);
    if (p.multiply === undefined && p.add === undefined)
      out.push(`perk ${p.id}: needs "multiply" or "add"`);
    for (const k of ['multiply', 'add'] as const)
      if (p[k] !== undefined && !(typeof p[k] === 'number' && Number.isFinite(p[k])))
        out.push(`perk ${p.id}: "${k}" needs a number`);
    if (p.where !== undefined && p.where !== 'anywhere' && p.where !== 'island')
      out.push(`perk ${p.id}: "where" is "anywhere" or "island"`);
  }
  for (const b of BUILDINGS) {
    if (!b.perks?.length) out.push(`building ${b.id}: no perks`);
    for (const id of b.perks ?? []) if (!ids.has(id)) out.push(`building ${b.id}: no perk "${id}"`);
  }
  return out;
}
