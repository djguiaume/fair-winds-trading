import { TUNING } from '../data/tuning';
import { coastDistance } from './coast';
import { DEG, TAU, clamp, wrapAngle } from './math';
import { createRng } from './rng';
import { SpatialGrid } from './spatial';
import type { MapDef, WindZoneDef } from './map';
import type { Storm, StormConfig } from './storms';

export type { WindZoneDef };

/**
 * Wind zones (decision 0140): areas painted on the map where the wind blows differently, on top of
 * the wandering wind of decision 0064. A trade belt pulls it round to its heading and steadies it,
 * the doldrums all but kill it, a stormy coast makes it gusty and breeds storms, a cold gale blows
 * harder and steadier, and a sheltered water (a ring island's lagoon) keeps it light along one
 * axis. The map holds only the shapes; what each kind does lives in `weather.json` › `zones`.
 * Like the rest of the weather this is a pure function of the seed, the time and the place, so the
 * save does not change. Lookups only happen where a boat asks, through a `SpatialGrid` (0117).
 */

/**
 * What one kind does (`weather.json` › `zones.kinds.<kind>`). Every number is optional: a kind
 * without `strength` leaves the strength alone, and so on.
 */
export interface ZoneKind {
  /** Strength multiplier, or [min, max] that it wanders between in slow puffs. */
  strength?: number | [number, number];
  /** Gusts are this many times the open sea's. */
  gusts?: number;
  /** 0..1: share of the way the direction turns towards the zone's `headingDeg`. */
  pull?: number;
  /** Pull towards whichever end of the heading's axis is nearer (a lagoon open east and west). */
  axis?: boolean;
  /**
   * With `axis`: the wind keeps at least this share of its strength when the sea wind blows
   * straight across the axis (it is ×|cos| of the angle between them otherwise).
   */
  acrossFloor?: number;
  /** Extra slow swing of the direction, ± degrees (the doldrums' shifting puffs). */
  shiftDeg?: number;
  /** On the easiest level the strength never drops below this (the doldrums never strand you). */
  fairFloor?: number;
  /** 0..1: how glassy and pale its water looks (the doldrums' calm sea); 0 = like open sea. */
  glassy?: number;
  /** Storms are born inside it this many times as often as they cross open sea (1 = no extra). */
  stormBirth?: number;
  /** Short sight inside it: a fog bank, an ash cloud (decision 0169). */
  haze?: ZoneHaze;
  /** Its tint on the editor's map and the labelled chart, `#rrggbb`. */
  chart?: string;
}

/**
 * Short sight in a zone (decision 0169): the scene fog closes in and takes this colour as she
 * sails in. Only the look changes, never the wind, so it shows even with Settings › Wind zones off;
 * its own Settings switch (`switch`) turns it off.
 */
export interface ZoneHaze {
  /** Clear sight past the boat, in units: the fog starts here. */
  near: number;
  /** Nothing shows farther than this past the boat. */
  far: number;
  /** The fog's colour by day; night darkens it like the sky. */
  color: string;
  /** It thickens over this many units across the edge (left out: the zones' `fadeUnits`). */
  fade?: number;
  /** The Settings switch that turns it off (`fog`, `ash`); kinds may share one. */
  switch: string;
}

export interface ZonesTuning {
  /** The zone fades in over this many units, half outside its outline and half inside. */
  fadeUnits: number;
  kinds: Record<string, ZoneKind>;
}

/** The live zone numbers, `weather.json` › `zones` (decision 0094). */
export function zonesTuning(): ZonesTuning {
  return (TUNING.weather as unknown as { zones: ZonesTuning }).zones;
}

/** A zone ready for lookups: its outline, bounding circle (with the fade) and centre. */
interface PreparedZone {
  def: WindZoneDef;
  index: number;
  outline: [number, number][];
  /** Centre of the outline's bounding circle. */
  cx: number;
  cy: number;
  /** Bounding radius of the outline alone. */
  reach: number;
  /** Grid circle: the outline's reach plus half the fade. */
  x: number;
  y: number;
  r: number;
}

/** The zones of one map in a grid, built once per map and outline smoothing. */
export interface ZoneField {
  zones: readonly PreparedZone[];
  grid: SpatialGrid<PreparedZone>;
}

/** The wind zones of a map (its `windZones` list), or none. */
export function mapZones(map: MapDef): readonly WindZoneDef[] | undefined {
  return map.windZones;
}

let fields = new WeakMap<readonly WindZoneDef[], ZoneField>();

/** Forget prepared fields (the `?tune` panel changed `fadeUnits`, or the editor moved a point). */
export function clearZoneFields(): void {
  fields = new WeakMap();
}

/**
 * The map's zones in a grid; null when it has none, so a map without zones costs nothing.
 * `smooth` turns an authored outline into the one the game sails (the editor shows the same).
 */
export function zoneField(
  defs: readonly WindZoneDef[] | undefined,
  smooth: (outline: [number, number][]) => [number, number][] = (o) => o,
): ZoneField | null {
  if (!defs?.length) return null;
  const cached = fields.get(defs);
  if (cached) return cached;
  const { fadeUnits, kinds } = zonesTuning();
  const zones = defs
    .filter((d) => d.outline.length >= 3)
    .map((def, index): PreparedZone => {
      const outline = smooth(def.outline);
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      for (const [x, y] of outline) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      const cx = (x0 + x1) / 2,
        cy = (y0 + y1) / 2;
      const reach = Math.max(...outline.map(([x, y]) => Math.hypot(x - cx, y - cy)));
      const half = Math.max(fadeUnits, kinds[def.kind]?.haze?.fade ?? 0) / 2;
      return { def, index, outline, cx, cy, reach, x: cx, y: cy, r: reach + half };
    });
  const field = { zones, grid: new SpatialGrid(zones) };
  fields.set(defs, field);
  return field;
}

/** A number of a zone's kind, with the zone's own override. */
function value<K extends keyof ZoneKind>(zone: WindZoneDef, kind: ZoneKind, key: K): ZoneKind[K] {
  const own = zone.tune?.[key];
  return (own ?? kind[key]) as ZoneKind[K];
}

/** 0..1: how much a zone counts at a spot, easing in across its edge (`fade` units wide). */
function weightAt(
  zone: PreparedZone,
  x: number,
  y: number,
  fade = zonesTuning().fadeUnits,
): number {
  const d = coastDistance(x, y, zone.outline).distance;
  const k = clamp((fade / 2 - d) / Math.max(1, fade), 0, 1);
  return k * k * (3 - 2 * k);
}

/** How the zones change the wind at one spot. Identity values mean "no zone here". */
export interface ZoneEffect {
  /** Multiplies the wind strength. */
  strength: number;
  /** Multiplies the gusts. */
  gusts: number;
  /** Radians added to the direction the wind blows from. */
  turn: number;
  /** Id of the zone that counts most here, or null at open sea. */
  zone: string | null;
  /** Weight of that zone, 0..1. */
  weight: number;
}

export const NO_ZONE: Readonly<ZoneEffect> = {
  strength: 1,
  gusts: 1,
  turn: 0,
  zone: null,
  weight: 0,
};

const nearby: PreparedZone[] = [];

/**
 * The zones' effect at (x, y) at time `t`, for a wind blowing from `from` (radians). `floor`
 * bounds how far the zones may weaken the wind (the easiest level's `fairFloor`; 0 = none). Two
 * overlapping zones both count, each by its weight.
 */
export function zoneEffectAt(
  field: ZoneField,
  seed: number,
  t: number,
  x: number,
  y: number,
  from: number,
  easiest = false,
  out: ZoneEffect = { ...NO_ZONE },
  mean = false,
): ZoneEffect {
  out.strength = 1;
  out.gusts = 1;
  out.turn = 0;
  out.zone = null;
  out.weight = 0;
  const kinds = zonesTuning().kinds;
  let floor = 0;
  for (const z of field.grid.near(x, y, 0, nearby)) {
    const kind = kinds[z.def.kind];
    if (!kind) continue;
    const w = weightAt(z, x, y);
    if (w <= 0) continue;
    if (w > out.weight) {
      out.weight = w;
      out.zone = z.def.id;
    }
    const strength = value(z.def, kind, 'strength');
    if (strength !== undefined) {
      const s = !Array.isArray(strength)
        ? strength
        : mean
          ? (strength[0] + strength[1]) / 2
          : puffs(strength, seed, z.index, t, x, y);
      out.strength *= 1 + (s - 1) * w;
    }
    const gusts = value(z.def, kind, 'gusts');
    if (gusts !== undefined) out.gusts *= 1 + (gusts - 1) * w;
    const pull = value(z.def, kind, 'pull');
    if (pull && z.def.headingDeg !== undefined) {
      let target = z.def.headingDeg * DEG;
      const now = from + out.turn;
      let share = clamp(pull, 0, 1);
      if (value(z.def, kind, 'axis')) {
        // A sheltered axis lets the wind through either way: aim for the nearer end. The pull
        // and the strength both ease off as the sea wind comes round to blow straight across,
        // so the flip from one end to the other happens in a near calm, never as a sudden swing.
        if (Math.abs(wrapAngle(target - now)) > Math.PI / 2) target += Math.PI;
        const along = Math.abs(Math.cos(target - now));
        share *= along;
        const across = value(z.def, kind, 'acrossFloor') ?? 0;
        out.strength *= 1 + (Math.max(across, along) - 1) * w;
      }
      out.turn += wrapAngle(target - now) * share * w;
    }
    const shift = value(z.def, kind, 'shiftDeg');
    if (shift && !mean) out.turn += shiftAt(seed, z.index, t, x, y) * shift * DEG * w;
    const fair = value(z.def, kind, 'fairFloor');
    if (easiest && fair) floor = Math.max(floor, 1 + (fair - 1) * w);
  }
  if (floor > 0 && out.strength < floor) out.strength = floor;
  return out;
}

/**
 * The zones' average effect at a spot, without the puffs and shifts of the moment: what the route
 * and balance checks plan with (decisions 0114, 0140).
 */
export function zoneMeanAt(
  field: ZoneField,
  x: number,
  y: number,
  from: number,
  easiest = false,
  out: ZoneEffect = { ...NO_ZONE },
): ZoneEffect {
  return zoneEffectAt(field, 0, 0, x, y, from, easiest, out, true);
}

/** The largest strength factor any zone of the field can give: keeps route estimates optimistic. */
export function zoneMaxGain(field: ZoneField): number {
  const kinds = zonesTuning().kinds;
  let gain = 1;
  for (const z of field.zones) {
    const kind = kinds[z.def.kind];
    const s = kind && value(z.def, kind, 'strength');
    if (s !== undefined) gain = Math.max(gain, ...(Array.isArray(s) ? s : [s]));
  }
  return gain;
}

/** A strength that wanders slowly between `lo` and `hi`, different in different spots: light puffs. */
function puffs(
  [lo, hi]: [number, number],
  seed: number,
  index: number,
  t: number,
  x: number,
  y: number,
) {
  const p = ((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0) / 0xffffffff;
  const k =
    0.5 +
    0.3 * Math.sin((t * TAU) / 47 + p * TAU + x * 0.013) +
    0.2 * Math.sin((t * TAU) / 19 + p * 11 + y * 0.017);
  return lo + (hi - lo) * clamp(k, 0, 1);
}

/** -1..1: the slow, place-dependent swing of a shifting zone's direction. */
function shiftAt(seed: number, index: number, t: number, x: number, y: number) {
  const p = ((seed * 0x85ebca6b) ^ Math.imul(index + 7, 0x27d4eb2d)) >>> 0;
  const ph = (p / 0xffffffff) * TAU;
  return (
    0.65 * Math.sin((t * TAU) / 73 + ph + x * 0.009) +
    0.35 * Math.sin((t * TAU) / 29 + ph * 3 - y * 0.011)
  );
}

// --- Haze: fog banks and ash clouds (decision 0169) ---------------------------------------------

/** The zones' look at one spot: how hazy, and the haze that counts most. */
export interface ZoneVisual {
  /** 0..1: how far into the haziest zone, eased across its fade. 0 = clear. */
  haze: number;
  /** That zone's haze (its kind's, with the zone's own `tune.haze`), or null when clear. */
  kind: ZoneHaze | null;
  /** Id of that zone, for charting it once sailed. */
  zone: string | null;
}

export const CLEAR: Readonly<ZoneVisual> = { haze: 0, kind: null, zone: null };

/**
 * The haze at (x, y). `off` lists the Settings switches turned off (`fog`, `ash`): their zones
 * stay clear. Wind effects are not looked at here, so it works with Settings › Wind zones off.
 */
export function zoneVisualAt(
  field: ZoneField,
  x: number,
  y: number,
  off: readonly string[] = [],
  out: ZoneVisual = { ...CLEAR },
): ZoneVisual {
  out.haze = 0;
  out.kind = null;
  out.zone = null;
  const kinds = zonesTuning().kinds;
  for (const z of field.grid.near(x, y, 0, nearby)) {
    const kind = kinds[z.def.kind];
    const haze = kind && (value(z.def, kind, 'haze') as ZoneHaze | undefined);
    if (!haze || off.includes(haze.switch)) continue;
    const w = weightAt(z, x, y, haze.fade ?? zonesTuning().fadeUnits);
    if (w <= out.haze) continue;
    out.haze = w;
    out.kind = haze;
    out.zone = z.def.id;
  }
  return out;
}

/** Every Settings switch the zone kinds name, in `weather.json` order: one Settings row each. */
export function hazeSwitches(): string[] {
  const out: string[] = [];
  for (const kind of Object.values(zonesTuning().kinds))
    if (kind.haze?.switch && !out.includes(kind.haze.switch)) out.push(kind.haze.switch);
  return out;
}

/** Is this zone's haze on: its kind has one and that switch is not off? */
export function zoneHazy(zone: WindZoneDef, off: readonly string[] = []): boolean {
  const haze = zonesTuning().kinds[zone.kind]?.haze;
  return !!haze && !off.includes(haze.switch);
}

// --- Storms born on a stormy coast (decision 0140) ----------------------------------------------

/** Ids of zone-born storms start here, clear of the sea-crossing storms' ids. */
const ZONE_STORM_IDS = 2_000_000;
/** Room for this many storms per zone before ids would run into the next zone's. */
const PER_ZONE = 100_000;

/**
 * Storms born inside zones whose kind has `stormBirth` above 1, on top of the storms that cross the
 * sea. They form on the spot (the usual ramp), drift across the zone and die out, so a stormy
 * coast sees about `stormBirth` times as many storms as open sea of the same size. A pure function
 * of the seed and the time, like the crossing storms; only storms born at or after `from` count.
 */
export function zoneStormsAt(
  field: ZoneField,
  config: StormConfig,
  seed: number,
  t: number,
  from = 0,
  seaRadius: number,
  out: Storm[] = [],
): Storm[] {
  const kinds = zonesTuning().kinds;
  const area = seaRadius * config.areaShare;
  const lanes = Math.max(1, Math.round(seaRadius / config.perRadius));
  const ramp = TUNING.weather.storms.rampSec;
  for (const z of field.zones) {
    const kind = kinds[z.def.kind];
    const birth = kind ? value(z.def, kind, 'stormBirth') : undefined;
    if (!birth || birth <= 1) continue;
    // How often a crossing storm touches this zone: its track sweeps a band two storm radii wide
    // across the middle of the sea, so the share of tracks that meet the zone grows with its size.
    const touch = Math.min(1, ((z.reach + config.radius) * 4) / (Math.PI * Math.max(1, area)));
    const rate = ((birth - 1) * lanes * touch) / config.everySec;
    if (rate <= 0) continue;
    const every = 1 / rate;
    const life = (2 * z.reach) / config.speed;
    const now = Math.floor(t / every);
    const back = Math.ceil(life / every) + 1;
    for (let k = Math.max(0, now - back); k <= now; k++) {
      const rng = createRng(
        (seed ^ Math.imul(k + 1, 0x165667b1) ^ Math.imul(z.index + 1, 0xd3a2646c)) >>> 0,
      );
      const start = (k + 0.2 + 0.6 * rng()) * every;
      if (t < start || t > start + life || start < from) continue;
      // Born somewhere inside the outline (a few tries, else at its centre).
      let sx = z.cx,
        sy = z.cy;
      for (let i = 0; i < 8; i++) {
        const a = rng() * TAU,
          r = Math.sqrt(rng()) * z.reach;
        const px = z.cx + Math.sin(a) * r,
          py = z.cy + Math.cos(a) * r;
        if (coastDistance(px, py, z.outline).distance < 0) {
          sx = px;
          sy = py;
          break;
        }
      }
      const heading = rng() * TAU;
      const dx = Math.sin(heading),
        dy = Math.cos(heading);
      const age = t - start;
      const fade = clamp(Math.min(age, start + life - t) / ramp, 0, 1);
      out.push({
        id: ZONE_STORM_IDS + z.index * PER_ZONE + k,
        x: sx + dx * config.speed * age,
        y: sy + dy * config.speed * age,
        radius: config.radius,
        intensity: (0.8 + 0.2 * rng()) * fade * fade * (3 - 2 * fade),
        dx,
        dy,
      });
    }
  }
  return out;
}
