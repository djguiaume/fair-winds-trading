import type { Surface } from './collision';
import { coastDistance } from './coast';
import type { TerrainDef } from './map';
import { clamp } from './math';
import type { ShipClass } from './ship';
import type { TradeState } from './trade';
import { hullDurability } from './upgrades';
import { dockedEffect } from './home';
import { knobs } from './difficulty';
import { TUNING } from '../data/tuning';

/**
 * Light hazards (decisions 0010 and 0032): shallow water around reefs drags at the hull, and
 * striking a reef damages it. A damaged hull leaks and sails slower until it is repaired in port.
 * Ramming a shore or a pier hurts too, once the impact is harder than a docking bump (0038).
 * Nothing sinks and no cargo is lost: hazards cost time and gold, not the voyage.
 */

/*
 * The numbers live in `src/data/tuning/seamanship.json` › `hazards` (decision 0094):
 * `shallowWidth` (units) of the shallow band around a reef; `shallowDrag`, extra braking (1/s) at a
 * reef's edge for a ship of draft 1, fading to 0 at the band's edge; `strikeDamage`, hull points
 * lost per knot of speed a reef strike takes off; `crashSafeKn`, knots a shore or pier impact may
 * take off for free (docking bumps never hurt), then `crashDamage` hull points per knot beyond it;
 * `leakPenalty`, speed lost with a fully wrecked hull, scaled by damage. The repair cost per hull
 * point is set by the difficulty level (decision 0083).
 */
const hazards = () => TUNING.seamanship.hazards;

/** Gold per hull point repaired at the voyage's difficulty level. */
export function repairCost(trade: TradeState): number {
  // The home workshop repairs for less than a port (decision 0126).
  const home = dockedEffect(trade.home, 'homeRepair') ?? 1;
  return knobs(trade.difficulty).repairCost * home;
}

/** Moored at one of her islands with a building that repairs (the workshop, decisions 0126, 0128). */
export function repairsAtHome(trade: TradeState): boolean {
  return dockedEffect(trade.home, 'homeRepair') !== undefined;
}

export interface Reef {
  outline: TerrainDef['outline'];
  /** Bounding circle grown by the shallow band, for a cheap early-out. */
  x: number;
  y: number;
  r: number;
}

export function reefsOf(terrain: readonly TerrainDef[] = []): Reef[] {
  return terrain
    .filter((t) => t.kind === 'reef' && t.outline.length >= 3)
    .map((t) => {
      const n = t.outline.length;
      const x = t.outline.reduce((s, p) => s + p[0], 0) / n;
      const y = t.outline.reduce((s, p) => s + p[1], 0) / n;
      const r = Math.max(...t.outline.map(([px, py]) => Math.hypot(px - x, py - y)));
      return { outline: t.outline, x, y, r: r + hazards().shallowWidth };
    });
}

/** Distance from `pos` to the nearest reef shore (Infinity when none is near). */
export function reefDistance(reefs: readonly Reef[], pos: { x: number; y: number }): number {
  let best = Infinity;
  for (const reef of reefs) {
    if (Math.hypot(pos.x - reef.x, pos.y - reef.y) > reef.r) continue;
    best = Math.min(best, coastDistance(pos.x, pos.y, reef.outline).distance);
  }
  return best;
}

/** 0 = deep water … 1 = right at a reef's edge. */
export function shallowness(distanceToReef: number, shipRadius: number): number {
  return clamp(1 - (distanceToReef - shipRadius) / hazards().shallowWidth, 0, 1);
}

/** Speed multiplier for this step from dragging through shallows. */
export function shallowDrag(shallow: number, ship: ShipClass, dt: number): number {
  return Math.exp(-hazards().shallowDrag * shallow * ship.draft * dt);
}

/**
 * Hull points an impact on `surface` costs, given the knots it took off. Reefs cut at any speed,
 * shores, piers and moored boats only past a docking bump; sandbanks and the edge of the sea are soft.
 */
export function impactDamage(surface: Surface, speedLost: number): number {
  if (surface === 'reef') return speedLost * hazards().strikeDamage;
  if (surface === 'shore' || surface === 'pier' || surface === 'boat')
    return Math.max(0, speedLost - hazards().crashSafeKn) * hazards().crashDamage;
  return 0;
}

export function hullDamage(trade: TradeState): number {
  return trade.captain.hullDamage[trade.captain.activeShip] ?? 0;
}

export function maxHull(trade: TradeState): number {
  const levels = trade.captain.ships[trade.captain.activeShip];
  return levels ? hullDurability(levels) : 100;
}

/** 1 = sound … 0 = wrecked (still sails, slowly). */
export function hullCondition(trade: TradeState): number {
  return clamp(1 - hullDamage(trade) / maxHull(trade), 0, 1);
}

/** Speed factor from leaks. */
export function leakFactor(condition: number): number {
  return 1 - hazards().leakPenalty * (1 - condition);
}

/** Damage the active ship's hull; returns the points actually taken. */
export function damageHull(trade: TradeState, points: number): number {
  if (!(points > 0)) return 0;
  const id = trade.captain.activeShip;
  const before = trade.captain.hullDamage[id] ?? 0;
  const after = Math.min(maxHull(trade), before + points);
  trade.captain.hullDamage[id] = after;
  return after - before;
}

export function repairPrice(trade: TradeState): number {
  return Math.ceil(hullDamage(trade) * repairCost(trade));
}

export type RepairResult =
  | { ok: true; gold: number; points: number }
  | { ok: false; error: 'not-docked' | 'not-damaged' | 'not-enough-gold' };

/** Repair as much of the active hull as the captain can pay for, while docked. */
export function repairHull(trade: TradeState): RepairResult {
  if (!trade.dockedAt && !repairsAtHome(trade)) return { ok: false, error: 'not-docked' };
  const damage = hullDamage(trade);
  if (damage <= 0) return { ok: false, error: 'not-damaged' };
  const cost = repairCost(trade);
  const points = Math.min(damage, Math.floor(trade.captain.gold / cost));
  if (points <= 0) return { ok: false, error: 'not-enough-gold' };
  const gold = Math.ceil(points * cost);
  trade.captain.gold -= gold;
  trade.captain.hullDamage[trade.captain.activeShip] = damage - points;
  return { ok: true, gold, points };
}
