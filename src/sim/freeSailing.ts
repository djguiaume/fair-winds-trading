import { createBoat } from './boat';
import type { Catalogue } from './cosmetics';
import type { UnlockProgress } from './cosmeticUnlocks';
import { secondsAtHour } from './daylight';
import { weatherFor } from './difficulty';
import { chartAreaIds } from './fog';
import { emptyAmounts } from './goods';
import type { ShipLooks } from './shipLooks';
import { activeShip } from './trade';
import { MAX_UPGRADE_LEVEL, UPGRADE_TRACKS, type UpgradeLevels } from './upgrades';
import { type WeatherConfig, steadyWeather, weatherAt } from './wind';
import type { World } from './world';
import { TUNING } from '../data/tuning';

/**
 * Free Sailing (decision 0266, issue #300): a sail for its own sake, on the game's sea, in any
 * ship, with any upgrades and look. The session lives in memory only: the page that runs it never
 * opens the voyage's storage, and nothing here reads or writes a save. Presets are data
 * (`src/data/free-sailing/`): where she starts, at what hour, in what weather, in which ship.
 */
export interface FreePreset {
  /** Matches the file name. */
  id: string;
  name: { en: string; fr: string };
  /** One short line on the setup card. */
  about: { en: string; fr: string };
  place: { x: number; y: number; headingDeg: number };
  /** Clock hour she sets out at, 0 to 24. */
  hour: number;
  /** The sea's weather kind at the start (`weather.json` › `default.kinds`). */
  weather: string;
  /** The ship and upgrades the setup starts from; the player may change both. */
  ship: { class: string } & UpgradeLevels;
}

/** `src/data/free-sailing/rules.json`: what a preset's start must keep clear of. */
export interface FreeRules {
  /** Sea room round the start beyond the largest hull, in metres. */
  clearance: number;
  /** How many game days to look ahead for the preset's weather at its hour. */
  searchDays: number;
}

/** What the player chose on the setup screen: kept in memory for the session, never saved. */
export interface FreeSetup {
  preset: string;
  ship: string;
  upgrades: UpgradeLevels;
  /** A look per ship tried in this session (decision 0263's shape), so switching back keeps it. */
  looks: ShipLooks;
}

/** `?free` opens the game as a Free Sailing session instead of the voyage. */
export const FREE_PARAM = 'free';

export const isFreeSailing = (search: string) => new URLSearchParams(search).has(FREE_PARAM);

const level = (n: number) => Math.min(MAX_UPGRADE_LEVEL, Math.max(1, Math.round(n)));

/** The setup a preset starts from, keeping the looks already tried this session. */
export function setupFor(preset: FreePreset, looks: ShipLooks = {}): FreeSetup {
  const upgrades = Object.fromEntries(
    UPGRADE_TRACKS.map((t) => [t, level(preset.ship[t])]),
  ) as UpgradeLevels;
  return { preset: preset.id, ship: preset.ship.class, upgrades, looks };
}

/** The weather the world will sail with, as its step builds it (Settings and level included). */
export function sailedWeather(world: World): WeatherConfig | undefined {
  const base = world.map.wind.weather;
  if (!base) return undefined;
  const weather = weatherFor(base, world.trade.difficulty, world.steadyWind);
  return world.dynamicWeather ? weather : steadyWeather(weather);
}

/**
 * The first game time, at or after `from`, at the preset's hour with its weather. Null when the
 * weather never comes in `days` days (Weather switched off in Settings: the sea stays in its
 * breeze, which the session respects).
 */
export function presetTime(
  preset: Pick<FreePreset, 'hour' | 'weather'>,
  weather: WeatherConfig | undefined,
  seed: number,
  from: number,
  days: number,
): number | null {
  const day = TUNING.weather.daylight.daySeconds;
  const offset = secondsAtHour(preset.hour);
  const first = Math.max(0, Math.ceil((from - offset) / day));
  for (let d = first; d < first + days; d++) {
    const t = d * day + offset;
    if (!weather || weatherAt(weather, seed, t).kind === preset.weather) return t;
  }
  return null;
}

/**
 * Puts the session's world at the preset's start in the chosen ship: no gold, an empty hold, a
 * sound hull, the whole chart open, nothing docked. Time only moves on (a restart never rewinds
 * the towns or the weather). The world must be the session's own, never a voyage's.
 */
export function startFreeSession(
  world: World,
  preset: FreePreset,
  setup: FreeSetup,
  rules: FreeRules,
): void {
  const trade = world.trade;
  trade.captain = {
    gold: 0,
    activeShip: setup.ship,
    ships: { [setup.ship]: { ...setup.upgrades } },
    cargo: emptyAmounts(),
    hullDamage: {},
    // The session's own looks, shared with its setup: what the port's Boat looks keeps shows there.
    looks: setup.looks,
  };
  trade.dockedAt = null;
  const areas = chartAreaIds(world.map);
  if (areas.length) trade.progress.areas = areas;
  const { x, y, headingDeg } = preset.place;
  world.boat = createBoat(x, y, (headingDeg * Math.PI) / 180);
  world.destination = null;
  const from = world.time;
  world.time =
    presetTime(preset, sailedWeather(world), world.map.seed, from, rules.searchDays) ??
    (presetTime(preset, undefined, world.map.seed, from, 1) as number);
  world.course.legStart = world.time;
  world.ship = activeShip(trade);
}

/**
 * Every cosmetic open to try (decision 0266): quests count as done, every series and milestone
 * the catalogue names as won. Only the session sees this; the voyage keeps its own unlocks.
 */
export function everythingUnlocked(cat: Catalogue): UnlockProgress {
  const series = new Set<string>();
  const milestones = new Set<string>();
  for (const item of cat.items) {
    if (item.unlock.kind !== 'earned') continue;
    if (item.unlock.regatta) series.add(item.unlock.regatta);
    if (item.unlock.milestone) milestones.add(item.unlock.milestone);
  }
  return { questDone: () => true, seriesWon: [...series], milestones: [...milestones] };
}
