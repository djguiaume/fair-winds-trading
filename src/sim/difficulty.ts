import { TUNING } from '../data/tuning';
import type { WeatherConfig } from './wind';

/**
 * Difficulty levels (decision 0083). The boat sails the same at every level: polars, no-go zone,
 * tacking, shallows and the press warning never change. A level only changes what a mistake costs
 * and how fast the trade pays, plus how rough the weather is. Captain is the game as tuned in
 * 0046; the other two scale it. Saved with the voyage and changeable at any time.
 */
export const DIFFICULTIES = ['fair', 'captain', 'salt'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DEFAULT_DIFFICULTY: Difficulty = 'captain';

export interface DifficultyKnobs {
  /** Cargo units thrown per lurch or overpressed spell; 0 keeps the cargo (the warning still shows). */
  cargoLost: number;
  /** Multiplier on hull damage from reefs, shores, piers and boats. */
  damage: number;
  /** Gold per hull point repaired. */
  repairCost: number;
  /** The port's cut: you buy this much above the mid price and sell this much below it. */
  spread: number;
  /** Delivery order reward per unit, as a multiple of the base price before the haul bonus. */
  orderFactor: number;
  /** Gold at the start of a voyage. */
  startGold: number;
  /** Multiplier on the growth a town needs to reach its next level. */
  growth: number;
  /** Share of weather spells that are gales (taken from or given to the plain breeze). */
  galeWeight: number;
  /** One storm crosses the sea in each stretch of this many seconds. */
  stormEverySec: number;
  /** Whether a new voyage starts with the steady trade wind (Settings › Wind can change it). */
  steadyWind: boolean;
}

/** The live knobs of each level, from `src/data/tuning/difficulty.json` (decision 0094). */
export const DIFFICULTY = TUNING.difficulty.levels as Readonly<
  Record<Difficulty, Readonly<DifficultyKnobs>>
>;

export function isDifficulty(v: unknown): v is Difficulty {
  return typeof v === 'string' && (DIFFICULTIES as readonly string[]).includes(v);
}

/** The knobs of a level; anything unknown plays as Captain. */
export function knobs(difficulty: Difficulty | undefined): Readonly<DifficultyKnobs> {
  return DIFFICULTY[difficulty ?? DEFAULT_DIFFICULTY] ?? DIFFICULTY[DEFAULT_DIFFICULTY];
}

/** The easier of two levels (for "easiest level played" on a voyage). */
export function easier(a: Difficulty, b: Difficulty): Difficulty {
  return DIFFICULTIES.indexOf(a) <= DIFFICULTIES.indexOf(b) ? a : b;
}

/*
 * The steady trade wind (Guillaume, 2026-10-22: the dynamic wind "will feel brutal"): small,
 * slow shifts that keep close to the prevailing wind, regions that barely bend it, softer gusts.
 * Bounded by `stepDeg` / `revert` (±20°); usually within about ±10°. Numbers in
 * `difficulty.json` › `steadyWind`.
 */
const derived = new WeakMap<WeatherConfig, Map<string, WeatherConfig>>();

/**
 * The map's weather as a difficulty level and the Wind setting shape it. Cached per input, so the
 * weather walk (cached per config object) is not rebuilt every step.
 */
export function weatherFor(
  weather: WeatherConfig,
  difficulty: Difficulty,
  steadyWind: boolean,
): WeatherConfig {
  const key = `${difficulty}:${steadyWind}`;
  let byKey = derived.get(weather);
  if (!byKey) derived.set(weather, (byKey = new Map()));
  const cached = byKey.get(key);
  if (cached) return cached;
  const k = knobs(difficulty);
  const steady = TUNING.difficulty.steadyWind;
  // Captain keeps the map's own weather; only the other levels move gales and storms.
  const tuned = difficulty !== DEFAULT_DIFFICULTY;
  let kinds = weather.kinds;
  if (kinds) {
    const gale = tuned ? k.galeWeight : kinds.gale.weight;
    const breeze = Math.max(0, kinds.breeze.weight + kinds.gale.weight - gale);
    const soft = steadyWind ? steady.gusts : 1;
    kinds = {
      calm: { ...kinds.calm, gusts: kinds.calm.gusts * soft },
      breeze: { ...kinds.breeze, weight: breeze, gusts: kinds.breeze.gusts * soft },
      rain: { ...kinds.rain, gusts: kinds.rain.gusts * soft },
      gale: { ...kinds.gale, weight: gale, gusts: kinds.gale.gusts * soft },
    };
  }
  const out: WeatherConfig = {
    ...weather,
    kinds,
    storms:
      tuned && weather.storms ? { ...weather.storms, everySec: k.stormEverySec } : weather.storms,
    ...(steadyWind
      ? {
          stepDeg: Math.min(weather.stepDeg, steady.stepDeg),
          revert: Math.max(weather.revert, steady.revert),
          regions: weather.regions && {
            ...weather.regions,
            bendDeg: Math.min(weather.regions.bendDeg, steady.regionBendDeg),
            strength: Math.min(weather.regions.strength, steady.regionStrength),
          },
        }
      : {}),
  };
  byKey.set(key, out);
  return out;
}
