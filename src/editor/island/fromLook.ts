import type { GroundDef, IslandDesign, IslandStyle, Point, PropDef } from '../../data/islands';
import { ISLAND_SCALE } from '../../sim/islandUnits';
import { PROP_TYPES } from '../../render/models/props';
import { islandCheckKit } from '../../render/models/towns';
import { coastDistance, insetOutline } from '../../sim/coast';
import { cliffDistance } from '../../sim/islandCliffs';
import { islandLayout, layoutGround } from '../../sim/islandLayout';
import type { IslandDef, MapDef, TerrainDef } from '../../sim/map';
import { bearingTo } from '../../sim/math';
import { type Rng, createRng, range } from '../../sim/rng';

/**
 * Island files for islands that had none (decision 0110). The map's generated islands (stacked
 * sandstone layers from a few `look` settings, the shipyard towns of the hidden yards, and the
 * long terraced ridges of the `terrain` list) are replayed here from the same seeds into the port
 * file format: their coast, layers, trees, houses and landmark become ground and props the
 * builder can edit. Shapes and spots are the old ones; the drawing is the island files' (vertical
 * cliffs, the catalogue's trees and houses), so islands look close to, not exactly as, before.
 */

const pos = (v: number) => Number(v.toFixed(4));
const STYLES: IslandStyle[] = ['fish', 'timber', 'grain', 'stone'];
const HARBOUR = Math.PI / 2;

/** The points of `blobShape` (geometry.ts), drawing the same numbers from `rng`. */
function blob(rng: Rng, R: number, n: number, jit: number, sx: number, sz: number): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = R * (1 + (rng() - 0.5) * jit);
    return [Math.cos(a) * r * sx, Math.sin(a) * r * sz];
  });
}
/** A `slab` layer's walkable top: the blob scaled by k, moved, as island-file units (÷ R). */
function top(points: Point[], k: number, ox: number, oz: number, R: number): Point[] {
  return points.map(([x, y]) => [pos((x * k + ox) / R), pos((-y * k + oz) / R)]);
}
/** A `tree()` of highlandIslands: four numbers drawn (three cone turns, then its scale). */
function treeScale(rng: Rng) {
  rng();
  rng();
  rng();
  return 0.8 + rng() * 0.5;
}
const empty = (): Pick<IslandDesign, 'lanes' | 'piers' | 'props'> => ({
  lanes: [],
  piers: [],
  props: [],
});
/** Trees are props here; the seeded woods are off until the builder's woods are used. */
const noWoods = (R: number): IslandDesign['woods'] => ({
  tree: 'woodland-pine',
  tries: 0,
  area: [-1.2, -1.2, 1.2, 1.2],
  size: 1.8,
  margin: pos(0.6 / R),
  spacing: 0.185,
});

/**
 * The harbour bearing `islandParts` gives an island: toward its course buoy, else a seeded one.
 * The seeded one is drawn after everything else the island draws, so it is replayed last.
 */
function bearingOf(island: IslandDef, map: Pick<MapDef, 'course'>, rng: Rng) {
  const wp = map.course.find((w) => w.label === island.name);
  return island.look?.harbourBearing ?? (wp ? bearingTo(island, wp) : rng() * Math.PI * 2);
}

/**
 * An island file for a map island drawn from its `look` (no `design`), with the harbour bearing
 * it was drawn at. `seed` is the island's model seed (`map.seed * 1000 + its index`).
 */
export function designFromLook(
  island: IslandDef,
  map: Pick<MapDef, 'course' | 'ports'>,
  seed: number,
): { design: IslandDesign; bearing: number } {
  const look = island.look ?? {};
  const port = map.ports.find((p) => p.islandId === island.id);
  const kind = look.kind ?? port?.produces[0];
  const style: IslandStyle = STYLES.find((s) => s === kind) ?? 'timber';
  const R = island.radius / ISLAND_SCALE;
  const rng = createRng(seed);
  const sx = 1 + (rng() - 0.5) * 0.16;
  const sz = 1 + (rng() - 0.5) * 0.16;
  const base = {
    id: island.id,
    name: island.name ?? island.id,
    style,
    seed,
  };
  if (look.dock) {
    const design = { ...base, ...yardTown(seed, R, sx, sz, look.landmark), woods: noWoods(R) };
    return { design, bearing: bearingOf(island, map, rng) };
  }

  // The beach blob from y -1 to 0.45, tapering to 0.85: the waterline is the collision shore.
  const beach = blob(rng, R * 1.1, 14, 0.2, sx, sz);
  const coast = top(beach, 1 - 0.15 / 1.45, 0, 0, R);
  const ground: GroundDef[] = [];
  const layers = Math.max(
    1,
    Math.min(
      4,
      look.layers ?? (kind === 'stone' ? 4 : kind === 'grain' ? 2 : kind ? 3 : look.rock ? 2 : 1),
    ),
  );
  let y = 0;
  let ox = 0;
  let oz = 0;
  for (let i = 0; i < layers; i++) {
    const h = kind === 'stone' ? range(rng, 1.1, 1.5) : range(rng, 1.2, 1.8);
    ox += (rng() - 0.5) * R * 0.08;
    oz -= R * 0.05;
    const layer = blob(rng, R * (0.9 - i * 0.15), 11, 0.3, sx, sz);
    y += h;
    ground.push({ outline: top(layer, 0.9, ox, oz, R), height: pos(y / R), material: 'rock' });
  }
  const capR = R * (0.92 - layers * 0.15);
  const cap = blob(rng, capR, 11, 0.2, sx, sz);
  const surface = y + 0.25;
  ground.push({ outline: top(cap, 0.95, ox, oz, R), height: pos(surface / R), material: 'grass' });

  const props: PropDef[] = [];
  /** A prop on the cap: angle 0 = +X, π/2 = harbour (+Z); d a fraction of the cap radius. */
  const at = (type: string, a: number, d: number, turn: number, extra: Partial<PropDef> = {}) =>
    props.push({
      type,
      x: pos((ox + Math.cos(a) * d * capR * sx) / R),
      z: pos((oz + Math.sin(a) * d * capR * sz) / R),
      turn: Math.round((turn * 180) / Math.PI),
      ...extra,
      from: 1,
    });
  const houses = look.houses ?? 0;
  const trees = look.trees ?? 0;
  if (look.rock && !look.landmark) {
    // The old boulder: a small rock peak, so it stays part of the ground.
    const a = rng() * 6;
    const bx = ox + Math.cos(a) * 0.2 * capR * sx,
      bz = oz + Math.sin(a) * 0.2 * capR * sz;
    rng();
    const r = R * 0.3;
    ground.push({
      outline: Array.from({ length: 6 }, (_, k): Point => {
        const t = (k / 6) * Math.PI * 2;
        return [pos((bx + Math.cos(t) * r) / R), pos((bz + Math.sin(t) * r) / R)];
      }),
      height: pos((surface + R * 0.12 + r * 1.3) / R),
      material: 'rock',
      shape: 'peak',
      base: pos(surface / R),
    });
  }
  for (let i = 0; i < houses; i++)
    at('cabin', HARBOUR + (i - (houses - 1) / 2) * 0.6, 0.6, rng() * 3, { variant: i % 3 });
  for (let i = 0; i < trees; i++) {
    const size = treeScale(rng);
    const a = rng() * Math.PI * 2;
    const d = look.landmark ? 0.78 + rng() * 0.1 : 0.3 + rng() * 0.5;
    at('pine', a, d, rng() * 3, { size: pos(size), shape: pos((i * 0.37) % 1) });
  }
  if (look.landmark === 'wreck') {
    props.push({
      type: 'wreck',
      x: 0,
      z: 0.84,
      y: pos(0.6 / R),
      turn: 90,
      size: pos(Math.min(0.9, R * 0.07)),
      from: 1,
    });
  } else if (look.landmark) {
    props.push({
      type: look.landmark,
      x: pos(ox / R),
      z: pos(oz / R),
      turn: 11,
      size: pos(Math.min(1.15, capR / 3.8)),
      from: 1,
    });
  }
  const design: IslandDesign = {
    ...base,
    coasts: [coast],
    ground,
    ...empty(),
    props,
    woods: noWoods(R),
  };
  return { design, bearing: bearingOf(island, map, rng) };
}

/**
 * A hidden yard's town (towns.ts, the shipyard branch of `townIslandParts`): its terraces and,
 * per level, the yard houses, warehouses, slipway, second pier and trees, at the same spots.
 */
function yardTown(
  seed: number,
  R: number,
  sx: number,
  sz: number,
  landmark: string | undefined,
): Omit<IslandDesign, 'id' | 'name' | 'style' | 'seed' | 'woods'> {
  const P = { tiers: 2, k: 0.75, back: 0.28, side: 0.15, step: 0.05, shelf: 0.6 };
  const pier = { x: R * 0.08, z0: R * 0.85, len: Math.min(R * 0.75, 4.5) };
  const rng = createRng(seed);
  const stream = (k: number) => createRng(seed * 7919 + k * 104729);
  const beach = blob(rng, R * 1.1, 14, 0.2, sx, sz);
  const coast = top(beach, 1 - 0.15 / 1.45, 0, 0, R);
  type Disc = { x: number; z: number; r: number; y: number };
  const discs: Disc[] = [{ x: 0, z: 0, r: R * 0.9, y: 0.45 }];
  const ground: GroundDef[] = [];
  const shelf = blob(rng, R * 0.9, 14, 0.1, sx, sz);
  ground.push({
    outline: top(shelf, 0.97, 0, R * 0.02, R),
    height: pos(P.shelf / R),
    material: 'grass',
  });
  discs.push({ x: 0, z: R * 0.02, r: R * 0.84, y: P.shelf });
  let y = P.shelf;
  const ox = P.side * R;
  let oz = -P.back * R;
  for (let i = 0; i < P.tiers; i++) {
    const h = range(rng, 1.15, 1.45);
    const r = R * (0.9 - i * 0.16) * P.k;
    if (i) oz -= P.step * R;
    const layer = blob(rng, r, 12, 0.12, sx, sz);
    y += h;
    ground.push({ outline: top(layer, 0.96, ox, oz, R), height: pos(y / R), material: 'rock' });
    discs.push({ x: ox, z: oz, r: r * 0.9, y });
  }
  const topDisc = discs[discs.length - 1]!;
  const capR = topDisc.r * 1.02;
  const cap = blob(rng, capR, 12, 0.08, sx, sz);
  topDisc.y += 0.22;
  ground.push({
    outline: top(cap, 0.97, topDisc.x, topDisc.z, R),
    height: pos(topDisc.y / R),
    material: 'grass',
  });

  const groundAt = (x: number, z: number, m: number): number | null => {
    let best: Disc | null = null;
    for (const d of discs) {
      const dist = Math.hypot((x - d.x) / sx, (z - d.z) / sz);
      if (d !== discs[0] && Math.abs(dist - d.r) < m + R * 0.05) return null;
      if (dist < d.r - (d === discs[0] ? m : 0) && (!best || d.y > best.y)) best = d;
    }
    return best ? best.y : null;
  };
  const taken: { x: number; z: number; r: number }[] = [];
  const claim = (x: number, z: number, r: number) => taken.push({ x, z, r });
  const free = (x: number, z: number, r: number) =>
    !taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + r) &&
    !(Math.abs(x - pier.x) < 0.7 + r && z > R * 0.45);
  const spots = (candidates: { x: number; z: number }[], count: number, r: number) => {
    const found: { x: number; z: number }[] = [];
    for (const c of candidates) {
      if (found.length >= count) break;
      if (groundAt(c.x, c.z, r * 0.6) === null || !free(c.x, c.z, r)) continue;
      claim(c.x, c.z, r);
      found.push(c);
    }
    return found;
  };
  const scatter = (s: Rng, n: number, maxR: number, a0 = 0, a1 = Math.PI * 2) =>
    Array.from({ length: n }, () => {
      const a = range(s, a0, a1);
      const d = Math.sqrt(s()) * maxR;
      return { x: Math.cos(a) * d * sx, z: Math.sin(a) * d * sz };
    });
  const near = (px: number, pz: number) => (p: { x: number; z: number }, q: typeof p) =>
    Math.hypot(p.x - px, p.z - pz) - Math.hypot(q.x - px, q.z - pz);
  const pierRoot = { x: pier.x, z: pier.z0 };
  const facePier = (p: { x: number; z: number }, s: Rng) =>
    Math.atan2(pierRoot.x - p.x, pierRoot.z + 2 - p.z) + (s() - 0.5) * 0.3;
  const S = 1.25;

  const props: PropDef[] = [];
  const add = (type: string, p: { x: number; z: number }, turn: number, from: number, extra = {}) =>
    props.push({
      type,
      x: pos(p.x / R),
      z: pos(p.z / R),
      turn: Math.round((turn * 180) / Math.PI),
      ...extra,
      from,
    });
  const piers: IslandDesign['piers'] = [];
  const second = { x: pier.x - R * 0.42, z: pier.z0 - 0.2 };
  claim(second.x, second.z - 0.6, 1.2);
  piers.push({
    x: pos(second.x / R),
    z: pos(second.z / R),
    length: pos((pier.len * 0.6) / R),
    from: 4,
  });
  const wh = spots(
    [
      { x: pier.x + 2.1, z: pier.z0 - 1.4 },
      { x: pier.x + 2.4, z: pier.z0 - 3.2 },
    ],
    2,
    1.2,
  );
  if (wh[0]) add('warehouse', wh[0], 0.1, 2, { size: S });
  if (wh[1]) add('warehouse', wh[1], -0.1, 4, { size: S });
  const s = stream(1);
  const slip = { x: pier.x + R * 0.45, z: R * 0.74 };
  const at = { x: pos(slip.x / R), z: pos(slip.z / R), y: pos(0.45 / R), turn: 32 };
  props.push({ type: 'slipway', ...at, from: 2, to: 3 });
  props.push({ type: 'slipway-hull', ...at, from: 4 });
  claim(slip.x, slip.z, 1.8);
  if (landmark) claim(topDisc.x, topDisc.z, capR * 0.6);
  const homes = spots(
    scatter(s, 140, 0.8 * R, 0, Math.PI).sort(near(pierRoot.x, pierRoot.z)),
    8,
    0.8,
  );
  homes.forEach((p, i) =>
    add('yard-house', p, facePier(p, s), i < 2 ? 1 : i < 3 ? 2 : i < 5 ? 3 : 4, {
      size: S,
      variant: i,
    }),
  );
  const treeRng = stream(3);
  for (const p of spots(scatter(stream(2), 60, 0.9 * R), 8, 0.6))
    add('pine', p, treeRng() * 6, 1, { size: 1.1, shape: pos(treeRng()) });
  if (landmark) add(landmark, topDisc, 0.2, 1, { size: pos(Math.min(1.15, capR / 3.8)) });
  return { coasts: [coast], ground, lanes: [], piers, props };
}

/** Ridge terraces (highlandIslands RIDGE_TIERS): inset and top, in world units. */
const RIDGE = [
  { inset: 4, top: 4.6, material: 'rock' },
  { inset: 8, top: 7.6, material: 'rock' },
  { inset: 10, top: 8, material: 'grass' },
] as const;
const RIDGE_TOP = 8;
/** The scale unit a ridge's file uses: world units per island-file unit. */
const RIDGE_RADIUS = 20;

/**
 * A long terraced island of the `terrain` list as a map island with its own file: centred on
 * its outline, drawn unturned (harbour bearing π), with the old landmark, outcrops (small raised
 * grounds), trees and rocks at their seeded spots. `seed` is `map.seed * 1709 + its index * 97`.
 */
export function designFromRidge(
  feature: TerrainDef,
  seed: number,
): { island: IslandDef; design: IslandDesign } {
  const xs = feature.outline.map((p) => p[0]);
  const ys = feature.outline.map((p) => p[1]);
  const cx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
  const cy = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
  const r = RIDGE_RADIUS;
  /** World (x, y) to file (x, z): unturned, so file z is world -y. */
  const file = ([x, y]: Point | [number, number]): Point => [pos((x - cx) / r), pos(-(y - cy) / r)];
  const island: IslandDef = {
    id: feature.id,
    name: feature.name,
    x: cx,
    y: cy,
    radius: r,
    look: { design: feature.id, harbourBearing: Math.PI },
  };
  const R = r / ISLAND_SCALE;
  const ground: GroundDef[] = RIDGE.map((t) => ({
    outline: insetOutline(feature.outline, t.inset).map(file),
    height: pos(t.top / r),
    material: t.material,
  }));

  // terrainProps, replayed: the same samples in the same order.
  const area = insetOutline(feature.outline, 10);
  const rng = createRng(seed);
  const axs = area.map((p) => p[0]);
  const ays = area.map((p) => p[1]);
  const occupied: { x: number; y: number; radius: number }[] = [];
  const inside = (x: number, y: number, radius: number) => {
    // coastDistance(x, y, area).distance <= -radius, without importing the sim's sign rule.
    let inPoly = false;
    let best = Infinity;
    for (let i = 0, j = area.length - 1; i < area.length; j = i++) {
      const [x1, y1] = area[i]!,
        [x2, y2] = area[j]!;
      if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inPoly = !inPoly;
      const dx = x2 - x1,
        dy = y2 - y1;
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(x - (x1 + dx * t), y - (y1 + dy * t)));
    }
    return inPoly && best >= radius;
  };
  const sample = (radius: number) => {
    for (let attempt = 0; attempt < 512; attempt++) {
      const x = range(rng, Math.min(...axs), Math.max(...axs));
      const y = range(rng, Math.min(...ays), Math.max(...ays));
      if (!inside(x, y, radius)) continue;
      if (occupied.some((p) => Math.hypot(p.x - x, p.y - y) < p.radius + radius)) continue;
      occupied.push({ x, y, radius });
      return { x, y };
    }
    return null;
  };
  const props: PropDef[] = [];
  const prop = (
    type: string,
    p: { x: number; y: number },
    turn: number,
    size: number,
    extra = {},
  ) => {
    const [x, z] = file([p.x, p.y]);
    props.push({
      type,
      x,
      z,
      turn: Math.round((turn * 180) / Math.PI),
      size: pos(size),
      ...extra,
      from: 1,
    });
  };
  const landmark = feature.look?.landmark;
  if (landmark) {
    const radius = landmark === 'wreck' ? 4.6 : landmark === 'ruins' ? 5.1 : 3.1;
    const p = sample(radius);
    if (p) prop(landmark, p, 0.3, 1.8 / ISLAND_SCALE);
  }
  // Terraced outcrops: a small raised ground each.
  for (let i = 0; i < 4; i++) {
    const p = sample(3.4);
    if (!p) break;
    ground.push({
      outline: Array.from({ length: 7 }, (_, k): Point => {
        const t = (k / 7) * Math.PI * 2;
        return file([p.x + Math.cos(t) * 2.4, p.y + Math.sin(t) * 2.4]);
      }),
      height: pos((RIDGE_TOP + 1.85) / r),
      material: 'grass',
    });
  }
  for (let i = 0; i < (feature.look?.trees ?? 0); i++) {
    const p = sample(2.4);
    if (!p) break;
    const size = treeScale(rng);
    prop('pine', p, rng() * 6, (size * 2.3) / ISLAND_SCALE, { shape: pos((i * 0.37) % 1) });
  }
  for (let i = 0; i < 9; i++) {
    const p = sample(2);
    if (!p) break;
    const size = range(rng, 1.0, 1.7);
    prop('boulder', p, 0, size / ISLAND_SCALE, { variant: i % 2 });
  }
  const design: IslandDesign = {
    id: feature.id,
    name: feature.name ?? feature.id,
    style: 'timber',
    seed,
    coasts: [feature.outline.map(file)],
    ground,
    ...empty(),
    props,
    woods: noWoods(R),
  };
  return { island, design };
}

/**
 * Makes a replayed island pass the island checks: the old islands' tapered layers and cap-edge
 * trees did not have to. Ground stays inside the coast, and a prop on a cliff edge moves to the
 * nearest spot on the same terrace that clears it.
 */
export function settle(design: IslandDesign, R: number, harbour: boolean): IslandDesign {
  const coast = design.coasts[0]!;
  for (const g of design.ground) {
    if (!g.outline) continue;
    g.outline = g.outline.map(([x, z]): Point => {
      let k = 1;
      while (k > 0.3 && coastDistance(x * k, z * k, coast).distance > -0.03) k -= 0.01;
      return [pos(x * k), pos(z * k)];
    });
  }
  const layout = islandLayout(design, 4);
  const kit = islandCheckKit(design, R, harbour);
  for (const p of design.props) {
    const type = PROP_TYPES[p.type];
    if (!type || p.y !== undefined || type.edge || type.water) continue;
    const fit = p.fit ?? kit.fit(p);
    const clear = (x: number, z: number) =>
      layoutGround(layout, x, z, fit) !== null &&
      cliffDistance(layout, x, z) >= fit + 0.005 &&
      // The harbour approach (islandChecks APPROACH) stays open.
      !(harbour && Math.abs(x - 0.08) < 0.12 && z > 0.45);
    if (clear(p.x, p.z)) continue;
    const terrace = layoutGround(layout, p.x, p.z);
    let best: Point | null = null;
    for (let r = 0.005; r < 0.5 && !best; r += 0.005)
      for (let k = 0; k < 24 && !best; k++) {
        const a = (k / 24) * Math.PI * 2;
        const x = p.x + Math.cos(a) * r,
          z = p.z + Math.sin(a) * r;
        if (clear(x, z) && layoutGround(layout, x, z) === terrace) best = [x, z];
      }
    if (best) [p.x, p.z] = [pos(best[0]), pos(best[1])];
  }
  return design;
}

/**
 * Gives a map island (or a ridge of the `terrain` list) its own island file, replayed from how
 * it is drawn now, and points the map at it: the map editor's first "Edit island" on an island
 * without one. Returns the new file, or null when `id` is neither. Other terrain keeps its look:
 * its seed is written down before a ridge leaves the list.
 */
export function giveIslandFile(map: MapDef, id: string): IslandDesign | null {
  const index = map.islands.findIndex((i) => i.id === id);
  const island = map.islands[index];
  if (island) {
    const { design, bearing } = designFromLook(island, map, map.seed * 1000 + index);
    settle(design, island.radius / ISLAND_SCALE, !!island.look?.dock);
    const port = map.ports.find((p) => p.islandId === id && !p.hidden);
    island.look = {
      design: design.id,
      ...(island.look?.dock ? { dock: true } : {}),
      ...(port ? {} : { harbourBearing: pos(bearing) }),
    };
    return design;
  }
  const terrain = map.terrain ?? [];
  const feature = terrain.find((t) => t.id === id && t.kind === 'island');
  if (!feature) return null;
  terrain.forEach((t, i) => (t.seed ??= map.seed * 1709 + i * 97));
  const made = designFromRidge(feature, feature.seed!);
  settle(made.design, made.island.radius / ISLAND_SCALE, false);
  map.terrain = terrain.filter((t) => t !== feature);
  map.islands.push(made.island);
  return made.design;
}
