import { DEG, TAU, clamp } from './math';
import { createRng } from './rng';

/**
 * Moving storms (decision 0066): now and then a storm cell crosses the sea on a straight track,
 * slower than a boat so it can be dodged. Inside it the wind spins round its centre and blows much
 * harder, rain pours and loose cargo gets soaked. Like the rest of the weather, storms are a pure
 * function of the map seed and time, so nothing is saved.
 */
export interface StormConfig {
  /** One storm starts in each stretch of this many seconds, late in the stretch. */
  everySec: number;
  /** Radius (map units) of the storm's reach; the core is the inner third. */
  radius: number;
  /** Track speed in map units per second (a sloop at 8 kn sails 12.8). */
  speed: number;
  /** Radius of the sea the storms cross (the map's `boundsRadius`). */
  areaRadius: number;
}

export interface Storm {
  id: number;
  x: number;
  y: number;
  radius: number;
  /** 0..1: grows as it forms and fades as it leaves. */
  intensity: number;
  /** Direction of travel, unit vector (sim x east, y north). */
  dx: number;
  dy: number;
}

/** Share of the radius that is the core, where the storm is at full force. */
export const STORM_CORE = 0.35;
/** Seconds a storm takes to build up and to die down. */
const STORM_RAMP = 60;

interface Track {
  start: number;
  end: number;
  sx: number;
  sy: number;
  dx: number;
  dy: number;
  strength: number;
}

function track(config: StormConfig, seed: number, k: number): Track {
  const rng = createRng((seed ^ Math.imul(k + 1, 0x27d4eb2d) ^ 0x5bd1e995) >>> 0);
  // Start somewhere in the second half of stretch k, so storms never overlap at the map edge.
  const start = (k + 0.5 + 0.4 * rng()) * config.everySec;
  const a = rng() * TAU;
  const r0 = config.areaRadius + config.radius * 0.5;
  const sx = Math.sin(a) * r0,
    sy = Math.cos(a) * r0;
  // Aim at a point in the middle half of the sea, so it crosses the islands rather than skims.
  const ta = rng() * TAU,
    tr = rng() * config.areaRadius * 0.5;
  const tx = Math.sin(ta) * tr - sx,
    ty = Math.cos(ta) * tr - sy;
  const half = Math.hypot(tx, ty);
  return {
    start,
    end: start + (2 * half) / config.speed,
    sx,
    sy,
    dx: tx / half,
    dy: ty / half,
    strength: 0.8 + 0.2 * rng(),
  };
}

/** Storms on the sea at time `t` (usually none or one). */
export function stormsAt(config: StormConfig, seed: number, t: number): Storm[] {
  const out: Storm[] = [];
  const now = Math.floor(t / config.everySec);
  // A storm lasts well under two stretches, so only the last few can still be out.
  for (let k = Math.max(0, now - 2); k <= now; k++) {
    const tr = track(config, seed, k);
    if (t < tr.start || t > tr.end) continue;
    const age = t - tr.start;
    const ramp = clamp(Math.min(age, tr.end - t) / STORM_RAMP, 0, 1);
    out.push({
      id: k,
      x: tr.sx + tr.dx * config.speed * age,
      y: tr.sy + tr.dy * config.speed * age,
      radius: config.radius,
      intensity: tr.strength * ramp * ramp * (3 - 2 * ramp),
      dx: tr.dx,
      dy: tr.dy,
    });
  }
  return out;
}

/** 0..1: how hard a storm hits at this spot (full in the core, fading to its edge). */
export function stormStrength(storm: Storm, x: number, y: number): number {
  const d = Math.hypot(x - storm.x, y - storm.y) / storm.radius;
  if (d >= 1) return 0;
  const k = clamp((1 - d) / (1 - STORM_CORE), 0, 1);
  return storm.intensity * k * k * (3 - 2 * k);
}

/** 0..1: rain under the storm cloud, wider than its strong winds so the downpour arrives first. */
export function stormRain(storm: Storm, x: number, y: number): number {
  const d = Math.hypot(x - storm.x, y - storm.y) / storm.radius;
  const k = clamp((1 - d) / 0.35, 0, 1);
  return storm.intensity * k * k * (3 - 2 * k);
}

/** Inflow angle: storm wind spirals in toward the centre rather than going round in circles. */
const INFLOW = 20 * DEG;

/**
 * Bearing the storm wind blows FROM at a spot: it circles the centre anticlockwise (seen from
 * above, like a northern low) and spirals a little inward.
 */
export function stormWindFrom(storm: Storm, x: number, y: number): number {
  const rx = x - storm.x,
    ry = y - storm.y;
  const d = Math.max(1, Math.hypot(rx, ry));
  // Anticlockwise tangent, turned toward the centre.
  const tx = -ry / d,
    ty = rx / d;
  const c = Math.cos(INFLOW),
    s = Math.sin(INFLOW);
  const toX = tx * c - (rx / d) * s,
    toY = ty * c - (ry / d) * s;
  // FROM is the opposite of the way it blows.
  return Math.atan2(-toX, -toY);
}
