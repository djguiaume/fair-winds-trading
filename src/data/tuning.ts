import type { ShipClass } from '../sim/ship';
import type { GoodDef } from '../sim/goods';
import type { DifficultyLevel } from '../sim/difficulty';
import type { WeatherConfig } from '../sim/wind';
import { SHIP_FILES, shipClassOf } from './ships';
import upgrades from './tuning/upgrades.json';
import goods from './tuning/goods.json';
import economy from './tuning/economy.json';
import difficulty from './tuning/difficulty.json';
import weather from './tuning/weather.json';
import seamanship from './tuning/seamanship.json';

/**
 * Every tuning number of the game, read from the JSON files in `src/data/tuning/` (decisions 0093
 * and 0094). The sim reads `TUNING.group.value` when it needs a value, never a copy taken at load,
 * so a value changed here takes effect at once (the `?tune` panel will rely on this). Change values
 * in place: the sim and its exported aliases (`SLOOP`, `GOOD_DEFS`, `DEFAULT_WEATHER`…) hold
 * references to the objects inside, so replacing a whole group would leave them on the old one.
 * Ship classes, goods, weather kinds and difficulty levels come from their files (decisions
 * 0108, 0109, 0113). What each value means, its range and unit: `tuning-meta.ts`.
 */
export interface Tuning {
  /** The ship classes, by id, from `src/data/ships/*.json`. Angles in degrees (`noGoDeg`, `turnRateDeg`). */
  ships: Record<string, ShipClass>;
  upgrades: {
    /** Multipliers per upgrade level (index 0 = level 1, stock); hull durability in points. */
    effects: {
      sailsSpeed: number[];
      sailsAccel: number[];
      holdCapacity: number[];
      hullSpeed: number[];
      hullDurability: number[];
    };
    /** Home port level needed to fit each upgrade level (decision 0030). */
    homePortLevel: Record<string, number>;
  };
  goods: Record<string, GoodDef & { icon: string; madeFrom?: string }>;
  economy: Omit<typeof economy, 'orders'> & {
    orders: Omit<typeof economy.orders, 'qty'> & { qty: [number, number] };
  };
  difficulty: {
    /** The level a voyage plays when none is picked (decision 0113). */
    default: string;
    /** The levels, easiest first (decision 0113). */
    levels: Record<string, DifficultyLevel>;
    steadyWind: typeof difficulty.steadyWind;
  };
  weather: Omit<typeof weather, 'default'> & { default: WeatherConfig };
  seamanship: typeof seamanship;
}

/** The values as shipped. Never changed: the panel resets to these. */
export const SHIPPED_TUNING: Readonly<Tuning> = {
  // One file per ship (decision 0109): the sailing and unlock numbers of `src/data/ships/*.json`.
  ships: Object.fromEntries(SHIP_FILES.map((f) => [f.id, shipClassOf(f)])),
  upgrades,
  goods,
  economy,
  difficulty,
  weather,
  seamanship,
} as unknown as Tuning;

/** The live values. */
export const TUNING: Tuning = structuredClone(SHIPPED_TUNING) as Tuning;

type Tree = Record<string, unknown> | unknown[];
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null;

/** Copy `from` into `into` in place, so references into `into` stay valid. */
function assignDeep(into: Tree, from: Tree): void {
  const target = into as Record<string, unknown>;
  for (const [key, value] of Object.entries(from)) {
    const current = target[key];
    if (isTree(value) && isTree(current) && Array.isArray(value) === Array.isArray(current)) {
      assignDeep(current, value);
      if (Array.isArray(current)) current.length = (value as unknown[]).length;
    } else target[key] = structuredClone(value);
  }
}

/** Put every live value back to the shipped one (tests, and the panel's Reset all). */
export function resetTuning(): void {
  assignDeep(TUNING as unknown as Tree, SHIPPED_TUNING as unknown as Tree);
}
