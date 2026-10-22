import { coastDistance } from './coast';
import type { IslandDef, TerrainDef } from './map';
import { DEG, TAU, bearingVector, clamp, wrapPositive } from './math';
import { createRng } from './rng';

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
  /** Strength multipliers [min, max] applied to `speedKn`. */
  strength: [number, number];
  /** The wind differs across the sea at the same moment (decision 0064); none = one wind everywhere. */
  regions?: RegionConfig;
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
}

/**
 * Phase 2 weather: a new wind every 3 minutes that wanders round the compass, and regions of the
 * sea where it blows from a different angle at the same moment.
 */
export const DEFAULT_WEATHER: WeatherConfig = {
  periodSec: 180,
  blendSec: 60,
  stepDeg: 75,
  revert: 0.12,
  strength: [0.8, 1.15],
  regions: { bendDeg: 40, strength: 0.15, sizeUnits: 400, driftSec: 900 },
};

interface Slot {
  offsetDeg: number;
  strength: number;
}

/** Offsets of every period so far, per seed and config: the walk is a running sum. */
const walks = new WeakMap<WeatherConfig, Map<number, Slot[]>>();

function slotRng(seed: number, slot: number) {
  return createRng((seed ^ Math.imul(slot, 0x9e3779b1)) >>> 0);
}

/** The weather of one period: offset from the prevailing direction (deg) and strength factor. */
export function weatherSlot(weather: WeatherConfig, seed: number, slot: number): Slot {
  // Slot 0 is the prevailing wind, so a fresh voyage starts in the map's designed breeze.
  if (slot <= 0) return { offsetDeg: 0, strength: 1 };
  let bySeed = walks.get(weather);
  if (!bySeed) walks.set(weather, (bySeed = new Map()));
  let walk = bySeed.get(seed);
  if (!walk) bySeed.set(seed, (walk = [{ offsetDeg: 0, strength: 1 }]));
  const [lo, hi] = weather.strength;
  // A random walk: each period veers or backs from the last one, so the wind can swing right
  // round over a long voyage instead of staying in one quarter of the compass.
  for (let k = walk.length; k <= slot; k++) {
    const rng = slotRng(seed, k);
    const step = (rng() * 2 - 1) * weather.stepDeg;
    const strength = lo + (hi - lo) * rng();
    const offset = walk[k - 1]!.offsetDeg * (1 - weather.revert) + step;
    // Keep the offset in -180..180 so easing between periods always takes the short way round.
    walk.push({ offsetDeg: ((((offset + 180) % 360) + 360) % 360) - 180, strength });
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
  return {
    offsetDeg: before.offsetDeg + turn * s,
    strength: before.strength + (now.strength - before.strength) * s,
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

/**
 * Sea wind at time `t` (seconds) and position `pos`, away from any island. Deterministic: slow
 * weather periods, regions where it bends, plus a sum of slow sines for gusts and a small
 * direction swing so the sea feels alive.
 */
export function windAt(
  config: WindConfig,
  t: number,
  seed = 0,
  pos: { x: number; y: number } = { x: 0, y: 0 },
): Wind {
  const weather = config.weather
    ? weatherAt(config.weather, seed, t)
    : { offsetDeg: 0, strength: 1 };
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
  return {
    from: wrapPositive(
      (config.fromDeg + weather.offsetDeg + region.bendDeg + swing * config.shiftDeg) * DEG,
    ),
    speedKn: config.speedKn * weather.strength * region.strength * (1 + gust * config.gustiness),
  };
}

/** Compass bearing the wind blows TOWARD. */
export function windTo(wind: Wind): number {
  return wrapPositive(wind.from + Math.PI);
}

// --- Islands change the wind: lee shadow and flank funnel (decision 0027) -----------------------------------------------

/** How far downwind (units) an island still calms the wind. */
export const SHADOW_LENGTH = 70;
/** Largest share of the wind a tall island takes away right behind its shore. */
export const SHADOW_DEPTH = 0.55;
/** Sample spacing along each upwind ray (units). */
const SHADOW_STEP = 7;
/** Ray spread either side of straight upwind, so the lee fades in instead of switching on. */
const SHADOW_SPREAD = 10 * DEG;

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
  const out: WindBlocker[] = islands.map((i) => ({
    height: clamp(i.radius / 18, 0.35, 1) * clamp(1 + 0.1 * ((i.look?.layers ?? 1) - 1), 1, 1.3),
    x: i.x,
    y: i.y,
    r: i.radius,
  }));
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
  for (let s = SHADOW_STEP; s <= SHADOW_LENGTH; s += SHADOW_STEP) {
    const px = x + dirX * s,
      py = y + dirY * s;
    let best = 0;
    for (const b of blockers) if (b.height > best && isLand(b, px, py)) best = b.height;
    if (best > 0) return best * (1 - (s - SHADOW_STEP) / SHADOW_LENGTH);
  }
  return 0;
}

/** Largest boost beside an island's flank; a narrow channel between two islands gets it fully. */
export const FUNNEL_GAIN = 0.2;
/** How far to the side (units) land still speeds the wind up. */
const FUNNEL_REACH = 28;
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
  for (const angle of FUNNEL_ANGLES) {
    const d = bearingVector(from + side * angle);
    for (let s = FUNNEL_STEP; s <= FUNNEL_REACH; s += FUNNEL_STEP) {
      const px = pos.x + d.x * s,
        py = pos.y + d.y * s;
      let h = 0;
      for (const b of blockers) if (b.height > h && isLand(b, px, py)) h = b.height;
      if (h > 0) {
        best = Math.max(best, h * (1 - (s - FUNNEL_STEP) / FUNNEL_REACH));
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
  blockers: readonly WindBlocker[],
  pos: { x: number; y: number },
  wind: Wind,
): WindEffect {
  let total = 0;
  for (const spread of [-SHADOW_SPREAD, 0, SHADOW_SPREAD]) {
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

/** Shelter only (0..1); see `windEffectAt`. */
export function shelterAt(
  blockers: readonly WindBlocker[],
  pos: { x: number; y: number },
  wind: Wind,
) {
  return windEffectAt(blockers, pos, wind).shelter;
}

/** The wind a boat feels: the sea wind, weakened in the lee and stronger along flanks. */
export function localWind(sea: Wind, effect: WindEffect): Wind {
  return {
    from: sea.from,
    speedKn: sea.speedKn * (1 - SHADOW_DEPTH * effect.shelter) * (1 + FUNNEL_GAIN * effect.funnel),
  };
}
