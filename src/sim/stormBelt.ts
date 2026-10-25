import { TUNING } from '../data/tuning';
import { coastDistance } from './coast';
import { DEG, clamp } from './math';
import { createRng } from './rng';
import type { Storm } from './storms';
import { type ZoneField, type ZoneKind, zonesTuning } from './windZones';

/**
 * The storm belt (decision 0167): a wind zone whose kind has `squallEverySec` breeds trains of
 * squalls that roll in from one side and march across it, downwind of its `headingDeg`, then die at
 * its far edge. Each cycle of `squallEverySec` seconds starts with a train (a share `squallShare`
 * of the cycle, scaled by the level's `stormBelt` knob) and ends with a lull. A captain crosses
 * in the lull, darts between two squalls, or sails round the belt's end. Like every storm it is a
 * pure function of the seed, the time and the place, so nothing is saved, and it obeys the Weather,
 * Storms and Storm belt switches and the tutorial's hold (decision 0072).
 */

/** Ids of belt squalls start here, clear of the crossing (0067) and zone-born (0140) storms. */
const BELT_IDS = 3_000_000;
/** Room for this many squalls per zone before ids would run into the next zone's. */
const PER_ZONE = 1_000_000;
/** Room for this many squalls in one train. */
const PER_TRAIN = 100;

/** The numbers of a belt, with the zone's own `tune` over its kind's. */
export interface BeltNumbers {
  everySec: number;
  share: number;
  gapSec: number;
  radius: number;
  speed: number;
}

/** A belt zone ready for squalls: its numbers and its extent along and across the squalls' way. */
interface Belt {
  zone: ZoneField['zones'][number];
  numbers: BeltNumbers;
  /** Unit vector the squalls travel (downwind of `headingDeg`). */
  dx: number;
  dy: number;
  /** Extent of the outline along that way and across it. */
  s0: number;
  s1: number;
  l0: number;
  l1: number;
}

const belts = new WeakMap<ZoneField, Belt[]>();

function num(zone: Belt['zone'], kind: ZoneKind, key: keyof ZoneKind, fallback: number): number {
  const own = zone.def.tune?.[key];
  const v = own ?? kind[key];
  return typeof v === 'number' ? v : fallback;
}

/** The belt zones of a field (cached per field); empty when it has none. */
export function beltsOf(field: ZoneField): readonly Belt[] {
  const cached = belts.get(field);
  if (cached) return cached;
  const kinds = zonesTuning().kinds;
  const out: Belt[] = [];
  for (const zone of field.zones) {
    const kind = kinds[zone.def.kind];
    if (!kind?.squallEverySec) continue;
    const numbers: BeltNumbers = {
      everySec: num(zone, kind, 'squallEverySec', 300),
      share: num(zone, kind, 'squallShare', 0.5),
      gapSec: num(zone, kind, 'squallGapSec', 30),
      radius: num(zone, kind, 'squallRadius', 60),
      speed: num(zone, kind, 'squallSpeed', 7),
    };
    // Squalls go where the zone's wind blows TO: from its heading, else from the east.
    const to = ((zone.def.headingDeg ?? 90) + 180) * DEG;
    const dx = Math.sin(to),
      dy = Math.cos(to);
    let s0 = Infinity,
      s1 = -Infinity,
      l0 = Infinity,
      l1 = -Infinity;
    for (const [x, y] of zone.outline) {
      const s = x * dx + y * dy,
        l = x * dy - y * dx;
      s0 = Math.min(s0, s);
      s1 = Math.max(s1, s);
      l0 = Math.min(l0, l);
      l1 = Math.max(l1, l);
    }
    out.push({ zone, numbers, dx, dy, s0, s1, l0, l1 });
  }
  belts.set(field, out);
  return out;
}

/** The share of each cycle a train lasts on a level whose `stormBelt` knob is `level`. */
function trainShare(belt: Belt, level: number) {
  return clamp(belt.numbers.share * level, 0.05, 0.9);
}

/** Start of the train of cycle `k` (a little late now and then, so it is a rhythm, not a clock). */
function trainStart(belt: Belt, seed: number, k: number) {
  const rng = createRng(
    (seed ^ Math.imul(k + 1, 0x2c1b3c6d) ^ Math.imul(belt.zone.index + 1, 0x297a2d39)) >>> 0,
  );
  return { start: (k + 0.12 * rng()) * belt.numbers.everySec, rng };
}

/** Seconds a squall takes from entering the belt's upwind edge to leaving its far edge. */
const crossing = (belt: Belt) => (belt.s1 - belt.s0 + belt.numbers.radius) / belt.numbers.speed;

/**
 * The squalls in every belt of the field at time `t`. `level` is the level's `stormBelt` knob times
 * the Storm belt switch (0 = none). Only squalls born at or after `from` count.
 */
export function beltSquallsAt(
  field: ZoneField,
  seed: number,
  t: number,
  from: number,
  level: number,
  out: Storm[] = [],
): Storm[] {
  if (level <= 0) return out;
  for (const belt of beltsOf(field)) {
    const { everySec, gapSec, radius, speed } = belt.numbers;
    const share = trainShare(belt, level);
    const life = crossing(belt);
    const now = Math.floor(t / everySec);
    const back = Math.ceil((life + everySec) / everySec);
    for (let k = Math.max(0, now - back); k <= now; k++) {
      const { start, rng } = trainStart(belt, seed, k);
      const end = start + share * everySec;
      for (let j = 0; j < PER_TRAIN; j++) {
        // Squalls enter about every `gapSec` seconds while the train lasts.
        const born = start + (j + 0.5 * rng()) * gapSec;
        const lateral = rng();
        const strength = 0.85 + 0.15 * rng();
        if (born > end) break;
        if (t < born || t > born + life || born < from) continue;
        // Across the belt anywhere a squall's core still fits, along its way from the upwind edge.
        const l = belt.l0 + radius * 0.3 + lateral * Math.max(0, belt.l1 - belt.l0 - radius * 0.6);
        const s = belt.s0 - radius * 0.5 + speed * (t - born);
        const x = s * belt.dx + l * belt.dy,
          y = s * belt.dy - l * belt.dx;
        // Builds as it enters, dies as it leaves; and fades where it strays outside the outline.
        const along = clamp(Math.min(s - belt.s0 + radius * 0.5, belt.s1 - s) / radius, 0, 1);
        const edge = coastDistance(x, y, belt.zone.outline).distance;
        const inside = clamp((radius * 0.5 - edge) / radius, 0, 1);
        const k3 = along * inside;
        if (k3 <= 0) continue;
        out.push({
          id: BELT_IDS + belt.zone.index * PER_ZONE + k * PER_TRAIN + j,
          x,
          y,
          radius,
          intensity: strength * k3 * k3 * (3 - 2 * k3),
          dx: belt.dx,
          dy: belt.dy,
          squall: true,
        });
      }
    }
  }
  return out;
}

/** What the HUD says about a belt near the boat. */
export interface BeltNow {
  /** Id of the belt's zone. */
  zone: string;
  /** Squalls pass this spot of the belt right now (otherwise it is a lull). */
  squalls: boolean;
  /** Seconds until that changes. */
  changeSec: number;
  /** The boat is inside the outline. */
  inside: boolean;
}

/**
 * The belt near (x, y), if any is within `TUNING.weather.storms.warningRange` of its outline: is it
 * squalls or a lull at the boat's place along the belt, and for how long. A train covers a spot
 * from when its first squall's edge arrives there until its last one's edge has passed.
 */
export function beltNow(
  field: ZoneField,
  seed: number,
  t: number,
  x: number,
  y: number,
  from: number,
  level: number,
): BeltNow | null {
  if (level <= 0) return null;
  const range = TUNING.weather.storms.warningRange;
  let best: { belt: Belt; edge: number } | null = null;
  for (const belt of beltsOf(field)) {
    const z = belt.zone;
    if (Math.hypot(x - z.cx, y - z.cy) > z.reach + range) continue;
    const edge = coastDistance(x, y, z.outline).distance;
    if (edge > range || (best && edge >= best.edge)) continue;
    best = { belt, edge };
  }
  if (!best) return null;
  const { belt, edge } = best;
  const { everySec, radius, speed } = belt.numbers;
  const share = trainShare(belt, level);
  // Seconds from a squall's birth until its front edge reaches this spot, and its back edge leaves.
  // Squalls set off half a radius upwind of the outline (see `beltSquallsAt`).
  const s = clamp(x * belt.dx + y * belt.dy, belt.s0, belt.s1) - (belt.s0 - radius * 0.5);
  const reach = (s - radius) / speed;
  const leave = (s + radius) / speed;
  const now = Math.floor(t / everySec);
  const windows: [number, number][] = [];
  for (let k = Math.max(0, now - 3); k <= now + 2; k++) {
    const { start } = trainStart(belt, seed, k);
    const born = Math.max(start, from);
    const end = start + share * everySec;
    if (end <= born) continue;
    windows.push([born + reach, end + leave]);
  }
  // Trains can overlap at a spot far downwind; merge them.
  windows.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const w of windows) {
    const last = merged[merged.length - 1];
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
    else merged.push([w[0], w[1]]);
  }
  const inside = edge < 0;
  for (const [a, b] of merged) {
    if (t < a) return { zone: belt.zone.def.id, squalls: false, changeSec: a - t, inside };
    if (t <= b) return { zone: belt.zone.def.id, squalls: true, changeSec: b - t, inside };
  }
  return { zone: belt.zone.def.id, squalls: false, changeSec: everySec, inside };
}

/**
 * Mean seconds a captain waits at a belt's edge for the next lull, on a level whose `stormBelt`
 * knob is `level` (the balance check's estimate): arriving at a random moment, the train is on for
 * a share of the cycle and the wait is half of it on average.
 */
export function beltMeanWait(numbers: BeltNumbers, level: number): number {
  const share = clamp(numbers.share * level, 0.05, 0.9);
  return (share * share * numbers.everySec) / 2;
}

/** The belts' numbers as the balance check wants them, keyed by zone id. */
export function beltNumbers(field: ZoneField): Map<string, BeltNumbers> {
  return new Map(beltsOf(field).map((b) => [b.zone.def.id, b.numbers]));
}

/** Whether a kind is a storm belt. */
export const isBeltKind = (kind: string) =>
  !!(TUNING.weather as unknown as { zones: { kinds: Record<string, ZoneKind> } }).zones.kinds[kind]
    ?.squallEverySec;
