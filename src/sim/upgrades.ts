import { TUNING, type Tuning } from '../data/tuning';
import type { ShipClass } from './ship';

/**
 * Shipyard upgrades (decision 0011): three tracks, levels 1 (stock) to 3. Effects are
 * multipliers on the ship class, so every class upgrades the same way. Numbers in decision 0015,
 * kept in `upgrades.json`.
 */
export const UPGRADE_TRACKS = ['sails', 'hold', 'hull'] as const;
export type UpgradeTrack = (typeof UPGRADE_TRACKS)[number];
export type UpgradeLevels = Record<UpgradeTrack, number>;

export const MAX_UPGRADE_LEVEL = 3;

/**
 * Effect per level, index 0 = level 1 (stock): sails scale top speed and acceleration, hold the
 * cargo capacity, hull the durability (hull points) and a small speed bonus. The live numbers of
 * `src/data/tuning/upgrades.json` (decision 0094).
 */
export const UPGRADE_EFFECTS: Tuning['upgrades']['effects'] = TUNING.upgrades.effects;

export function stockLevels(): UpgradeLevels {
  return { sails: 1, hold: 1, hull: 1 };
}

function at(table: readonly number[], level: number): number {
  return table[Math.min(Math.max(Math.round(level), 1), table.length) - 1]!;
}

/** The class's sailing numbers with upgrades applied: what the boat simulation should use. */
export function effectiveShip(base: ShipClass, levels: UpgradeLevels): ShipClass {
  return {
    ...base,
    speedRatio:
      base.speedRatio *
      at(UPGRADE_EFFECTS.sailsSpeed, levels.sails) *
      at(UPGRADE_EFFECTS.hullSpeed, levels.hull),
    accel: base.accel * at(UPGRADE_EFFECTS.sailsAccel, levels.sails),
    hold: holdCapacity(base, levels),
  };
}

export function holdCapacity(base: ShipClass, levels: UpgradeLevels): number {
  return Math.round(base.hold * at(UPGRADE_EFFECTS.holdCapacity, levels.hold));
}

export function hullDurability(levels: UpgradeLevels): number {
  return at(UPGRADE_EFFECTS.hullDurability, levels.hull);
}

/** Price of the next level on a track, or null when it is maxed out. */
export function upgradePrice(base: ShipClass, levels: UpgradeLevels, track: UpgradeTrack) {
  const level = levels[track];
  if (level >= MAX_UPGRADE_LEVEL) return null;
  return base.upgradePrices[level - 1] ?? null;
}
