import boatLookFile from '../../data/boat-look.json';
import type { UpgradeLevel } from './types';

/**
 * A boat's paint (decision 0259, docs/v1.4/customisation.md): the colour channels the
 * cosmetic slots set, on top of the upgrade levels. Upgrades decide WHERE bands, strakes and
 * copper show; the look decides their colours only, so every level still reads.
 */
export interface BoatLook {
  /** Sail canvas; null keeps each sails level's own canvas (`boat-look.json`). */
  sailCloth: string | null;
  /** Foot band (sails 2+) and head band (sails 3). */
  sailBand: string;
  /** Centre stripe (sails 3). */
  sailStripe: string;
  /** Top strake from hull 2, and the stern castle's upper strake. */
  hullBand: string;
  /** Rubbing strake from hull 2; null keeps the level's own (tan at 2, brass at 3). */
  hullStrake: string | null;
  /** A figurehead: a prop recipe (decision 0135) and its size; null for none. */
  figurehead: { recipe: string; size: number } | null;
}

/** The class colours a stock look starts from: the ship file's `model`. */
export interface ClassColours {
  bandColor: string;
  sailBandColor: string;
}

type LevelColours = Record<'1' | '2' | '3', string>;

/** Shared upgrade colours and the sails' band glow, from `src/data/boat-look.json`. */
export const BOAT_LOOK = boatLookFile as {
  sails: { canvas: LevelColours; glow: number; bandGlow: number };
  hull: { strake: Omit<LevelColours, '1'>; copper: string };
};

/** A class's stock look with the chosen channels on top. */
export function resolveBoatLook(colours: ClassColours, chosen: Partial<BoatLook> = {}): BoatLook {
  const sailBand = chosen.sailBand ?? colours.sailBandColor;
  return {
    sailCloth: chosen.sailCloth ?? null,
    sailBand,
    sailStripe: chosen.sailStripe ?? sailBand,
    hullBand: chosen.hullBand ?? colours.bandColor,
    hullStrake: chosen.hullStrake ?? null,
    figurehead: chosen.figurehead ?? null,
  };
}

/** The rubbing strake's colour at a hull level, or null below hull 2 (bare topsides). */
export function strakeColour(look: BoatLook, hull: UpgradeLevel | number): string | null {
  if (hull < 2) return null;
  return look.hullStrake ?? BOAT_LOOK.hull.strake[hull >= 3 ? '3' : '2'];
}

/** Which kind of panel a sail row is at a sails level: `nv` rows, row 0 at the foot. */
export type SailRow = 'canvas' | 'band' | 'stripe';

/**
 * Variant B (decision 0259): sails 1 plain (patched) canvas; sails 2 a foot band; sails 3 a
 * head band and a centre stripe too. Short sails (fewer than 6 rows, the square courses) skip
 * the stripe, which would leave no canvas between the bands.
 */
export function sailRow(level: number, j: number, nv: number): SailRow {
  if (level < 2) return 'canvas';
  if (j === 0) return 'band';
  if (level < 3) return 'canvas';
  if (j === nv - 1) return 'band';
  if (nv >= 6 && (j === nv / 2 - 1 || j === nv / 2)) return 'stripe';
  return 'canvas';
}

/** The plain canvas of a sail: the chosen cloth, else the level's own (worn = sails 1's). */
export function canvasColour(look: BoatLook, level: number, worn: boolean): string {
  if (look.sailCloth) return look.sailCloth;
  const k = worn ? '1' : level >= 3 ? '3' : level >= 2 ? '2' : '1';
  return BOAT_LOOK.sails.canvas[k];
}
