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
 * Slow weather (decision 0026): every `periodSec` the sea wind settles on a new direction within
 * ±`rangeDeg` of the map's prevailing wind and a new strength in `strength`, easing across over
 * the first `blendSec`. Deterministic from the map seed, so a voyage resumes in the same weather.
 */
export interface WeatherConfig {
  periodSec: number;
  blendSec: number;
  rangeDeg: number;
  /** Strength multipliers [min, max] applied to `speedKn`. */
  strength: [number, number];
}

/** Global wind settings for a map: one prevailing direction and strength for the whole sea. */
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

/** Phase 1 weather: a new wind every 3 minutes, so the same trip plays differently. */
export const DEFAULT_WEATHER: WeatherConfig = {
  periodSec: 180,
  blendSec: 60,
  rangeDeg: 50,
  strength: [0.8, 1.15],
};

/** The weather of one period: offset from the prevailing direction (deg) and strength factor. */
export function weatherSlot(weather: WeatherConfig, seed: number, slot: number) {
  // Slot 0 is the prevailing wind, so a fresh voyage starts in the map's designed breeze.
  if (slot <= 0) return { offsetDeg: 0, strength: 1 };
  const rng = createRng((seed ^ Math.imul(slot, 0x9e3779b1)) >>> 0);
  const offsetDeg = (rng() * 2 - 1) * weather.rangeDeg;
  const [lo, hi] = weather.strength;
  return { offsetDeg, strength: lo + (hi - lo) * rng() };
}

/** Weather in force at time `t`, eased from the previous period. */
export function weatherAt(weather: WeatherConfig, seed: number, t: number) {
  const slot = Math.floor(Math.max(0, t) / weather.periodSec);
  const now = weatherSlot(weather, seed, slot);
  const into = Math.max(0, t) - slot * weather.periodSec;
  if (slot === 0 || into >= weather.blendSec) return now;
  const before = weatherSlot(weather, seed, slot - 1);
  const k = into / weather.blendSec;
  const s = k * k * (3 - 2 * k);
  return {
    offsetDeg: before.offsetDeg + (now.offsetDeg - before.offsetDeg) * s,
    strength: before.strength + (now.strength - before.strength) * s,
  };
}

/**
 * Sea wind at time `t` (seconds), away from any island. Deterministic: slow weather periods, plus
 * a sum of slow sines for gusts and a small direction swing so the sea feels alive.
 */
export function windAt(config: WindConfig, t: number, seed = 0): Wind {
  const gust =
    0.6 * Math.sin((t * TAU) / 23) +
    0.3 * Math.sin((t * TAU) / 9.7 + 1.3) +
    0.1 * Math.sin(t * 1.9);
  const swing = Math.sin((t * TAU) / 61) * 0.7 + Math.sin((t * TAU) / 17 + 0.4) * 0.3;
  const weather = config.weather
    ? weatherAt(config.weather, seed, t)
    : { offsetDeg: 0, strength: 1 };
  return {
    from: wrapPositive((config.fromDeg + weather.offsetDeg + swing * config.shiftDeg) * DEG),
    speedKn: config.speedKn * weather.strength * (1 + gust * config.gustiness),
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
