import type { ShipClass } from './ship';

/**
 * Shipyard upgrades (decision 0011): three tracks, levels 1 (stock) to 3. Effects are
 * multipliers on the ship class, so every class upgrades the same way. Numbers in decision 0015.
 */
export const UPGRADE_TRACKS = ['sails', 'hold', 'hull'] as const;
export type UpgradeTrack = (typeof UPGRADE_TRACKS)[number];
export type UpgradeLevels = Record<UpgradeTrack, number>;

export const MAX_UPGRADE_LEVEL = 3;

/** Index 0 = level 1 (stock). */
export const UPGRADE_EFFECTS = {
  /** Sails: top speed and acceleration. */
  sailsSpeed: [1, 1.08, 1.16],
  sailsAccel: [1, 1.15, 1.3],
  /** Hold: cargo capacity (+60 %, +120 %). */
  holdCapacity: [1, 1.6, 2.2],
  /** Hull: durability (used from the hazards and pirates phases) and a small speed bonus. */
  hullSpeed: [1, 1.02, 1.04],
  hullDurability: [100, 150, 220],
} as const;

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
