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

// --- Wind shadow behind islands (decision 0027) -----------------------------------------------

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

/**
 * How sheltered a sea position is from `wind`, 0 (open sea) .. 1 (right behind a tall island).
 * Three short upwind rays: a few dozen point checks, cheap enough for every frame on a tablet.
 */
export function shelterAt(
  blockers: readonly WindBlocker[],
  pos: { x: number; y: number },
  wind: Wind,
) {
  let total = 0;
  for (const spread of [-SHADOW_SPREAD, 0, SHADOW_SPREAD]) {
    const d = bearingVector(wind.from + spread);
    total += rayShelter(blockers, pos.x, pos.y, d.x, d.y);
  }
  return clamp(total / 3, 0, 1);
}

/** The wind a boat feels at `pos`: the sea wind, weakened in the lee of islands. */
export function localWind(sea: Wind, shelter: number): Wind {
  return { from: sea.from, speedKn: sea.speedKn * (1 - SHADOW_DEPTH * shelter) };
}
