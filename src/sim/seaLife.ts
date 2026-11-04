import seaLifeFile from '../data/sea-life.json';

/*
 * Life at sea (issue #476): gulls and terns, dolphins, a whale and fish shoals, all drawn only
 * (the sim never meets them). What lives where, how many and how they move is
 * `src/data/sea-life.json`; this file holds the rules the view, the checks and the tests share,
 * without three.js.
 */

/** Where a flock of birds circles: over the nearest pier head, the nearest reef, or her wake. */
export type BirdHome = 'harbour' | 'reef' | 'wake';
export const BIRD_HOMES: readonly BirdHome[] = ['harbour', 'reef', 'wake'];

/** A pair of numbers: a random draw between them, or a lower and an upper bound. */
export type Span = [number, number];

export interface BirdKind {
  /** The prop recipe (`src/data/props/`) drawn for each bird. */
  model: string;
  count: number;
  /** Scale of the model. */
  size: number;
  /** The seas the flock lives in (`ring`, `north`, `east`, `south`, `west`). */
  seas: string[];
  home: BirdHome;
  /** A home is taken only this close to the boat, units; a wake home within this of a shore. */
  range: number;
  /** Radius of each bird's circle, units. */
  circle: Span;
  /** Height above the sea, units. */
  height: Span;
  /** Speed along the circle, units a second. */
  speed: number;
  /** Wing beats a second. */
  flapHz: number;
  /** Share of the time a bird glides on still wings, 0 to 1. */
  glide: number;
  /** Share of the flock still about at full night, 0 to 1. */
  night: number;
}

/** A place rule: the seas a creature lives in and its distance from the nearest shore, units. */
export interface Waters {
  seas: string[];
  shore: Span;
}

export interface DolphinsDef extends Waters {
  model: string;
  size: number;
  /** How many in a pod. */
  pod: Span;
  /** Seconds between two visits. */
  every: Span;
  /** Seconds a pod stays with the boat. */
  staySec: Span;
  /** How far abeam they swim, units. */
  side: Span;
  /** Their speed when the boat is slower, knots. */
  cruiseKn: number;
  /** One leap and dive, seconds; the share of it in the air; the leap's height, units. */
  jumpSec: number;
  airShare: number;
  jumpHeight: number;
}

export interface WhaleDef extends Waters {
  model: string;
  /** The blow's recipe. */
  spout: string;
  size: number;
  every: Span;
  /** One surfacing, from rising to the flukes going under, seconds. */
  surfaceSec: number;
  /** How far from the boat she surfaces, units. */
  fromBoat: Span;
  swimKn: number;
}

export interface ShoalsDef extends Waters {
  model: string;
  count: number;
  size: Span;
  /** A palette colour name. */
  color: string;
  opacity: number;
  /** How far from the boat a shoal is placed, units. */
  range: Span;
  driftKn: number;
  /** How fast the fish turn round the shoal's middle, radians a second. */
  swirl: number;
}

export interface SeaLifeData {
  /** Share of every count drawn at each quality level (`ultralow` … `ultra`): Ultra-low draws none. */
  quality: Record<string, number>;
  birds: Record<string, BirdKind>;
  dolphins: DolphinsDef;
  whale: WhaleDef;
  shoals: ShoalsDef;
}

export const SEA_LIFE: SeaLifeData = seaLifeFile as unknown as SeaLifeData;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** How many of `count` show at a quality level, fewer by night down to the `night` share. */
export function shownCount(count: number, qualityShare: number, night = 0, nightShare = 1): number {
  return Math.round(count * clamp01(qualityShare) * (1 - clamp01(night) * (1 - nightShare)));
}

/** Distance from (x, y) to the nearest island's beach, units (Infinity with no island). */
export function shoreDistance(
  islands: readonly { x: number; y: number; radius: number }[],
  x: number,
  y: number,
): number {
  let d = Infinity;
  for (const i of islands) d = Math.min(d, Math.hypot(i.x - x, i.y - y) - i.radius);
  return Math.max(0, d);
}

/** Whether a creature with these waters lives at a point in `sea`, `shore` units off the land. */
export function livesIn(waters: Waters, sea: string, shore: number): boolean {
  return waters.seas.includes(sea) && shore >= waters.shore[0] && shore <= waters.shore[1];
}

/** The index of the nearest point within `range` of (x, y), or -1. */
export function nearestWithin(
  points: readonly { x: number; y: number }[],
  x: number,
  y: number,
  range: number,
): number {
  let best = -1;
  let bestD = range;
  for (let k = 0; k < points.length; k++) {
    const d = Math.hypot(points[k]!.x - x, points[k]!.y - y);
    if (d <= bestD) {
      best = k;
      bestD = d;
    }
  }
  return best;
}

/** A height above (or below) the sea and a nose-up pitch, radians. Reused, never allocated. */
export interface Pose {
  lift: number;
  pitch: number;
}

/**
 * A dolphin's leap at `t` seconds (with its own `phase`, 0 to 1): an arc out of the water for
 * `airShare` of each `jumpSec`, nose up as it rises and down as it falls; under water between.
 */
export function porpoise(
  t: number,
  phase: number,
  def: Pick<DolphinsDef, 'jumpSec' | 'airShare' | 'jumpHeight'>,
  out: Pose,
): Pose {
  const u = (((t / def.jumpSec + phase) % 1) + 1) % 1;
  if (u >= def.airShare) {
    out.lift = -3;
    out.pitch = 0;
    return out;
  }
  const s = u / def.airShare;
  // From 1.2 under to `jumpHeight` over and back: the body clears the water in the middle.
  out.lift = -1.2 + (def.jumpHeight + 1.2) * Math.sin(Math.PI * s);
  out.pitch = 0.75 * Math.cos(Math.PI * s);
  return out;
}

/** The share of a surfacing the blow lasts, rising and fading. */
const SPOUT = { from: 0.08, to: 0.3 };

/**
 * A whale's surfacing at share `u` (0 to 1): she rises, rolls along the top with a blow, then
 * dives nose down so the flukes lift clear before she goes. `spout` is the blow's size, 0 to 1.
 */
export function whalePose(u: number, out: Pose & { spout: number }): Pose & { spout: number } {
  const ease = (a: number) => a * a * (3 - 2 * a);
  if (u < 0.15) {
    const s = ease(u / 0.15);
    out.lift = -3 + 3.1 * s;
    out.pitch = 0.12 * s;
  } else if (u < 0.6) {
    out.lift = 0.1 + 0.12 * Math.sin((u - 0.15) * 18);
    out.pitch = 0.04 * Math.sin((u - 0.15) * 9);
  } else {
    // Nose down fast and sinking slower, so the flukes swing up clear before she goes.
    const s = (u - 0.6) / 0.4;
    out.lift = 0.1 - 4.5 * ease(s);
    out.pitch = -ease(Math.min(1, s * 1.6));
  }
  const blow = (u - SPOUT.from) / (SPOUT.to - SPOUT.from);
  out.spout = blow > 0 && blow < 1 ? Math.sin(Math.PI * Math.sqrt(blow)) : 0;
  return out;
}
