import { TUNING } from '../data/tuning';
import { knotToUnits } from './boat';
import { coastDistance } from './coast';
import { sampleInside } from './landmarks';
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

/** One berg's looping path: its centre, the swing on each axis, their rates and phases. */
interface BergPath {
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  wx: number;
  wy: number;
  px: number;
  py: number;
  r: number;
  /** Which model: even = flat-topped (tabular), odd = pointed. */
  variant: number;
  turn: number;
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
  paths: BergPath[];
  /** Bounding circle of the outline. */
  x: number;
  y: number;
  reach: number;
}

const prepared = new WeakMap<TerrainDef, PreparedField>();

/** A field's berg paths, made once: each loop is shrunk until it stays inside the outline. */
export function prepareField(def: TerrainDef, index = 0): PreparedField {
  let field = prepared.get(def);
  if (field) return field;
  const tune = bergsTuning();
  const rng = createRng(def.seed ?? 9001 + index * 31);
  const [lo, hi] = def.size ?? tune.size;
  const speed = tune.driftKn * knotToUnits();
  const occupied: { x: number; y: number; radius: number }[] = [];
  const paths: BergPath[] = [];
  for (let i = 0; i < (def.count ?? 0); i++) {
    const r = range(rng, lo, hi);
    const c = sampleInside(rng, def.outline, r + tune.margin, occupied);
    if (!c) continue;
    let ax = range(rng, 20, 60),
      ay = range(rng, 20, 60);
    const px = rng() * Math.PI * 2,
      py = rng() * Math.PI * 2;
    // Top speed of the loop is about `speed`: a wider swing goes round more slowly.
    const wx = speed / ax,
      wy = (speed / ay) * range(rng, 0.6, 0.9);
    const inside = () => {
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const x = c.x + ax * Math.sin(a),
          y = c.y + ay * Math.sin(a * 1.37 + py);
        if (coastDistance(x, y, def.outline).distance > -(r + tune.margin)) return false;
      }
      return true;
    };
    for (let k = 0; k < 12 && !inside(); k++) {
      ax *= 0.7;
      ay *= 0.7;
    }
    if (!inside()) ax = ay = 0;
    paths.push({ cx: c.x, cy: c.y, ax, ay, wx, wy, px, py, r, variant: i, turn: rng() * 6 });
  }
  const n = def.outline.length;
  const x = def.outline.reduce((s, p) => s + p[0], 0) / n;
  const y = def.outline.reduce((s, p) => s + p[1], 0) / n;
  const reach = Math.max(...def.outline.map(([px, py]) => Math.hypot(px - x, py - y)));
  field = { def, paths, x, y, reach };
  prepared.set(def, field);
  return field;
}

/** Where a berg is at `time` (seconds of game time). */
function bergAt(p: BergPath, time: number, field: string): Berg {
  return {
    x: p.cx + p.ax * Math.sin(p.wx * time + p.px),
    y: p.cy + p.ay * Math.sin(p.wy * time + p.py),
    r: p.r,
    variant: p.variant,
    turn: p.turn + time * 0.004,
    field,
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
    for (const p of field.paths) out.push(bergAt(p, time, def.id));
  });
  return out;
}
