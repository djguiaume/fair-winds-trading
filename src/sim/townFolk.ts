import townFolkFile from '../data/town-folk.json';
import type { Span } from './seaLife';

/*
 * People on the quays and in the towns (issue #477): walkers in the lanes, strollers and
 * fishermen on the piers, dock workers carrying between the cargo and the pier. Drawn only,
 * never in the sim. How many, where and how they move is `src/data/town-folk.json`; this file
 * holds the rules the view, the checks and the tests share, without three.js.
 */

/** Where a kind of person goes: a lane, a pier's deck, a pier's edge (standing), the cargo. */
export type Where = 'lane' | 'pier' | 'edge' | 'cargo';
export const WHERES: readonly Where[] = ['lane', 'pier', 'edge', 'cargo'];

export interface FolkKind {
  where: Where;
  /** Share of a town's people of this kind, 0 to 1; the shares add up to about 1. */
  share: number;
  /** Walking speed, reference units a second (0: stands). */
  speed: number;
  /** Steps a second (a standing person's sway). */
  stepHz: number;
  /** Seconds a walker rests at the end of a walk before turning back. */
  pauseSec: Span;
}

/** The town as a whole: its people's model and coats, how many it has and when they show. */
export interface TownDef {
  /** The prop recipe every person is drawn from. */
  model: string;
  /** The palette colour list the coats are picked from. */
  coats: string;
  size: number;
  /** The most people drawn at once, all towns together: the instanced mesh's size. */
  max: number;
  /** A town's people show while the boat is within this of its beach, units. */
  range: number;
  /** Seconds a town's people take to appear or go. */
  fadeSec: number;
  /** Share of the people still about at full night, 0 to 1. */
  night: number;
  /** People per town level (the last entry for every higher level). */
  perLevel: number[];
  /** The prop types the dock workers carry to and from. */
  cargo: string[];
}

export interface TownFolkData {
  /** Share of every count drawn at each quality level (`ultralow` … `ultra`): Ultra-low none. */
  quality: Record<string, number>;
  town: TownDef;
  kinds: Record<string, FolkKind>;
}

export const TOWN_FOLK: TownFolkData = townFolkFile as unknown as TownFolkData;

/** How many people a town of this level has (level 1 upward; 0, an empty island, none). */
export function townPeople(data: Pick<TownDef, 'perLevel'>, level: number): number {
  if (level < 1 || !data.perLevel.length) return 0;
  return data.perLevel[Math.min(level, data.perLevel.length) - 1]!;
}

/**
 * How many of a town's `count` people are of each kind: the shares' largest remainders, so the
 * counts add up to `count` exactly, in the kinds' order.
 */
export function splitByKind(kinds: Readonly<Record<string, FolkKind>>, count: number): number[] {
  const ids = Object.keys(kinds);
  const total = ids.reduce((sum, id) => sum + kinds[id]!.share, 0) || 1;
  const exact = ids.map((id) => (count * kinds[id]!.share) / total);
  const out = exact.map(Math.floor);
  let left = count - out.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((v, k) => [v - out[k]!, k] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, k] of byRemainder) {
    if (left <= 0) break;
    out[k]!++;
    left--;
  }
  return out;
}

/** A point of a walk, reference units; `y` is the deck a pier walk lies on, else the ground. */
export interface WalkPoint {
  x: number;
  z: number;
  y?: number;
}

/** A walk: a line of points (one for a standing place), with a fixed heading for a stander. */
export interface Walk {
  where: Where;
  points: WalkPoint[];
  /** Radians about the vertical, 0 = facing the harbour (+z), for a place where one stands. */
  turn?: number;
  /** Length along the points, reference units (0 for a place). */
  length: number;
}

export function makeWalk(where: Where, points: WalkPoint[], turn?: number): Walk {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z);
  return turn === undefined ? { where, points, length } : { where, points, turn, length };
}

/** Where a walk is `s` units along its line: the point, and the heading of its line there. */
export function alongWalk(
  walk: Walk,
  s: number,
  out: { x: number; z: number; y?: number; heading: number },
) {
  const { points } = walk;
  const first = points[0]!;
  if (points.length < 2) {
    out.x = first.x;
    out.z = first.z;
    out.y = first.y;
    out.heading = walk.turn ?? 0;
    return out;
  }
  let left = Math.max(0, Math.min(walk.length, s));
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= len || i === points.length - 1) {
      const t = len > 0 ? Math.min(1, left / len) : 0;
      out.x = a.x + (b.x - a.x) * t;
      out.z = a.z + (b.z - a.z) * t;
      out.y = a.y === undefined || b.y === undefined ? undefined : a.y + (b.y - a.y) * t;
      // Facing the harbour is +z: the heading is measured from it.
      out.heading = Math.atan2(b.x - a.x, b.z - a.z);
      return out;
    }
    left -= len;
  }
  return out;
}
