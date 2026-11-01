import { SHIP_CLASSES } from './ship';
import { giveHomeIsland, homeSpots, offerHomeSpot, resolveSpot } from './home';
import { foundSite } from './founding';
import type { MapDef } from './map';
import { MAX_SETTLEMENT_LEVEL } from './settlement';
import { giveShip } from './seriesPrizes';
import type { TradeState } from './trade';
import { hasVolcano } from '../data/islands';
import { isCount, isVarRef, resolvePort, type CheckScope } from './questLibrary';

/* What a quest, a step or a choice pays (decision 0125): the reward kinds, their checks and payment. */

/** What a quest, a step or a choice pays. */
export interface QuestReward {
  gold?: number;
  /** Port → orders' worth of standing with its shipwright (decision 0048). */
  standing?: Record<string, number>;
  /** Ports put on the chart. */
  discover?: string[];
  /** Ports that go up one town level at once (decision 0120's "step up"). */
  levelUp?: string[];
  /**
   * Empty islands founded (decision 0157): ports marked `site` in the map open at their start
   * level and go on the chart.
   */
  found?: string[];
  /**
   * An island becomes the captain's: `true` for the map's home island (the prologue's reward,
   * decision 0126), or the id of another island with build spots (decision 0128).
   */
  homeIsland?: boolean | string;
  /**
   * Arc spots offered: the captain picks one building of the pair there (0126). `spot-2` is on
   * the home island, `<island>:spot-2` on another one (0128).
   */
  homeSpot?: string[];
  /**
   * Volcanoes that erupt (decision 0178): islands whose file has a peak with a crater. Spectacle
   * only: it plays whatever the Eruptions switch says, once the boat is in sight.
   */
  erupt?: string[];
  /**
   * A standing order's pay (decision 0214): the step's goal lands goods at a port, and they are
   * paid and grow the town like a help order there, on the voyage's level.
   */
  order?: true;
  /** A ship class given at stock levels (decision 0228's prize, as a quest reward; 0227). */
  ship?: string;
}

export function rewardPorts(r: QuestReward | undefined): string[] {
  return [
    ...Object.keys(r?.standing ?? {}),
    ...(r?.discover ?? []),
    ...(r?.levelUp ?? []),
    ...(r?.found ?? []),
  ].filter((p) => p !== 'home' && !isVarRef(p));
}

/**
 * Problems with a reward. The two-building choice of 0120 is made on the home island itself
 * (decision 0126): a reward offers the spot (`homeSpot`), the captain picks there.
 */
export function checkReward(r: unknown, scope: CheckScope, at: string): string[] {
  if (r === undefined) return [];
  if (typeof r !== 'object' || r === null || Array.isArray(r)) return [`${at}: not a reward`];
  const reward = r as Record<string, unknown>;
  const out: string[] = [];
  for (const key of Object.keys(reward))
    if (
      ![
        'gold',
        'standing',
        'discover',
        'levelUp',
        'found',
        'homeIsland',
        'homeSpot',
        'erupt',
        'order',
        'ship',
      ].includes(key)
    )
      out.push(`${at}: unknown reward "${key}"`);
  if (reward.order !== undefined && reward.order !== true) out.push(`${at}.order: only ever true`);
  if (reward.ship !== undefined && !(typeof reward.ship === 'string' && SHIP_CLASSES[reward.ship]))
    out.push(`${at}.ship: no ship "${String(reward.ship)}"`);
  if (reward.gold !== undefined && !isCount(reward.gold))
    out.push(`${at}.gold: needs a whole number`);
  if (reward.standing !== undefined) {
    const s = reward.standing;
    if (typeof s !== 'object' || s === null || Array.isArray(s))
      out.push(`${at}.standing: port → number`);
    else
      for (const [p, n] of Object.entries(s)) {
        if (!resolvePort(scope.map, p)) out.push(`${at}.standing: no port "${p}"`);
        if (!isCount(n)) out.push(`${at}.standing.${p}: needs a whole number`);
      }
  }
  const isSite = (p: unknown) => scope.map.ports.some((port) => port.id === p && port.site);
  for (const key of ['discover', 'levelUp', 'found']) {
    const list = reward[key];
    if (list === undefined) continue;
    if (!Array.isArray(list)) out.push(`${at}.${key}: needs a list of ports`);
    else
      for (const p of list)
        if (!resolvePort(scope.map, p)) out.push(`${at}.${key}: no port "${String(p)}"`);
        // A site opens by being founded, never by a chart or a level (decision 0157).
        else if (key === 'found' && !isSite(p))
          out.push(`${at}.found: "${String(p)}" is no empty island (a port with "site": true)`);
        else if (key !== 'found' && isSite(p))
          out.push(`${at}.${key}: "${String(p)}" is an empty island: found it with "found"`);
  }
  const island = reward.homeIsland === true ? scope.map.homeIsland : reward.homeIsland;
  if (reward.homeIsland !== undefined && !homeSpots(scope.map, island as string).length)
    out.push(`${at}.homeIsland: needs true (the map's home island) or an island with build spots`);
  if (reward.homeSpot !== undefined) {
    if (!Array.isArray(reward.homeSpot)) out.push(`${at}.homeSpot: needs a list of spots`);
    else
      for (const ref of reward.homeSpot)
        if (!resolveSpot(scope.map, ref))
          out.push(`${at}.homeSpot: no arc spot "${String(ref)}" (spot-2 or <island>:spot-2)`);
  }
  if (reward.erupt !== undefined) {
    if (!Array.isArray(reward.erupt)) out.push(`${at}.erupt: needs a list of islands`);
    else
      for (const id of reward.erupt) {
        const island = scope.map.islands.find((i) => i.id === id);
        if (!island) out.push(`${at}.erupt: no island "${String(id)}"`);
        else if (!hasVolcano(island))
          out.push(`${at}.erupt: "${String(id)}" has no volcano (a peak with a crater)`);
      }
  }
  return out;
}

/** Pay a reward into the voyage. A town put up a level calls `levelled` so its market follows. */
export function payReward(
  trade: TradeState,
  map: MapDef,
  r: QuestReward | undefined,
  levelled: () => void,
): void {
  if (!r) return;
  trade.captain.gold += r.gold ?? 0;
  for (const [id, n] of Object.entries(r.standing ?? {})) {
    const p = resolvePort(map, id);
    if (p) trade.progress.standing[p] = (trade.progress.standing[p] ?? 0) + n;
  }
  for (const id of r.discover ?? []) {
    const p = resolvePort(map, id);
    if (p && !trade.progress.discovered.includes(p)) trade.progress.discovered.push(p);
  }
  let up = false;
  for (const id of r.found ?? []) if (foundSite(trade, map, id)) up = true;
  for (const id of r.levelUp ?? []) {
    const town = trade.settlements.byPort[resolvePort(map, id) ?? ''];
    if (!town || town.level >= MAX_SETTLEMENT_LEVEL) continue;
    town.level += 1;
    town.growth = 0;
    up = true;
  }
  if (up) levelled();
  if (r.ship) giveShip(trade, r.ship);
  if (r.homeIsland)
    giveHomeIsland(trade, map, r.homeIsland === true ? map.homeIsland : r.homeIsland);
  for (const ref of r.homeSpot ?? []) {
    const at = resolveSpot(map, ref);
    if (at) offerHomeSpot(trade, map, at.spot, at.island);
  }
}
