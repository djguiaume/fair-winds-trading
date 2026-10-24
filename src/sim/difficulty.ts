import { SHIPPED_TUNING, TUNING } from '../data/tuning';
import { USUAL_WEATHER, type WeatherConfig } from './wind';

/**
 * Difficulty levels (decision 0083). The boat sails the same at every level: polars, no-go zone,
 * tacking, shallows and the press warning never change. A level only changes what a mistake costs
 * and how fast the trade pays, plus how rough the weather is. Captain is the game as tuned in
 * 0046; the other levels scale it. Saved with the voyage and changeable at any time.
 *
 * The levels are the entries of `src/data/tuning/difficulty.json` › `levels` (decision 0113), from
 * the easiest to the hardest: a new level is one entry there, and its card on the New voyage
 * screen and its button in Settings are built from it. `default` is the level a voyage plays when
 * none is picked or saved, and the one that keeps the map's own weather.
 */
export type Difficulty = string;

/** Every level, easiest first, as shipped (the list does not change while playing). */
export const DIFFICULTIES: readonly Difficulty[] = Object.keys(SHIPPED_TUNING.difficulty.levels);

export const DEFAULT_DIFFICULTY: Difficulty = SHIPPED_TUNING.difficulty.default;

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
  /**
   * Storm belts (decision 0167): the share of each cycle their squall trains last × this, so the
   * lulls are longer on Fair winds and shorter on Old salt.
   */
  stormBelt: number;
  /** Every current's speed × this (decision 0140): gentler on Fair winds, stronger on Old salt. */
  currents: number;
  /** Whether a new voyage starts with the steady trade wind (Settings › Wind can change it). */
  steadyWind: boolean;
}

/** A level as its file entry has it: the knobs plus how its card looks. */
export interface DifficultyLevel extends DifficultyKnobs {
  /** English name; the game shows `level.<id>` from the text files when there is one. */
  name: string;
  /** English one-line pitch under the name (`level.<id>Tag`). */
  tag: string;
  /** Colour of the waves on its card. */
  color: string;
  /** How many waves its card draws: 1 calm to 3 rough. */
  waves: number;
}

/** The live knobs of each level, from `src/data/tuning/difficulty.json` (decision 0094). */
export const DIFFICULTY = TUNING.difficulty.levels as Readonly<
  Record<Difficulty, Readonly<DifficultyLevel>>
>;

export function isDifficulty(v: unknown): v is Difficulty {
  return typeof v === 'string' && DIFFICULTIES.includes(v);
}

/** The knobs of a level; anything unknown plays as Captain. */
export function knobs(difficulty: Difficulty | undefined): Readonly<DifficultyKnobs> {
  return DIFFICULTY[difficulty ?? DEFAULT_DIFFICULTY] ?? DIFFICULTY[DEFAULT_DIFFICULTY]!;
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
let derived = new WeakMap<WeatherConfig, Map<string, WeatherConfig>>();

/** Forget the derived weathers after a `?tune` edit (decision 0114). */
export function clearDifficultyWeatherCache(): void {
  derived = new WeakMap();
}

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
    // The level's gale weight replaces the gale's; the plain breeze takes up the difference.
    const { gale, [USUAL_WEATHER]: usual } = kinds;
    const galeWeight = gale ? (tuned ? k.galeWeight : gale.weight) : 0;
    const shift = gale && usual ? Math.max(-usual.weight, gale.weight - galeWeight) : 0;
    const soft = steadyWind ? steady.gusts : 1;
    kinds = Object.fromEntries(
      Object.entries(kinds).map(([id, kind]) => [
        id,
        {
          ...kind,
          ...(id === 'gale' && usual ? { weight: galeWeight } : {}),
          ...(id === USUAL_WEATHER && gale ? { weight: kind.weight + shift } : {}),
          gusts: kind.gusts * soft,
        },
      ]),
    );
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
