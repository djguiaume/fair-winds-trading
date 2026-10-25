import { TUNING } from '../data/tuning';
import { knotToUnits } from './boat';
import { coastDistance } from './coast';
import { type OutlinePoint, smoothOutline } from './flowShapes';
import type { MapDef, TerrainDef } from './map';
import { createRng, range } from './rng';

/**
 * Drifting icebergs (decision 0170): a berg field is a terrain shape of kind `bergs`, open water
 * where bergs drift slowly round one or two loops, like ice caught in an eddy. Like the weather,
 * where a berg is is a pure function of the map, the field and the time, so nothing goes in the
 * save, and the sim, the renderer and the tests all agree. Bergs are solid (a knock like ice) and
 * have their own Settings switch: off, there are none at all. Numbers in `weather.json` › `bergs`.
 */
export interface BergsTuning {
  /** Drift speed of a berg along its loop, knots. */
  driftKn: number;
  /** Radius range of a berg in map units, when the field gives none. */
  size: [number, number];
  /** Room a berg keeps from its field's edge and from bergs on the other loop, units. */
  margin: number;
  /** How far a berg sways to either side of its loop, units. */
  sway: number;
  /** One sway out and back, seconds. */
  swaySec: number;
}

export const bergsTuning = () => (TUNING.weather as unknown as { bergs: BergsTuning }).bergs;

/** One loop of a field: its points (the last joins the first) and the distance along each. */
export interface BergLoop {
  points: [number, number][];
  along: number[];
  /** +1 anticlockwise, -1 clockwise. */
  dir: 1 | -1;
}

/** One berg on a loop: where it starts along it, its size, model and turn. */
interface BergSlot {
  loop: number;
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
  /** The outer loop, then (with `loops` above 1, room allowing) inner ones, each turning the other way. */
  loops: BergLoop[];
  bergs: BergSlot[];
  /** Bergs asked for that do not fit round the loops (a map check warns). */
  dropped: number;
  /** How far its bergs sway either side of their loop: the field's `sway`, else the tuning's. */
  sway: number;
  /** Bounding circle of the outline. */
  x: number;
  y: number;
  reach: number;
}

const prepared = new WeakMap<TerrainDef, PreparedField>();

function makeLoop(points: [number, number][], dir: 1 | -1): BergLoop {
  const along = [0];
  for (let i = 1; i <= points.length; i++) {
    const a = points[i - 1]!,
      b = points[i % points.length]!;
    along.push(along[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { points, along, dir };
}

const loopLength = (loop: BergLoop) => loop.along[loop.along.length - 1]!;

/**
 * A field's loops and bergs, made once. The outer loop is the field's outline smoothed and drawn
 * in toward its middle until the largest berg, swaying out, clears the edge by `margin`. With
 * `loops` above 1, inner loops, each turning the other way, are drawn in further until bergs on
 * neighbouring loops cannot touch: then no water in the field stays clear for long. On each loop the bergs are
 * spaced evenly, so they never touch one another; as many as fit are kept.
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
  const scaled = (k: number) =>
    smooth.map(([px, py]) => [x + (px - x) * k, y + (py - y) * k] as [number, number]);
  const dir = def.spin === 'cw' ? -1 : 1;
  const sway = def.sway ?? tune.sway;
  let outer = scaled(0.9);
  let k = 0.9;
  for (; k > 0.05; k -= 0.05) {
    outer = scaled(k);
    const clear = hi + tune.margin + sway;
    if (outer.every(([px, py]) => coastDistance(px, py, def.outline).distance <= -clear)) break;
  }
  // Each further loop lies inside the last, far enough that bergs on the two cannot touch, and
  // turns the other way; as many as `loops` asks for and the field has room for.
  const loops = [makeLoop(outer, dir)];
  const apart = 2 * (hi + sway) + tune.margin;
  let last = outer;
  for (let j = k - 0.05; loops.length < (def.loops ?? 1) && j > 0.1; j -= 0.025) {
    const inner = scaled(j);
    if (inner.every(([px, py]) => coastDistance(px, py, last).distance <= -apart)) {
      loops.push(makeLoop(inner, loops.length % 2 ? (dir === 1 ? -1 : 1) : dir));
      last = inner;
    }
  }
  // Bergs share the loops by length, each loop holding as many as fit end to end.
  const total = loops.reduce((s, l) => s + loopLength(l), 0);
  const asked = def.count ?? 0;
  const bergs: BergSlot[] = [];
  let left = asked;
  loops.forEach((loop, li) => {
    const length = loopLength(loop);
    const fit = Math.floor(length / (2 * (hi + sway) + tune.margin));
    const share = li === loops.length - 1 ? left : Math.round((asked * length) / total);
    const count = Math.min(fit, share);
    left -= share;
    const start = rng() * length;
    for (let i = 0; i < count; i++)
      bergs.push({
        loop: li,
        s0: start + (i * length) / count,
        r: range(rng, lo, hi),
        variant: bergs.length,
        turn: rng() * 6,
        sway: rng() * Math.PI * 2,
      });
  });
  field = { def, loops, bergs, dropped: asked - bergs.length, sway, x, y, reach };
  prepared.set(def, field);
  return field;
}

/** The point `s` units along a loop, and the loop's direction there. */
function onLoop(loop: BergLoop, s: number) {
  const { points, along } = loop;
  const length = loopLength(loop);
  const d = ((s % length) + length) % length;
  let i = 0;
  while (i < points.length - 1 && along[i + 1]! < d) i++;
  const a = points[i]!,
    b = points[(i + 1) % points.length]!;
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
  const tune = bergsTuning();
  const loop = field.loops[b.loop]!;
  const p = onLoop(loop, b.s0 + loop.dir * tune.driftKn * knotToUnits() * time);
  // A slow sideways sway, so the bergs do not run as if on rails and no lane stays clear.
  const off = field.sway * Math.sin((time / tune.swaySec) * Math.PI * 2 + b.sway);
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
 * For the chart (decision 0170): a field's loops, which way the bergs go round each (arrows: a
 * point and the direction there), the band each sways across, and each berg where it is at `time`.
 */
export function bergChart(def: TerrainDef, index: number, time = 0) {
  const field = prepareField(def, index);
  const speed = bergsTuning().driftKn * knotToUnits();
  return {
    loops: field.loops.map((loop) => {
      const length = loopLength(loop);
      return {
        points: loop.points,
        arrows: [0.125, 0.375, 0.625, 0.875].map((k) => {
          const p = onLoop(loop, k * length);
          return { x: p.x, y: p.y, dx: p.dx * loop.dir, dy: p.dy * loop.dir };
        }),
        minutesRound: length / speed / 60,
      };
    }),
    sway: field.sway,
    bergs: field.bergs.map((b) => bergAt(field, b, time)),
  };
}

export const bergFields = (map: Pick<MapDef, 'terrain'>) =>
  (map.terrain ?? []).filter((t) => t.kind === 'bergs');

/** Every berg of the map at `time`; with `near`, only fields within `range` of that point. */
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
