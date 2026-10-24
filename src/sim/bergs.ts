import { TUNING } from '../data/tuning';
import { knotToUnits } from './boat';
import { coastDistance } from './coast';
import { type OutlinePoint, smoothOutline } from './flowShapes';
import type { MapDef, TerrainDef } from './map';
import { createRng, range } from './rng';

/**
 * Drifting icebergs (decision 0170): a berg field is a terrain shape of kind `bergs`, open water
 * where a number of bergs wander slowly, each on its own looping path. Like the weather, where a berg
 * is is a pure function of the map, the field and the time, so nothing goes in the save, and the
 * sim, the renderer and the tests all agree. Bergs are solid (a knock like ice) and have their own
 * Settings switch: off, there are none at all. Numbers in `weather.json` › `bergs`.
 */
export interface BergsTuning {
  /** Top drift speed of a berg, knots. */
  driftKn: number;
  /** Radius range of a berg in map units, when the field gives none. */
  size: [number, number];
  /** How far a berg's path keeps inside its field's outline, units. */
  margin: number;
}

export const bergsTuning = () => (TUNING.weather as unknown as { bergs: BergsTuning }).bergs;

/** One berg on its field's loop: where it starts along it, its size, model and turn. */
interface BergSlot {
  /** Distance along the loop at time 0, units. */
  s0: number;
  r: number;
  /** Which model: even = flat-topped (tabular), odd = pointed. */
  variant: number;
  turn: number;
  /** Phase of its slow sideways sway. */
  sway: number;
}

export interface Berg {
  x: number;
  y: number;
  r: number;
  variant: number;
  /** Radians about the vertical, turning slowly as it drifts. */
  turn: number;
  field: string;
}

export interface PreparedField {
  def: TerrainDef;
  /** The closed loop the bergs drift round (the last point joins the first), map units. */
  loop: [number, number][];
  /** Distance along the loop at each of its points; the last entry is its whole length. */
  along: number[];
  /** +1 anticlockwise, -1 clockwise (`spin`). */
  dir: 1 | -1;
  bergs: BergSlot[];
  /** Bergs asked for that do not fit round the loop (a map check warns). */
  dropped: number;
  /** Bounding circle of the outline. */
  x: number;
  y: number;
  reach: number;
}

const prepared = new WeakMap<TerrainDef, PreparedField>();
/** Sideways sway of a berg off its loop, units, and its period, seconds. */
const SWAY = 2.5;
const SWAY_SEC = 140;

/**
 * A field's loop and bergs, made once. The bergs drift round one loop, like ice in a slow eddy:
 * the field's outline smoothed and drawn in toward its middle until the largest berg clears the
 * edge by `margin`. They are spaced evenly round it, so they never touch one another, and as many
 * as fit (each needs its diameter and `margin` of loop) are kept.
 */
export function prepareField(def: TerrainDef, index = 0): PreparedField {
  let field = prepared.get(def);
  if (field) return field;
  const tune = bergsTuning();
  const rng = createRng(def.seed ?? 9001 + index * 31);
  const [lo, hi] = def.size ?? tune.size;
  const n = def.outline.length;
  const x = def.outline.reduce((s, p) => s + p[0], 0) / n;
  const y = def.outline.reduce((s, p) => s + p[1], 0) / n;
  const reach = Math.max(...def.outline.map(([px, py]) => Math.hypot(px - x, py - y)));
  const smooth = smoothOutline(def.outline as OutlinePoint[], 2);
  const clear = hi + tune.margin + SWAY;
  let loop: [number, number][] = [];
  for (let k = 0.9; k > 0.05; k -= 0.05) {
    loop = smooth.map(([px, py]) => [x + (px - x) * k, y + (py - y) * k]);
    if (loop.every(([px, py]) => coastDistance(px, py, def.outline).distance <= -clear)) break;
  }
  const along = [0];
  for (let i = 1; i <= loop.length; i++) {
    const a = loop[i - 1]!,
      b = loop[i % loop.length]!;
    along.push(along[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const length = along[along.length - 1]!;
  const fit = Math.floor(length / (2 * hi + tune.margin));
  const count = Math.min(def.count ?? 0, fit);
  const start = rng() * length;
  const bergs: BergSlot[] = [];
  for (let i = 0; i < count; i++)
    bergs.push({
      s0: start + (i * length) / count,
      r: range(rng, lo, hi),
      variant: i,
      turn: rng() * 6,
      sway: rng() * Math.PI * 2,
    });
  field = {
    def,
    loop,
    along,
    dir: def.spin === 'cw' ? -1 : 1,
    bergs,
    dropped: (def.count ?? 0) - count,
    x,
    y,
    reach,
  };
  prepared.set(def, field);
  return field;
}

/** The point `s` units along a field's loop, and the loop's direction there. */
function onLoop(field: PreparedField, s: number) {
  const { loop, along } = field;
  const length = along[along.length - 1]!;
  const d = ((s % length) + length) % length;
  let i = 0;
  while (i < loop.length - 1 && along[i + 1]! < d) i++;
  const a = loop[i]!,
    b = loop[(i + 1) % loop.length]!;
  const t = (d - along[i]!) / (along[i + 1]! - along[i]! || 1);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return {
    x: a[0] + (b[0] - a[0]) * t,
    y: a[1] + (b[1] - a[1]) * t,
    dx: (b[0] - a[0]) / len,
    dy: (b[1] - a[1]) / len,
  };
}

/** Where a berg is at `time` (seconds of game time). */
function bergAt(field: PreparedField, b: BergSlot, time: number): Berg {
  const speed = bergsTuning().driftKn * knotToUnits();
  const p = onLoop(field, b.s0 + field.dir * speed * time);
  // A little sideways sway, so the bergs do not run as if on rails.
  const off = SWAY * Math.sin((time / SWAY_SEC) * Math.PI * 2 + b.sway);
  return {
    x: p.x - p.dy * off,
    y: p.y + p.dx * off,
    r: b.r,
    variant: b.variant,
    turn: b.turn + time * 0.004,
    field: field.def.id,
  };
}

/**
 * For the chart (decision 0170): a field's loop, which way the bergs go round it (arrows: a point
 * and the direction there), and each berg where it is at `time`.
 */
export function bergChart(def: TerrainDef, index: number, time = 0) {
  const field = prepareField(def, index);
  const length = field.along[field.along.length - 1]!;
  const arrows = [0.125, 0.375, 0.625, 0.875].map((k) => {
    const p = onLoop(field, k * length);
    return { x: p.x, y: p.y, dx: p.dx * field.dir, dy: p.dy * field.dir };
  });
  return {
    loop: field.loop,
    arrows,
    bergs: field.bergs.map((b) => bergAt(field, b, time)),
    minutesRound: length / (bergsTuning().driftKn * knotToUnits()) / 60,
  };
}

/** Every berg of the map at `time`; with `near`, only fields within `range` of that point. */
export const bergFields = (map: Pick<MapDef, 'terrain'>) =>
  (map.terrain ?? []).filter((t) => t.kind === 'bergs');

export function bergsAt(
  map: Pick<MapDef, 'terrain'>,
  time: number,
  near?: { x: number; y: number; range: number },
): Berg[] {
  const out: Berg[] = [];
  bergFields(map).forEach((def, index) => {
    const field = prepareField(def, index);
    if (near && Math.hypot(near.x - field.x, near.y - field.y) > field.reach + near.range) return;
    for (const b of field.bergs) out.push(bergAt(field, b, time));
  });
  return out;
}
