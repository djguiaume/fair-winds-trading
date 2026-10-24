import { TUNING } from '../data/tuning';
import { DEG, TAU, clamp } from './math';
import { createRng } from './rng';

/**
 * Moving storms (decision 0067): now and then a storm cell crosses the sea on a straight track,
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
  /** Share of the sea's radius (the map's `boundsRadius`) that the storms cross. */
  areaShare: number;
  /**
   * Sea radius that gets one storm per stretch; a bigger sea has proportionally more out at once,
   * so a captain meets them as often on any map size (decision 0115).
   */
  perRadius: number;
}

/** Sea radius for a wind without a map (tests, the model sheet): the Windward Ring's. */
export const DEFAULT_SEA_RADIUS = 440;

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
  /** A storm belt's squall (decision 0167): the belt's HUD line warns of it, not a toast. */
  squall?: boolean;
}

/*
 * `src/data/tuning/weather.json` › `storms` (decision 0094): `coreShare` of the radius is the
 * core, where the storm is at full force; it takes `rampSec` seconds to build up and to die down;
 * its wind spirals in toward the centre at `inflowDeg` rather than going round in circles.
 */
const stormTuning = () => TUNING.weather.storms;

interface Track {
  start: number;
  end: number;
  sx: number;
  sy: number;
  dx: number;
  dy: number;
  strength: number;
}

/** How many storms form in each stretch on a sea of this radius (one lane each). */
function lanes(config: StormConfig, seaRadius: number) {
  return Math.max(1, Math.round(seaRadius / config.perRadius));
}

function track(config: StormConfig, seed: number, k: number, area: number, lane: number): Track {
  // Lane 0 keeps the tracks storms always had; more lanes on bigger seas get their own seeds.
  const laneSeed = lane ? Math.imul(lane, 0x68e31da4) : 0;
  const rng = createRng((seed ^ Math.imul(k + 1, 0x27d4eb2d) ^ 0x5bd1e995 ^ laneSeed) >>> 0);
  // Start somewhere in the second half of stretch k, so storms never overlap at the map edge.
  const start = (k + 0.5 + 0.4 * rng()) * config.everySec;
  const a = rng() * TAU;
  const r0 = area + config.radius * 0.5;
  const sx = Math.sin(a) * r0,
    sy = Math.cos(a) * r0;
  // Aim at a point in the middle half of the sea, so it crosses the islands rather than skims.
  const ta = rng() * TAU,
    tr = rng() * area * 0.5;
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

/**
 * Storms on the sea at time `t` (usually none or one). Only storms that formed at or after `from`
 * count, so storms held back for a while (decision 0072) never pop up mid-sea when let go.
 */
export function stormsAt(
  config: StormConfig,
  seed: number,
  t: number,
  from = 0,
  seaRadius = DEFAULT_SEA_RADIUS,
): Storm[] {
  const out: Storm[] = [];
  const area = seaRadius * config.areaShare;
  const n = lanes(config, seaRadius);
  const now = Math.floor(t / config.everySec);
  // The longest crossing (edge to the far side of the middle half) says how many stretches back a
  // storm can still be out: two on today's sea, more on a bigger one or with slow storms.
  const longest = (2 * (area * 1.5 + config.radius * 0.5)) / config.speed;
  const back = Math.ceil(longest / config.everySec) + 1;
  for (let k = Math.max(0, now - back); k <= now; k++)
    for (let lane = 0; lane < n; lane++) {
      const tr = track(config, seed, k, area, lane);
      if (t < tr.start || t > tr.end || tr.start < from) continue;
      const age = t - tr.start;
      const ramp = clamp(Math.min(age, tr.end - t) / stormTuning().rampSec, 0, 1);
      out.push({
        // Lane 0 keeps the ids storms always had.
        id: k + lane * 1_000_000,
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
  const k = clamp((1 - d) / (1 - stormTuning().coreShare), 0, 1);
  return storm.intensity * k * k * (3 - 2 * k);
}

/** 0..1: rain under the storm cloud, wider than its strong winds so the downpour arrives first. */
export function stormRain(storm: Storm, x: number, y: number): number {
  const d = Math.hypot(x - storm.x, y - storm.y) / storm.radius;
  const k = clamp((1 - d) / 0.35, 0, 1);
  return storm.intensity * k * k * (3 - 2 * k);
}

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
  const inflow = stormTuning().inflowDeg * DEG;
  const c = Math.cos(inflow),
    s = Math.sin(inflow);
  const toX = tx * c - (rx / d) * s,
    toY = ty * c - (ry / d) * s;
  // FROM is the opposite of the way it blows.
  return Math.atan2(-toX, -toY);
}
