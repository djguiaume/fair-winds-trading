import type { IslandDef, TerrainDef } from './map';
import { coastDistance, insetOutline } from './coast';
import { atLevel, designOf, islandDesign, type IslandDesign, type RampDef } from '../data/islands';

export type IslandTheme = 'fish' | 'timber' | 'stone' | 'grain';
export type Outline = TerrainDef['outline'];
export interface LandSurface {
  outline: Outline;
  holes?: Outline[];
  height: number;
  material: 'grass' | 'rock';
  shape?: 'peak';
  base?: number;
  /** Ramp width outward from the sloped edges (decision 0096 §4), and which edges slope. */
  slope?: number;
  slopeEdges?: [number, number][];
}
/** A ramp at a level (decision 0123), with the length along it to each point. */
export interface LayoutRamp {
  points: Outline;
  width: number;
  start: number;
  end: number;
  material: RampDef['material'];
  /** Length from the first point to each point; the last is the whole length. */
  along: number[];
}
export interface IslandLayout {
  coasts: Outline[];
  lake?: Outline;
  surfaces: LandSurface[];
  ramps: LayoutRamp[];
}

/**
 * The island's ground at a level, built from its island file (decision 0101): coasts, the lake
 * and raised ground. Shared by models, collision, chart and water.
 */
function createIslandLayout(design: IslandDesign, level: number): IslandLayout {
  return {
    coasts: design.coasts,
    lake: design.lake,
    surfaces: design.ground
      .filter((g) => atLevel(g, level))
      .map((g) => ({
        // Explicit sandy shores: building height checks use the very same inset as the model.
        outline: g.coast !== undefined ? insetOutline(design.coasts[g.coast]!, BEACH) : g.outline!,
        holes: g.holes,
        height: g.height,
        material: g.material,
        shape: g.shape,
        base: g.base,
        slope: g.slope,
        slopeEdges: g.slopeEdges,
      })),
    ramps: (design.ramps ?? [])
      .filter((r) => atLevel(r, level) && r.points.length >= 2)
      .map((r) => {
        const along = [0];
        for (let i = 1; i < r.points.length; i++) {
          const [ax, az] = r.points[i - 1]!,
            [bx, bz] = r.points[i]!;
          along.push(along[i - 1]! + Math.hypot(bx - ax, bz - az));
        }
        return { ...r, along };
      }),
  };
}

/**
 * Where a point is on a ramp: its distance from the ramp's centre line and the ramp's height
 * level with it (rising evenly along the line). Past the ends the line's end points count.
 */
export function rampAt(r: LayoutRamp, x: number, z: number) {
  let best = Infinity,
    length = 0;
  for (let i = 1; i < r.points.length; i++) {
    const [ax, az] = r.points[i - 1]!,
      [bx, bz] = r.points[i]!;
    const dx = bx - ax,
      dz = bz - az;
    const l = dx * dx + dz * dz;
    const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)) : 0;
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) {
      best = d;
      length = r.along[i - 1]! + Math.sqrt(l) * t;
    }
  }
  const total = r.along[r.along.length - 1]!;
  const k = total ? length / total : 0;
  return { distance: best, height: r.start + (r.end - r.start) * k };
}

/** The highest ramp under a point (at least `margin` in from its sides), or null. */
function rampHeight(layout: IslandLayout, x: number, z: number, margin = 0) {
  let height: number | null = null;
  for (const r of layout.ramps) {
    const at = rampAt(r, x, z);
    if (at.distance <= r.width / 2 - margin) height = Math.max(height ?? 0, at.height);
  }
  return height;
}

/** Width of the sand between a coast and the ground it carries, in radius units. */
export const BEACH = 0.085;

const layouts = new WeakMap<IslandDesign, IslandLayout[]>();
/** The layout of an island file (by id, or the shipped island of a style) at a level. */
export function islandLayout(design: IslandDesign | string, level = 4): IslandLayout {
  const d = typeof design === 'string' ? islandDesign(design) : design;
  let byLevel = layouts.get(d);
  if (!byLevel) layouts.set(d, (byLevel = []));
  return (byLevel[level] ??= createIslandLayout(d, level));
}

/**
 * An entire footprint must fit on a single surface and avoid water and cliff edges. On a ramp
 * (a sloped edge, decision 0096 §4) the height is interpolated down to the ground below.
 */
export function layoutGround(
  layout: IslandLayout,
  x: number,
  z: number,
  margin = 0,
): number | null {
  if (!layout.coasts.some((c) => coastDistance(x, z, c).distance <= -margin)) return null;
  if (layout.lake && coastDistance(x, z, layout.lake).distance < margin) return null;
  if (!layout.surfaces.some((s) => s.slope) && !layout.ramps.length) {
    let height: number | null = null;
    for (const s of layout.surfaces) {
      const d = coastDistance(x, z, s.outline).distance;
      if (Math.abs(d) < margin) return null;
      if (d < -margin && !s.holes?.some((h) => coastDistance(x, z, h).distance < margin))
        height = Math.max(height ?? 0, s.height);
    }
    return height;
  }
  if (cliffDistance(layout, x, z) < margin) return null;
  let height = rampHeight(layout, x, z, margin);
  for (const s of layout.surfaces) {
    if (onSurface(s, x, z)) height = Math.max(height ?? 0, s.height);
    else if (s.slope) {
      const d = edgeDistance(s.outline, x, z, (i) => isSloped(s, i));
      if (d < s.slope) {
        const below = baseHeight(layout, s, x, z);
        height = Math.max(height ?? 0, below + (s.height - below) * (1 - d / s.slope));
      }
    }
  }
  return height;
}

/** Inside a surface's outline and out of its holes. */
const onSurface = (s: LandSurface, x: number, z: number) =>
  coastDistance(x, z, s.outline).distance < 0 &&
  !s.holes?.some((h) => coastDistance(x, z, h).distance < 0);

/** The flat ground under a ramp: the highest other surface there, else the beach (0). */
function baseHeight(layout: IslandLayout, ramp: LandSurface, x: number, z: number) {
  let base = 0;
  for (const s of layout.surfaces)
    if (s !== ramp && s.height < ramp.height && onSurface(s, x, z)) base = Math.max(base, s.height);
  return base;
}

/** Does edge i (from point i to i + 1) of a surface slope? */
export function isSloped(s: { slope?: number; slopeEdges?: [number, number][] }, i: number) {
  return !!s.slope && (!s.slopeEdges || s.slopeEdges.some(([a, b]) => i >= a && i <= b));
}

/** Distance from a point to the nearest of an outline's edges that `pick` keeps. */
export function edgeDistance(
  outline: Outline,
  x: number,
  z: number,
  pick: (i: number) => boolean = () => true,
) {
  let best = Infinity;
  for (let i = 0; i < outline.length; i++) {
    if (!pick(i)) continue;
    const [ax, az] = outline[i]!,
      [bx, bz] = outline[(i + 1) % outline.length]!;
    const dx = bx - ax,
      dz = bz - az;
    const l = dx * dx + dz * dz;
    const t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)) : 0;
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

/**
 * Distance to the nearest cliff: every edge of raised ground and its holes, but sloped ones, and
 * a ramp's sides. On a ramp only its sides count: it runs over the cliffs it climbs.
 */
export function cliffDistance(layout: IslandLayout, x: number, z: number) {
  let best = Infinity,
    onRamp = false;
  for (const r of layout.ramps) {
    const side = rampAt(r, x, z).distance - r.width / 2;
    if (side <= 0) onRamp = true;
    best = Math.min(best, Math.abs(side));
  }
  if (onRamp) return best;
  for (const s of layout.surfaces) {
    best = Math.min(
      best,
      edgeDistance(s.outline, x, z, (i) => !isSloped(s, i)),
    );
    for (const h of s.holes ?? []) best = Math.min(best, edgeDistance(h, x, z));
  }
  return best;
}

/** How far a point is inside a ramp (negative: that far from one), Infinity with no slopes. */
export function slopeDistance(layout: IslandLayout, x: number, z: number) {
  let best = Infinity;
  for (const s of layout.surfaces) {
    if (!s.slope) continue;
    const d = edgeDistance(s.outline, x, z, (i) => isSloped(s, i));
    const outside = coastDistance(x, z, s.outline).distance >= 0;
    // On the ramp: outside the outline and closer than its width; near it: within reach.
    best = Math.min(best, outside ? Math.max(0, d - s.slope) : d);
  }
  for (const r of layout.ramps)
    best = Math.min(best, Math.max(0, rampAt(r, x, z).distance - r.width / 2));
  return best;
}

/**
 * Does the straight line from a to b cross a cliff edge? Slopes are crossed freely, and so are
 * cliffs where a ramp runs over them (decision 0123).
 */
export function crossesCliff(layout: IslandLayout, ax: number, az: number, bx: number, bz: number) {
  const cross = (o: Outline, pick: (i: number) => boolean) => {
    for (let i = 0; i < o.length; i++) {
      if (!pick(i)) continue;
      const [cx, cz] = o[i]!,
        [dx, dz] = o[(i + 1) % o.length]!;
      const d1 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax),
        d2 = (bx - ax) * (dz - az) - (bz - az) * (dx - ax),
        d3 = (dx - cx) * (az - cz) - (dz - cz) * (ax - cx),
        d4 = (dx - cx) * (bz - cz) - (dz - cz) * (bx - cx);
      if (d1 * d2 < 0 && d3 * d4 < 0) {
        if (!layout.ramps.length) return true;
        const t = d1 / (d1 - d2);
        if (rampHeight(layout, cx + (dx - cx) * t, cz + (dz - cz) * t) === null) return true;
      }
    }
    return false;
  };
  return layout.surfaces.some(
    (s) =>
      cross(s.outline, (i) => !isSloped(s, i)) || (s.holes ?? []).some((h) => cross(h, () => true)),
  );
}

/** Profiles use the same harbour-facing frame as pierAt. */
export function islandBearing(island: IslandDef): number {
  return island.look?.harbourBearing ?? 0;
}
export function islandPoint(island: IslandDef, x: number, z: number) {
  const a = Math.PI - islandBearing(island);
  return {
    x: island.x + island.radius * (Math.cos(a) * x + Math.sin(a) * z),
    y: island.y + island.radius * (Math.sin(a) * x - Math.cos(a) * z),
  };
}
const coastCache = new WeakMap<
  IslandDef,
  { key: string; design: IslandDesign; coasts: Outline[] }
>();
export function islandCoasts(island: IslandDef): Outline[] | null {
  const design = designOf(island);
  if (!design) return null;
  const key = `${island.x}/${island.y}/${island.radius}/${design.id}/${islandBearing(island)}`;
  const cached = coastCache.get(island);
  // The island builder replaces a design with an edited copy: the cache follows it.
  if (cached?.key === key && cached.design === design) return cached.coasts;
  const coasts: Outline[] = design.coasts.map((c) =>
    c.map(([x, z]) => {
      const p = islandPoint(island, x, z);
      return [p.x, p.y];
    }),
  );
  coastCache.set(island, { key, design, coasts });
  return coasts;
}

/** Inland water shares its outline with the terrain hole and chart. */
export function islandLake(island: IslandDef): Outline | null {
  const lake = designOf(island)?.lake;
  return lake
    ? lake.map(([x, z]) => {
        const p = islandPoint(island, x, z);
        return [p.x, p.y];
      })
    : null;
}

/** The arrival pier on the simulation's line, then the side piers the island file builds. */
export function characterPiers(design: IslandDesign | string, R: number, level: number) {
  const d = typeof design === 'string' ? islandDesign(design) : design;
  const piers = [{ x: R * 0.08, z0: R * 0.63, len: Math.min(R * 0.75, 4.5) + R * 0.22 }];
  // Working docks stay shorter and well away from the central arrival lane.
  for (const p of d.piers)
    if (p.from <= level) piers.push({ x: p.x * R, z0: p.z * R, len: p.length * R });
  return piers;
}

/** Moored boats round the island at a level (radius units, yaw in radians), solid to the ship. */
export function islandMoorings(design: IslandDesign | string, level: number) {
  const d = typeof design === 'string' ? islandDesign(design) : design;
  return d.props
    .filter((p) => p.type === 'moored-boat' && atLevel(p, level))
    .map((p) => ({ x: p.x, z: p.z, yaw: ((p.turn ?? 0) * Math.PI) / 180 }));
}
