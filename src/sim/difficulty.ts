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

export const DIFFICULTY: Readonly<Record<Difficulty, Readonly<DifficultyKnobs>>> = {
  fair: {
    cargoLost: 0,
    damage: 0.5,
    repairCost: 1,
    spread: 0.02,
    orderFactor: 2,
    startGold: 250,
    growth: 0.75,
    galeWeight: 0.08,
    stormEverySec: 900,
    steadyWind: true,
  },
  captain: {
    cargoLost: 1,
    damage: 1,
    repairCost: 2,
    spread: 0.06,
    orderFactor: 1.5,
    startGold: 150,
    growth: 1,
    galeWeight: 0.15,
    stormEverySec: 600,
    steadyWind: false,
  },
  salt: {
    cargoLost: 2,
    damage: 1.5,
    repairCost: 3,
    spread: 0.11,
    orderFactor: 1.25,
    startGold: 100,
    growth: 1.25,
    galeWeight: 0.22,
    stormEverySec: 420,
    steadyWind: false,
  },
};

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
 * Bounded by STEADY_STEP_DEG / STEADY_REVERT (±20°); usually within about ±10°.
 */
export const STEADY_STEP_DEG = 10;
export const STEADY_REVERT = 0.5;
export const STEADY_REGION_BEND_DEG = 10;
export const STEADY_REGION_STRENGTH = 0.08;
export const STEADY_GUSTS = 0.75;

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
  // Captain keeps the map's own weather; only the other levels move gales and storms.
  const tuned = difficulty !== DEFAULT_DIFFICULTY;
  let kinds = weather.kinds;
  if (kinds) {
    const gale = tuned ? k.galeWeight : kinds.gale.weight;
    const breeze = Math.max(0, kinds.breeze.weight + kinds.gale.weight - gale);
    const soft = steadyWind ? STEADY_GUSTS : 1;
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
          stepDeg: Math.min(weather.stepDeg, STEADY_STEP_DEG),
          revert: Math.max(weather.revert, STEADY_REVERT),
          regions: weather.regions && {
            ...weather.regions,
            bendDeg: Math.min(weather.regions.bendDeg, STEADY_REGION_BEND_DEG),
            strength: Math.min(weather.regions.strength, STEADY_REGION_STRENGTH),
          },
        }
      : {}),
  };
  byKey.set(key, out);
  return out;
}
