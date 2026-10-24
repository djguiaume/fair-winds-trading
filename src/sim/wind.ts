import { TUNING } from '../data/tuning';
import { islandCoasts } from './islandLayout';
import { coastDistance } from './coast';
import type { IslandDef, TerrainDef } from './map';
import { DEG, TAU, bearingVector, clamp, wrapAngle, wrapPositive } from './math';
import { createRng } from './rng';
import { SpatialGrid } from './spatial';
import {
  DEFAULT_SEA_RADIUS,
  type Storm,
  type StormConfig,
  stormStrength,
  stormWindFrom,
  stormsAt,
} from './storms';
import {
  NO_ZONE,
  type ZoneEffect,
  type ZoneField,
  clearZoneFields,
  zoneEffectAt,
  zoneStormsAt,
} from './windZones';
import { beltSquallsAt } from './stormBelt';

/** Wind at one moment. `from` is the compass bearing the wind blows FROM (sailors' convention). */
export interface Wind {
  from: number;
  speedKn: number;
}

/**
 * Slow weather (decisions 0026 and 0064): every `periodSec` the sea wind veers or backs by up to
 * `stepDeg` from where it was and settles on a new strength in `strength`, easing across over the
 * first `blendSec`. A gentle pull (`revert`) keeps the map's prevailing wind the most common one,
 * but over a long voyage the wind can come from any quarter. Deterministic from the map seed, so a
 * voyage resumes in the same weather.
 */
export interface WeatherConfig {
  periodSec: number;
  blendSec: number;
  /** Largest change of direction from one period to the next, in degrees. */
  stepDeg: number;
  /** 0..1: share of the offset from the prevailing wind dropped each period (0 = free wander). */
  revert: number;
  /** Strength multipliers [min, max] applied to `speedKn` in a plain breeze. */
  strength: [number, number];
  /** Sea-wide weather states (decision 0067); none = always a breeze. */
  kinds?: Record<WeatherKind, KindConfig>;
  /** Chance that a period keeps the previous period's weather. */
  persist?: number;
  /** Moving storm cells (decision 0067). */
  storms?: StormConfig;
  /** The wind differs across the sea at the same moment (decision 0064); none = one wind everywhere. */
  regions?: RegionConfig;
}

/**
 * Sea-wide weather of one period (decision 0067). Storms are separate, moving cells. The kinds are
 * the keys of `kinds` in `weather.json` (decision 0108): adding one there is enough. The order of
 * the file is the order of the weighted pick, so reordering it changes every voyage's weather.
 */
export type WeatherKind = string;

/** The plain weather: every voyage starts in it, maps without kinds keep it, the HUD hides it. */
export const USUAL_WEATHER: WeatherKind = 'breeze';

/** The weather kinds of the shipped Phase 2 weather, in pick order. */
export const WEATHER_KINDS: readonly WeatherKind[] = Object.keys(TUNING.weather.default.kinds!);

export interface KindConfig {
  /** English name; the HUD shows the translation (`weather.<id>` in `src/i18n/*.json`) if any. */
  name: string;
  /** How often this weather is picked when it changes. */
  weight: number;
  /** Strength multipliers [min, max]. */
  strength: [number, number];
  /** 0..1: how hard it rains. */
  rain: number;
  /** Gusts are this many times stronger than the map's `gustiness`. */
  gusts: number;
  /** 0..1: how much darker and greyer the sky gets (rain and storms darken it on their own). */
  gloom: number;
}

/** Large, slowly drifting areas where the wind bends and strengthens or eases (decision 0064). */
export interface RegionConfig {
  /** Largest bend of the direction from the sea-wide wind, in degrees. */
  bendDeg: number;
  /** Largest change of strength, e.g. 0.15 = ±15 %. */
  strength: number;
  /** Size of one wind region, in map units (a full wave is twice this). */
  sizeUnits: number;
  /** Seconds for the regions to drift by one region. */
  driftSec: number;
}

/** Global wind settings for a map: one prevailing direction and strength. */
export interface WindConfig {
  fromDeg: number;
  speedKn: number;
  /** Relative strength of gusts, e.g. 0.15 = ±15 %. */
  gustiness: number;
  /** Maximum slow swing of the direction, in degrees. */
  shiftDeg: number;
  /** Slow weather shifts; without it the wind keeps its prevailing direction (Phase 0). */
  weather?: WeatherConfig;
  /** Only storms that form at or after this game time (decision 0072). */
  stormsFrom?: number;
  /** Radius of the sea storms cross: the map's `boundsRadius`, set by `prepareMap` (0115). */
  seaRadius?: number;
  /** The map's wind zones (decision 0140), when the Settings switch has them on. */
  zones?: ZoneField | null;
  /** The easiest level: zones never weaken the wind below their kind's `fairFloor` (0140). */
  easiest?: boolean;
  /**
   * Storm belts' squalls (decision 0167): the level's `stormBelt` knob, or 0 when Settings › Storm
   * belt is off. Without it there are none.
   */
  stormBelt?: number;
  /** Only squalls born at or after this time: set when the Storm belt switch comes back on. */
  beltFrom?: number;
}

/**
 * Phase 2 weather: a new wind every 3 minutes that wanders round the compass, and regions of the
 * sea where it blows from a different angle at the same moment. Live numbers of
 * `src/data/tuning/weather.json` › `default` (decision 0094).
 */
export const DEFAULT_WEATHER: WeatherConfig = TUNING.weather.default;

interface Slot {
  offsetDeg: number;
  strength: number;
  kind: WeatherKind;
  rain: number;
  gusts: number;
  gloom: number;
}

const FIRST_SLOT: Slot = {
  offsetDeg: 0,
  strength: 1,
  kind: USUAL_WEATHER,
  rain: 0,
  gusts: 1,
  gloom: 0,
};

function pickKind(weather: WeatherConfig, previous: WeatherKind, roll: number, roll2: number) {
  const kinds = weather.kinds!;
  if (roll < (weather.persist ?? 0)) return previous;
  const ids = Object.keys(kinds);
  const total = ids.reduce((sum, k) => sum + kinds[k]!.weight, 0);
  let x = roll2 * total;
  for (const k of ids) if ((x -= kinds[k]!.weight) < 0) return k;
  return USUAL_WEATHER;
}

/** Offsets of every period so far, per seed and config: the walk is a running sum. */
let walks = new WeakMap<WeatherConfig, Map<number, Slot[]>>();

function slotRng(seed: number, slot: number) {
  return createRng((seed ^ Math.imul(slot, 0x9e3779b1)) >>> 0);
}

/** The weather of one period: offset from the prevailing direction (deg) and strength factor. */
export function weatherSlot(weather: WeatherConfig, seed: number, slot: number): Slot {
  // Slot 0 is the prevailing wind, so a fresh voyage starts in the map's designed breeze.
  if (slot <= 0) return FIRST_SLOT;
  let bySeed = walks.get(weather);
  if (!bySeed) walks.set(weather, (bySeed = new Map()));
  let walk = bySeed.get(seed);
  if (!walk) bySeed.set(seed, (walk = [FIRST_SLOT]));
  // A random walk: each period veers or backs from the last one, so the wind can swing right
  // round over a long voyage instead of staying in one quarter of the compass.
  for (let k = walk.length; k <= slot; k++) {
    const rng = slotRng(seed, k);
    const step = (rng() * 2 - 1) * weather.stepDeg;
    const roll = rng();
    const prev = walk[k - 1]!;
    const offset = prev.offsetDeg * (1 - weather.revert) + step;
    // Separate draws for the weather kind, so maps without kinds keep the same wind walk.
    const kindRng = slotRng(seed ^ 0x3c6ef372, k);
    const kind = weather.kinds ? pickKind(weather, prev.kind, kindRng(), kindRng()) : USUAL_WEATHER;
    const def = weather.kinds?.[kind];
    const [lo, hi] = def?.strength ?? weather.strength;
    walk.push({
      // Keep the offset in -180..180 so easing between periods always takes the short way round.
      offsetDeg: ((((offset + 180) % 360) + 360) % 360) - 180,
      strength: lo + (hi - lo) * roll,
      kind,
      rain: def?.rain ?? 0,
      gusts: def?.gusts ?? 1,
      gloom: def?.gloom ?? 0,
    });
  }
  return walk[slot]!;
}

/** Weather in force at time `t`, eased from the previous period. */
export function weatherAt(weather: WeatherConfig, seed: number, t: number): Slot {
  const slot = Math.floor(Math.max(0, t) / weather.periodSec);
  const now = weatherSlot(weather, seed, slot);
  const into = Math.max(0, t) - slot * weather.periodSec;
  if (slot === 0 || into >= weather.blendSec) return now;
  const before = weatherSlot(weather, seed, slot - 1);
  const k = into / weather.blendSec;
  const s = k * k * (3 - 2 * k);
  // Ease along the shorter arc, then wrap, so a shift across south never spins the long way.
  let turn = now.offsetDeg - before.offsetDeg;
  turn -= 360 * Math.round(turn / 360);
  const mix = (a: number, b: number) => a + (b - a) * s;
  return {
    offsetDeg: before.offsetDeg + turn * s,
    strength: mix(before.strength, now.strength),
    // The new weather's name shows once it is halfway in.
    kind: s < 0.5 ? before.kind : now.kind,
    rain: mix(before.rain, now.rain),
    gusts: mix(before.gusts, now.gusts),
    gloom: mix(before.gloom, now.gloom),
  };
}

/**
 * How the wind differs at one spot of the sea (decision 0064): two slow waves with seeded
 * directions bend it by up to `bendDeg` and change its strength by up to `strength`, drifting
 * so the regions move. Smooth in space and time, so a boat never feels a jump.
 */
export function regionAt(
  regions: RegionConfig,
  seed: number,
  t: number,
  x: number,
  y: number,
): { bendDeg: number; strength: number } {
  const rng = createRng((seed * 0x85ebca6b) >>> 0);
  const k = Math.PI / regions.sizeUnits;
  const wave = (i: number) => {
    const angle = rng() * TAU + i * 2.1;
    const phase = rng() * TAU;
    const along = x * Math.cos(angle) + y * Math.sin(angle);
    return Math.sin(k * along * (1 - 0.25 * i) + (t / regions.driftSec) * Math.PI + phase);
  };
  const a = wave(0),
    b = wave(1),
    c = wave(2);
  return {
    bendDeg: regions.bendDeg * (0.65 * a + 0.35 * b),
    strength: 1 + regions.strength * (0.6 * c + 0.4 * a * b),
  };
}

let stormless = new WeakMap<WeatherConfig, WeatherConfig>();

/** The same weather without moving storms, for players who turn them off (decision 0067). Cached
 * so the weather walk keeps its cache. */
export function withoutStorms(weather: WeatherConfig): WeatherConfig {
  let calm = stormless.get(weather);
  if (!calm) stormless.set(weather, (calm = { ...weather, storms: undefined }));
  return calm;
}

let steadied = new WeakMap<WeatherConfig, WeatherConfig>();

/**
 * Forget the cached weather walks and derived configs. They are keyed by config object, so a
 * value changed in place by the `?tune` panel (decision 0114) would otherwise never be seen.
 */
export function clearWeatherCaches(): void {
  walks = new WeakMap();
  stormless = new WeakMap();
  steadied = new WeakMap();
  // Zone fields hold the fade width (decision 0140).
  clearZoneFields();
}

/**
 * A steady breeze for players who turn the weather off (decision 0067): no calm, rain or gale
 * spells and no storms. The wind still veers, backs and differs across the sea (decision 0064).
 */
export function steadyWeather(weather: WeatherConfig): WeatherConfig {
  let steady = steadied.get(weather);
  if (!steady)
    steadied.set(weather, (steady = { ...weather, kinds: undefined, storms: undefined }));
  return steady;
}

/** The weather where a boat is: sea-wide state, rain and storm (decision 0067). */
export interface LocalWeather {
  kind: WeatherKind;
  /** 0..1 rain at this spot (showers, or a storm's downpour). */
  rain: number;
  /** 0..1 sea-wide showers, outside any storm. */
  showers: number;
  /** 0..1 sky gloom of the sea-wide weather (a gale's grey sky), outside rain and storms. */
  gloom: number;
  /** 0..1: how hard the nearest storm hits here. */
  storm: number;
  /** Storms on the sea right now, for the chart and the renderer. */
  storms: Storm[];
  /** Id of the wind zone that counts most here (decision 0140), or null at open sea. */
  zone?: string | null;
  /** 0..1: how far inside that zone, past its soft edge. */
  zoneWeight?: number;
}

const NO_STORMS: Storm[] = [];
const zoneScratch: ZoneEffect = { ...NO_ZONE };

/**
 * Sea wind at time `t` (seconds) and position `pos`, away from any island. Deterministic: slow
 * weather periods, regions where it bends, storms, plus a sum of slow sines for gusts and a small
 * direction swing so the sea feels alive. `out` receives the local weather when given.
 */
export function windAt(
  config: WindConfig,
  t: number,
  seed = 0,
  pos: { x: number; y: number } = { x: 0, y: 0 },
  out?: LocalWeather,
): Wind {
  const weather = config.weather ? weatherAt(config.weather, seed, t) : FIRST_SLOT;
  const region = config.weather?.regions
    ? regionAt(config.weather.regions, seed, t, pos.x, pos.y)
    : { bendDeg: 0, strength: 1 };
  // Gusts arrive at different moments in different places once the wind has regions.
  const lag = config.weather?.regions ? pos.x * 0.011 - pos.y * 0.017 : 0;
  const g = t + lag;
  const gust =
    0.6 * Math.sin((g * TAU) / 23) +
    0.3 * Math.sin((g * TAU) / 9.7 + 1.3) +
    0.1 * Math.sin(g * 1.9);
  const swing = Math.sin((g * TAU) / 61) * 0.7 + Math.sin((g * TAU) / 17 + 0.4) * 0.3;
  let from = (config.fromDeg + weather.offsetDeg + region.bendDeg + swing * config.shiftDeg) * DEG;
  // Wind zones (decision 0140) bend, weaken or steady the wandering wind where the map has them.
  const zone = config.zones
    ? zoneEffectAt(config.zones, seed, t, pos.x, pos.y, from, config.easiest, zoneScratch)
    : NO_ZONE;
  from += zone.turn;
  let speedKn =
    config.speedKn *
    weather.strength *
    region.strength *
    zone.strength *
    (1 + gust * config.gustiness * weather.gusts * zone.gusts);

  // Storms (decision 0067): the wind turns to circle the centre and blows much harder. A stormy
  // coast breeds more of them (0140).
  let storms = config.weather?.storms
    ? stormsAt(config.weather.storms, seed, t, config.stormsFrom, config.seaRadius)
    : NO_STORMS;
  if (config.zones && config.weather?.storms) {
    const born = zoneStormsAt(
      config.zones,
      config.weather.storms,
      seed,
      t,
      config.stormsFrom,
      config.seaRadius ?? DEFAULT_SEA_RADIUS,
    );
    if (config.stormBelt)
      beltSquallsAt(
        config.zones,
        seed,
        t,
        Math.max(config.stormsFrom ?? 0, config.beltFrom ?? 0),
        config.stormBelt,
        born,
      );
    if (born.length) storms = [...storms, ...born];
  }
  let storm = 0;
  for (const s of storms) {
    const k = stormStrength(s, pos.x, pos.y);
    if (k <= 0) continue;
    const turn = wrapAngle(stormWindFrom(s, pos.x, pos.y) - from);
    from += turn * Math.min(1, k * 1.1);
    speedKn *= 1 + TUNING.weather.storms.windGain * k;
    storm = Math.max(storm, k);
  }
  if (out) {
    out.kind = weather.kind;
    out.rain = Math.max(weather.rain, storm);
    out.showers = weather.rain;
    out.gloom = weather.gloom;
    out.storm = storm;
    out.storms = storms;
    out.zone = zone.zone;
    out.zoneWeight = zone.weight;
  }
  return { from: wrapPositive(from), speedKn };
}

/** Compass bearing the wind blows TOWARD. */
export function windTo(wind: Wind): number {
  return wrapPositive(wind.from + Math.PI);
}

// --- Islands change the wind: lee shadow and flank funnel (decision 0027) -----------------------------------------------

/*
 * `src/data/tuning/weather.json` › `islands` (decision 0094): `shadowLength`, how far downwind
 * (units) an island still calms the wind; `shadowDepth`, the largest share of the wind a tall
 * island takes away right behind its shore; `shadowSpreadDeg`, ray spread either side of straight
 * upwind, so the lee fades in instead of switching on; `funnelGain`, the largest boost beside an
 * island's flank (a narrow channel between two islands gets it fully); `funnelReach`, how far to
 * the side (units) land still speeds the wind up. A storm core adds `storms.windGain` to the wind
 * (×1.9 at full force).
 */
const islandWind = () => TUNING.weather.islands;
/** Sample spacing along each upwind ray (units). */
const SHADOW_STEP = 7;

/** Land that blocks wind: high islands only; flat sandbanks let it through. */
export interface WindBlocker {
  /** 0..1: how much this land shelters (small rocks less than wooded highlands). */
  height: number;
  /** Bounding circle for a cheap early-out. */
  x: number;
  y: number;
  r: number;
  outline?: TerrainDef['outline'];
}

export function windBlockers(
  islands: readonly IslandDef[],
  terrain: readonly TerrainDef[] = [],
): WindBlocker[] {
  const out: WindBlocker[] = islands.flatMap((i) => {
    const coasts = islandCoasts(i);
    if (coasts)
      return coasts.map((outline, index) => {
        const x = outline.reduce((n, p) => n + p[0], 0) / outline.length;
        const y = outline.reduce((n, p) => n + p[1], 0) / outline.length;
        const r = Math.max(...outline.map((p) => Math.hypot(p[0] - x, p[1] - y)));
        return {
          height: index
            ? clamp(r / 18, 0.2, 0.6)
            : i.look?.profile === 'stone'
              ? 1
              : i.look?.profile === 'timber'
                ? 0.9
                : i.look?.profile === 'grain'
                  ? 0.3
                  : 0.65,
          x,
          y,
          r,
          outline,
        };
      });
    return [
      {
        height:
          clamp(i.radius / 18, 0.35, 1) * clamp(1 + 0.1 * ((i.look?.layers ?? 1) - 1), 1, 1.3),
        x: i.x,
        y: i.y,
        r: i.radius,
      },
    ];
  });
  for (const t of terrain) {
    if (t.kind !== 'island' || t.outline.length < 3) continue;
    let cx = 0,
      cy = 0;
    for (const [x, y] of t.outline) {
      cx += x;
      cy += y;
    }
    cx /= t.outline.length;
    cy /= t.outline.length;
    const r = Math.max(...t.outline.map(([x, y]) => Math.hypot(x - cx, y - cy)));
    out.push({ height: 1, x: cx, y: cy, r, outline: t.outline });
  }
  return out;
}

function isLand(b: WindBlocker, x: number, y: number): boolean {
  const dx = x - b.x,
    dy = y - b.y;
  if (dx * dx + dy * dy > b.r * b.r) return false;
  return b.outline ? coastDistance(x, y, b.outline).distance < 0 : true;
}

/** Shelter along one upwind ray: the nearest land hit, fading with distance. */
function rayShelter(
  blockers: readonly WindBlocker[],
  x: number,
  y: number,
  dirX: number,
  dirY: number,
): number {
  const length = islandWind().shadowLength;
  for (let s = SHADOW_STEP; s <= length; s += SHADOW_STEP) {
    const px = x + dirX * s,
      py = y + dirY * s;
    let best = 0;
    for (const b of blockers) if (b.height > best && isLand(b, px, py)) best = b.height;
    if (best > 0) return best * (1 - (s - SHADOW_STEP) / length);
  }
  return 0;
}

const FUNNEL_STEP = 7;
/** Side rays, measured from straight upwind: ahead of the beam and abeam. */
const FUNNEL_ANGLES = [60 * DEG, 90 * DEG];

/** 0..1: how close land is on one side (nearest hit over the side rays). */
function sideProximity(
  blockers: readonly WindBlocker[],
  pos: { x: number; y: number },
  from: number,
  side: 1 | -1,
): number {
  let best = 0;
  const reach = islandWind().funnelReach;
  for (const angle of FUNNEL_ANGLES) {
    const d = bearingVector(from + side * angle);
    for (let s = FUNNEL_STEP; s <= reach; s += FUNNEL_STEP) {
      const px = pos.x + d.x * s,
        py = pos.y + d.y * s;
      let h = 0;
      for (const b of blockers) if (b.height > h && isLand(b, px, py)) h = b.height;
      if (h > 0) {
        best = Math.max(best, h * (1 - (s - FUNNEL_STEP) / reach));
        break;
      }
    }
  }
  return best;
}

export interface WindEffect {
  /** 0 = open sea … 1 = right behind a tall island. */
  shelter: number;
  /** 0 = no effect … 1 = squeezed between two islands; wind speeds up along flanks. */
  funnel: number;
}

/**
 * How islands change the wind at a sea position (decision 0027): calm in their lee, a little
 * stronger along their sides and in channels. A few short rays, a few hundred point checks at
 * most: cheap enough for every frame on a tablet.
 */
export function windEffectAt(
  land: readonly WindBlocker[] | SpatialGrid<WindBlocker>,
  pos: { x: number; y: number },
  wind: Wind,
): WindEffect {
  const blockers = land instanceof SpatialGrid ? nearbyBlockers(land, pos) : land;
  let total = 0;
  const spreadAngle = islandWind().shadowSpreadDeg * DEG;
  for (const spread of [-spreadAngle, 0, spreadAngle]) {
    const d = bearingVector(wind.from + spread);
    total += rayShelter(blockers, pos.x, pos.y, d.x, d.y);
  }
  const shelter = clamp(total / 3, 0, 1);
  // One flank speeds the wind up a little; land on both sides (a channel) up to the full gain.
  const left = sideProximity(blockers, pos, wind.from, -1);
  const right = sideProximity(blockers, pos, wind.from, 1);
  const funnel = clamp(
    (Math.max(left, right) * 0.5 + Math.min(left, right) * 0.5) * (1 - shelter),
    0,
    1,
  );
  return { shelter, funnel };
}

/** The wind blockers of a map in a grid, so `windEffectAt` only checks land within reach (0117). */
export function windGrid(blockers: readonly WindBlocker[]): SpatialGrid<WindBlocker> {
  return new SpatialGrid(blockers);
}

const nearby: WindBlocker[] = [];
/**
 * Blockers any ray sample could touch: every sample lies within the longer of the shadow and
 * funnel reach of the boat, and a blocker only counts inside its own circle. One unit of slack
 * covers rounding in the ray steps; an extra blocker never changes the result, a missing one would.
 */
function nearbyBlockers(grid: SpatialGrid<WindBlocker>, pos: { x: number; y: number }) {
  const reach = Math.max(islandWind().shadowLength, islandWind().funnelReach) + 1;
  return grid.near(pos.x, pos.y, reach, nearby);
}

/** Shelter only (0..1); see `windEffectAt`. */
export function shelterAt(
  blockers: readonly WindBlocker[] | SpatialGrid<WindBlocker>,
  pos: { x: number; y: number },
  wind: Wind,
) {
  return windEffectAt(blockers, pos, wind).shelter;
}

/** The wind a boat feels: the sea wind, weakened in the lee and stronger along flanks. */
export function localWind(sea: Wind, effect: WindEffect): Wind {
  return {
    from: sea.from,
    speedKn:
      sea.speedKn *
      (1 - islandWind().shadowDepth * effect.shelter) *
      (1 + islandWind().funnelGain * effect.funnel),
  };
}
