import * as THREE from 'three';
import type { LandmarkKind } from '../../sim/map';
import { homeDesign } from '../../sim/home';
import { type Rng, createRng, range } from '../../sim/rng';
import { BEACH_TOP, blobShape, isGlowing, paint, paintFaces, slab } from './geometry';
import { type GroundColors, groundColors, styleColor } from '../../data/grounds';
import { coastDistance, insetOutline } from '../../sim/coast';
import { landmarkParts } from './landmarks';
import {
  islandLayout,
  layoutGround,
  characterPiers,
  crossesCliff,
  flatLayout,
  isSloped,
  PEAK_SEGMENTS,
  peakBox,
  type IslandLayout,
  type IslandTheme,
  type LandSurface,
  type LayoutRamp,
  type Outline,
} from '../../sim/islandLayout';
import {
  atLevel,
  islandDesign,
  type IslandDesign,
  type LaneDef,
  type PropDef,
  questDesign,
} from '../../data/islands';
import {
  C,
  PROP_TYPES,
  WOODLAND_TREES,
  barn,
  blocks,
  box,
  broadleaf,
  cabin,
  crates,
  cyl,
  derrick,
  farmhouse,
  fishHouse,
  fishingBoat,
  granary,
  haystack,
  keep,
  lampPost,
  logPile,
  lumber,
  marketHall,
  masons,
  pine,
  put,
  rack,
  sawmill,
  slip,
  smokehouse,
  spireChurch,
  stoneHouse,
  warehouseOf,
  windmill,
  yardHouse,
  bakery,
  type Kind,
  type Parts,
} from './props';
import type { IslandCheckKit } from '../../sim/islandChecks';
import { riverParts } from './rivers';
import { craterPool, groundSpecks, lavaCracks } from './lavaCracks';

/**
 * Settlement growth (decision 0060): a port island's town grows in four steps, hamlet, village,
 * town and port town. Each kind of port has its own island profile, buildings, layout and
 * industry, so Saltmere, Port Calda, Westholm and Stonehaven grow differently. The beach (the
 * collision outline) and the pier line stay where the simulation has them.
 * Every placement is seeded per island and filled in a fixed order, so a level-up only adds.
 */
/** A town level (decision 0113: their number is data). The hand-built looks below stop at 4: a
 * higher level looks like a port town until an island file gives it props of its own. */
export type TownLevel = number;

type Spot = { x: number; y: number; z: number };

// ---------------------------------------------------------------- the island

interface Profile {
  tiers: number;
  /** Tier radius factor, how far the tiers sit back from the harbour and to the side. */
  k: number;
  back: number;
  side: number;
  /** Extra step back per tier, which makes ledges on the harbour side. */
  step: number;
  /** Height of the waterfront shelf, or null for none. */
  shelf: number | null;
}

const PROFILE: Record<Kind, Profile> = {
  // Cliffs pushed to the back and one side so the harbour town gets a long, low waterfront.
  fish: { tiers: 3, k: 0.7, back: 0.3, side: -0.18, step: 0.05, shelf: 0.6 },
  // Low rolling wooded hills.
  timber: { tiers: 2, k: 0.86, back: 0.12, side: 0.1, step: 0.08, shelf: 0.6 },
  // One low terrace, no plateau: the whole island is farmland.
  grain: { tiers: 1, k: 0.95, back: 0, side: 0, step: 0, shelf: null },
  // Tall terraces the town climbs; the quarry cuts into the seaward side.
  stone: { tiers: 4, k: 0.92, back: 0.05, side: 0, step: 0.11, shelf: 0.55 },
  yard: { tiers: 2, k: 0.75, back: 0.28, side: 0.15, step: 0.05, shelf: 0.6 },
};

interface Disc {
  x: number;
  z: number;
  r: number;
  y: number;
}

export interface TownIslandSpec {
  /** Island file id; or a producer `profile`, built from that style's shipped island file. */
  design?: string;
  profile?: IslandTheme;
  seed: number;
  level: TownLevel;
  /** Produced good ('fish', 'timber', 'grain', 'stone'); anything else is a shipyard port. */
  kind?: string;
  /** Island radius in reference units, and its seeded stretch. */
  R: number;
  sx: number;
  sz: number;
  landmark?: LandmarkKind;
  /** Pier line shared with the simulation: x offset, root z and length. */
  pier: { x: number; z0: number; len: number };
  /** False for an island file with no harbour (decision 0110). */
  harbour?: boolean;
  /** The home island's buildings, spot id → building id (decision 0126); none: as first found. */
  homeBuilt?: Record<string, string>;
  /** The quests done, for props tagged `after:` or `before:` one (decision 0130); none: no quest. */
  questsDone?: ReadonlySet<string>;
}

/**
 * The whole port island at its level, in reference units with the harbour toward +Z: terrain,
 * dock, town and industry. The beach is the same as every other island's.
 */
export function townIslandParts(spec: TownIslandSpec): Parts {
  if (spec.design ?? spec.profile)
    return designedTownParts(
      questDesign(
        homeDesign(islandDesign(spec.design ?? spec.profile!), spec.homeBuilt),
        spec.questsDone ?? new Set(),
      ),
      spec.R,
      spec.level,
      spec.harbour,
    );
  const { R, sx, sz, pier } = spec;
  const level = Math.min(Math.max(spec.level, 1), 4);
  const kind: Kind =
    (['fish', 'timber', 'grain', 'stone'] as const).find((k) => k === spec.kind) ?? 'yard';
  const P = PROFILE[kind];
  const rng = createRng(spec.seed);
  /** Independent seeded stream per feature, so one feature's count never shifts another's. */
  const stream = (k: number) => createRng(spec.seed * 7919 + k * 104729);
  const out: Parts = [];

  // Terrain: beach, optional shelf, cliff tiers, grass cap. Discs describe the walkable tops.
  const beach = slab(blobShape(rng, R * 1.1, 14, 0.2, sx, sz), 1.45, 0.85);
  out.push(paint(beach.translate(0, -1, 0), C.sand));
  const discs: Disc[] = [{ x: 0, z: 0, r: R * 0.9, y: 0.45 }];
  if (P.shelf !== null) {
    const shelf = slab(blobShape(rng, R * 0.9, 14, 0.1, sx, sz), P.shelf + 0.3, 0.97);
    out.push(paint(shelf.translate(0, -0.3, R * 0.02), C.grass));
    discs.push({ x: 0, z: R * 0.02, r: R * 0.84, y: P.shelf });
  }
  let y = P.shelf ?? 0;
  const ox = P.side * R;
  let oz = -P.back * R;
  for (let i = 0; i < P.tiers; i++) {
    const h =
      kind === 'grain' ? 0.75 : kind === 'timber' ? range(rng, 1.0, 1.3) : range(rng, 1.15, 1.45);
    const r = R * (0.9 - i * 0.16) * P.k;
    if (i) oz -= P.step * R;
    const layer = slab(blobShape(rng, r, 12, 0.12, sx, sz), h, 0.96);
    out.push(paint(layer.translate(ox, y, oz), i % 2 ? C.rock2 : C.rock));
    y += h;
    discs.push({ x: ox, z: oz, r: r * 0.9, y });
  }
  const top = discs[discs.length - 1]!;
  const capR = top.r * 1.02;
  const cap = slab(blobShape(rng, capR, 12, 0.08, sx, sz), 0.22, 0.97);
  out.push(paint(cap.translate(top.x, top.y, top.z), kind === 'grain' ? C.meadow : C.grass));
  top.y += 0.22;

  /** Ground height at a point, or null on (or near) a cliff edge or off the island. */
  const ground = (x: number, z: number, m: number): number | null => {
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
    // A lane up to the pier.
    !(Math.abs(x - pier.x) < 0.7 + r && z > R * 0.45);
  /** The first candidates (in preference order) that sit on clear ground. */
  const spots = (candidates: { x: number; z: number }[], count: number, r: number) => {
    const found: Spot[] = [];
    for (const c of candidates) {
      if (found.length >= count) break;
      const g = ground(c.x, c.z, r * 0.6);
      if (g === null || !free(c.x, c.z, r)) continue;
      claim(c.x, c.z, r);
      found.push({ x: c.x, y: g, z: c.z });
    }
    return found;
  };
  const scatter = (s: Rng, n: number, maxR: number, a0 = 0, a1 = Math.PI * 2, cx = 0, cz = 0) =>
    Array.from({ length: n }, () => {
      const a = range(s, a0, a1);
      const d = Math.sqrt(s()) * maxR;
      return { x: cx + Math.cos(a) * d * sx, z: cz + Math.sin(a) * d * sz };
    });
  const near = (px: number, pz: number) => (p: { x: number; z: number }, q: typeof p) =>
    Math.hypot(p.x - px, p.z - pz) - Math.hypot(q.x - px, q.z - pz);
  const pierRoot = { x: pier.x, z: pier.z0 };
  /** Front (+Z) turned toward the pier root, or straight out to sea. */
  const facePier = (p: Spot, s: Rng) =>
    Math.atan2(pierRoot.x - p.x, pierRoot.z + 2 - p.z) + (s() - 0.5) * 0.3;
  const faceOut = (p: Spot) => Math.atan2(p.x, p.z);
  const S = 1.25; // town buildings read a little larger than the old fixed houses
  const n = (counts: [number, number, number, number]) => counts[level - 1]!;

  // Dock: plank jetty, a proper pier, a T-head with a lamp, then a second pier with a quay.
  dock(out, level, pier, kind === 'stone' && level >= 3);
  const second = { x: pier.x - R * 0.42, z: pier.z0 - 0.2 };
  claim(second.x, second.z - 0.6, 1.2); // reserved from level 1, built at level 4
  if (level >= 4) secondPier(out, second.x, second.z, pier.len * 0.6, kind === 'stone');
  // Warehouses at the pier root.
  const wh = spots(
    [
      { x: pier.x + 2.1, z: pier.z0 - 1.4 },
      { x: pier.x + 2.4, z: pier.z0 - 3.2 },
    ],
    2,
    1.2,
  );
  if (level >= 2 && wh[0]) put(out, warehouseOf(kind), wh[0].x, wh[0].y, wh[0].z, 0.1, S);
  if (level >= 4 && wh[1]) put(out, warehouseOf(kind), wh[1].x, wh[1].y, wh[1].z, -0.1, S);

  if (kind === 'fish') {
    // A crescent of tall houses facing the sea, a second row behind from level 3.
    const s = stream(1);
    const row = (d: number, shift: number) =>
      Array.from({ length: 30 }, (_, i) => {
        const k = (i % 2 ? 1 : -1) * Math.ceil(i / 2);
        const a = Math.PI / 2 + k * 0.16 + shift;
        return { x: Math.cos(a) * d * R * sx, z: Math.sin(a) * d * R * sz };
      });
    const front = spots(row(0.7, 0), 9, 0.6);
    const back = spots(row(0.5, 0.08), 6, 0.6);
    const homes = [...front.slice(0, 6), ...back.slice(0, 3), ...front.slice(6), ...back.slice(3)];
    homes
      .slice(0, n([3, 6, 9, 13]))
      .forEach((p, i) => put(out, fishHouse(i, s), p.x, p.y, p.z, faceOut(p), S));
    // Drying racks along the beach, more each level.
    for (let i = 0; i < n([1, 2, 4, 6]); i++) {
      const a = Math.PI / 2 + (i % 2 ? 1 : -1) * (0.55 + Math.floor(i / 2) * 0.24);
      const x = Math.cos(a) * 0.86 * R * sx;
      const z = Math.sin(a) * 0.86 * R * sz;
      put(out, rack(), x, 0.45, z, Math.atan2(x, z) + Math.PI / 2, S);
    }
    const low = (c: { x: number; z: number }) => (ground(c.x, c.z, 0) ?? 9) < 1.5;
    const civic = spots(
      scatter(stream(2), 120, 0.75 * R)
        .filter(low)
        .sort(near(pier.x - 1, pier.z0 - 4)),
      4,
      1.2,
    );
    if (level >= 2 && civic[0]) put(out, crates(5), civic[0].x, civic[0].y, civic[0].z, 0.2, S);
    if (level >= 3)
      civic
        .slice(1, level >= 4 ? 3 : 2)
        .forEach((p) => put(out, smokehouse(), p.x, p.y, p.z, facePier(p, s), S));
    if (level >= 4 && civic[3])
      put(out, marketHall(), civic[3].x, civic[3].y, civic[3].z, facePier(civic[3], s), S);
    // Fishing boats at their moorings off the beach (scenery, not solid to the player's ship).
    const moor = [
      { x: pier.x + 2.4, z: pier.z0 + pier.len * 0.5, r: 0.2 },
      { x: pier.x - 2.4, z: pier.z0 + pier.len * 0.7, r: -0.3 },
      { x: pier.x + 2.6, z: pier.z0 + pier.len * 1.05, r: 0.1 },
    ];
    for (const m of moor.slice(0, n([0, 1, 2, 3]))) put(out, fishingBoat(), m.x, 0, m.z, m.r, S);
    trees(out, spots(scatter(stream(3), 60, 0.9 * R), 8, 0.6), broadleaf, stream(4));
  } else if (kind === 'timber') {
    // Cabins in a clearing that widens each level; the forest fills the rest, stumps where cut.
    const s = stream(1);
    if (level >= 3) put(out, slip(level >= 4), pier.x + R * 0.48, 0.45, R * 0.76, 0.55);
    claim(pier.x + R * 0.48, R * 0.76, 1.8);
    const yard = spots(
      scatter(stream(2), 120, 0.7 * R, 0, Math.PI).sort(near(pier.x - 3, pier.z0 - 2)),
      6,
      1.1,
    );
    yard.slice(0, n([1, 2, 3, 4])).forEach((p) => put(out, logPile(), p.x, p.y, p.z, 0.4, S));
    if (level >= 3 && yard[4])
      put(out, sawmill(), yard[4].x, yard[4].y, yard[4].z, facePier(yard[4], s), S);
    if (level >= 3 && yard[5]) put(out, lumber(), yard[5].x, yard[5].y, yard[5].z, 0.3, S);
    const plots = spots(scatter(s, 160, 0.82 * R).sort(near(pierRoot.x, pierRoot.z)), 10, 0.85);
    plots
      .slice(0, n([2, 4, 7, 10]))
      .forEach((p, i) => put(out, cabin(i, s), p.x, p.y, p.z, facePier(p, s), S));
    const clearing = [0.35, 0.5, 0.62, 0.75][level - 1]! * R;
    const st = stream(4);
    for (const p of spots(scatter(stream(3), 300, 0.95 * R), 70, 0.5)) {
      if (Math.hypot(p.x - pierRoot.x, p.z - pierRoot.z) < clearing) {
        if (level > 1) put(out, [cyl(0.14, 0.16, 0.18, 0, 0.09, 0, C.wood)], p.x, p.y, p.z);
      } else put(out, pine(st), p.x, p.y, p.z, st() * 6, 1.1);
    }
  } else if (kind === 'grain') {
    // Farmhouses by the pier, then a patchwork of fields spreading over the island.
    const s = stream(2);
    const core = spots(
      scatter(s, 140, 0.45 * R, 0, Math.PI * 2, pier.x, R * 0.42).sort(
        near(pierRoot.x, pierRoot.z),
      ),
      8,
      0.85,
    );
    core
      .slice(0, n([1, 2, 4, 5]))
      .forEach((p, i) => put(out, farmhouse(i), p.x, p.y, p.z, facePier(p, s), S));
    if (level >= 2 && core[6])
      put(out, barn(), core[6].x, core[6].y, core[6].z, facePier(core[6], s), S);
    if (level >= 4 && core[7])
      put(out, spireChurch(), core[7].x, core[7].y, core[7].z, facePier(core[7], s), S);
    const g = stream(1);
    const cell = R * 0.26;
    const origin = { x: (g() - 0.5) * R * 0.5, z: -R * 0.4 };
    const cells: { x: number; z: number }[] = [];
    for (let i = -4; i <= 4; i++)
      for (let j = -4; j <= 4; j++) cells.push({ x: i * cell, z: j * cell - R * 0.05 });
    const fields = spots(cells.sort(near(origin.x, origin.z)), n([3, 6, 10, 14]), cell * 0.48);
    fields.forEach((c, i) => {
      const w = cell * 0.9;
      const crop = C.crops[Math.floor(g() * C.crops.length)]!;
      const parts = [
        box(w, 0.1, w, 0, 0.05, 0, crop),
        box(w * 0.94, 0.04, 0.06, 0, 0.12, -w * 0.22, C.furrow),
        box(w * 0.94, 0.04, 0.06, 0, 0.12, w * 0.22, C.furrow),
      ];
      put(out, parts, c.x, c.y, c.z, i % 2 ? Math.PI / 2 : 0);
    });
    const farm = spots(scatter(stream(3), 160, 0.8 * R).sort(near(origin.x, origin.z)), 10, 0.85);
    farm.slice(0, n([1, 1, 2, 3])).forEach((p) => put(out, windmill(), p.x, p.y, p.z, 0.4, S));
    if (level >= 3 && farm[3]) put(out, granary(), farm[3].x, farm[3].y, farm[3].z, 0, S);
    if (level >= 3 && core[5])
      put(out, bakery(), core[5].x, core[5].y, core[5].z, facePier(core[5], s), S);
    farm.slice(4, 4 + n([0, 2, 4, 6])).forEach((p) => put(out, haystack(), p.x, p.y, p.z, 0, S));
    trees(out, spots(scatter(stream(4), 80, 0.9 * R), n([7, 6, 5, 4]), 0.6), broadleaf, stream(5));
  } else if (kind === 'stone') {
    // The quarry cuts terraces into the seaward cliff; houses climb the terraces from the shore.
    const quarryA = Math.PI / 2 + 1.0;
    claim(Math.cos(quarryA) * R * 0.5, Math.sin(quarryA) * R * 0.5, R * 0.34);
    quarry(out, level, discs.slice(-P.tiers), quarryA, R, sx, sz);
    const s = stream(1);
    const plots = scatter(s, 320, 0.88 * R, 0.1, Math.PI - 0.1)
      .map((p) => ({
        ...p,
        rank: (ground(p.x, p.z, 0.5) ?? 99) + Math.hypot(p.x - pierRoot.x, p.z - pierRoot.z) * 0.15,
      }))
      .sort((p, q) => p.rank - q.rank);
    spots(plots, 10, 0.62)
      .slice(0, n([2, 4, 7, 10]))
      .forEach((p, i) =>
        put(out, stoneHouse(i), p.x, p.y, p.z, faceOut(p) + (s() - 0.5) * 0.4, 1.15),
      );
    const yard = spots(
      scatter(stream(2), 80, 0.7 * R, 0.5, Math.PI - 0.2).sort(near(pier.x - 2, pier.z0 - 1)),
      4,
      0.9,
    );
    if (level >= 3 && yard[3])
      put(out, masons(), yard[3].x, yard[3].y, yard[3].z, facePier(yard[3], s), S);
    yard
      .slice(0, n([1, 1, 2, 3]))
      .forEach((p, i) => put(out, blocks(n([3, 4, 5, 6]) - i), p.x, p.y, p.z, 0.3, S));
    if (level >= 4) put(out, keep(), top.x, top.y, top.z, 0.3, 1.3);
    claim(top.x, top.z, 1.6);
    trees(
      out,
      spots(scatter(stream(3), 40, top.r * 0.8, 0, Math.PI * 2, top.x, top.z), 3, 0.5),
      pine,
      stream(4),
    );
  } else {
    // Shipyard port: a slipway whose ship grows from keel and ribs to a planked hull.
    const s = stream(1);
    if (level >= 2) put(out, slip(level >= 4), pier.x + R * 0.45, 0.45, R * 0.74, 0.55);
    claim(pier.x + R * 0.45, R * 0.74, 1.8);
    if (spec.landmark) claim(top.x, top.z, capR * 0.6);
    const homes = spots(
      scatter(s, 140, 0.8 * R, 0, Math.PI).sort(near(pierRoot.x, pierRoot.z)),
      8,
      0.8,
    );
    homes
      .slice(0, n([2, 3, 5, 8]))
      .forEach((p, i) => put(out, yardHouse(i), p.x, p.y, p.z, facePier(p, s), S));
    trees(out, spots(scatter(stream(2), 60, 0.9 * R), 8, 0.6), pine, stream(3));
  }

  if (spec.landmark)
    put(out, landmarkParts(spec.landmark, Math.min(1.15, capR / 3.8)), top.x, top.y, top.z, 0.2);
  return out;
}

function trees(out: Parts, at: Spot[], make: (r: Rng) => Parts, s: Rng) {
  for (const p of at) put(out, make(s), p.x, p.y, p.z, s() * 6, 1.1);
}

/** The pier on the simulation's line: wider and sturdier each level, a T-head from level 3. */
function dock(out: Parts, level: TownLevel, pier: TownIslandSpec['pier'], stone: boolean) {
  const { x, z0, len } = pier;
  const w = [0.6, 0.9, 1.1, 1.1][level - 1]!;
  const deck = stone ? C.stone : level === 1 ? '#a8805a' : C.wood;
  out.push(deckOf(box(w, 0.2, len, x, 0.45, z0 + len / 2, deck)));
  const posts = level === 1 ? [0.5, 1.0] : [0.3, 0.6, 0.95];
  for (const k of [-1, 1])
    for (const t of posts) {
      if (stone) out.push(box(0.3, 1.2, 0.3, x + k * (w / 2), -0.1, z0 + len * t, C.stoneDark));
      else out.push(cyl(0.08, 0.08, 1.2, x + k * (w / 2 - 0.05), 0, z0 + len * t, C.post, 5));
    }
  if (level >= 2)
    for (const k of [-1, 1])
      out.push(cyl(0.09, 0.11, 0.25, x + k * (w / 2 - 0.15), 0.67, z0 + len * 0.9, '#3d3d3d'));
  if (level >= 3) {
    out.push(deckOf(box(2.8, 0.2, 1.0, x, 0.45, z0 + len - 0.4, deck)));
    for (const k of [-1, 1])
      out.push(cyl(0.08, 0.08, 1.2, x + k * 1.3, 0, z0 + len - 0.4, C.post, 5));
    put(out, lampPost(), x + 1.2, 0.55, z0 + len - 0.4);
  }
}

/** Tags a deck the ship must not sail through; tests match it to a collision pier (0082). */
function deckOf(g: THREE.BufferGeometry) {
  g.userData.solid = 'pier';
  return g;
}

function secondPier(out: Parts, x: number, z0: number, len: number, stone: boolean) {
  out.push(deckOf(box(0.9, 0.2, len, x, 0.45, z0 + len / 2, stone ? C.stone : C.wood)));
  for (const k of [-1, 1])
    for (const t of [0.4, 0.95])
      out.push(cyl(0.08, 0.08, 1.2, x + k * 0.4, 0, z0 + len * t, C.post, 5));
  out.push(deckOf(box(2.6, 0.5, 0.7, x, 0.3, z0 - 0.1, C.stoneDark)));
}

/**
 * Quarry terraces cut into the seaward cliff, from the top tier down: each level cuts one more
 * pale step, with cut blocks and, from the second cut, a derrick crane.
 */
function quarry(
  out: Parts,
  level: TownLevel,
  tiers: Disc[],
  a: number,
  R: number,
  sx: number,
  sz: number,
) {
  const dx = Math.cos(a);
  const dz = Math.sin(a);
  const face = Math.atan2(dx, dz);
  for (let i = 0; i < level && i < tiers.length; i++) {
    const t = tiers[tiers.length - 1 - i]!;
    const x = t.x + dx * t.r * 0.92 * sx;
    const z = t.z + dz * t.r * 0.92 * sz;
    const cutW = R * (0.22 + i * 0.05);
    out.push(
      paint(
        new THREE.BoxGeometry(cutW, 1.3, R * 0.18).rotateY(face).translate(x, t.y - 0.6, z),
        C.cut,
      ),
    );
    if (i >= 1) put(out, derrick(), x - dx * 0.8, t.y - 0.05, z - dz * 0.8, face);
    put(out, blocks(3), x + dz * 1.4, t.y - 0.05, z - dx * 1.4, face);
  }
}

/** Height a prop stands at, in reference units: the ground under it, else the sand, else the sea. */
export function standHeight(layout: IslandLayout, x: number, z: number, R: number) {
  const h = layoutGround(layout, x, z, 0);
  if (h !== null) return h * R;
  return layout.coasts.some((c) => coastDistance(x, z, c).distance < 0) &&
    !(layout.lake && coastDistance(x, z, layout.lake).distance < 0)
    ? BEACH_TOP
    : 0;
}

/** The half-diagonal of a model's plan, the footprint the old town code checked with. */
function extent(parts: Parts) {
  const bounds = new THREE.Box3();
  for (const g of parts) {
    g.computeBoundingBox();
    bounds.union(g.boundingBox!);
  }
  return Math.hypot(
    Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
    Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)),
  );
}

/** A catalogue prop's parts, not yet placed, with its game hooks set. */
export function propParts(prop: PropDef, design: IslandDesign, R: number): Parts {
  const type = PROP_TYPES[prop.type];
  if (!type) throw new Error(`Unknown prop type "${prop.type}" on ${design.id}`);
  const parts = type.build({
    R,
    style: design.style,
    variant: prop.variant ?? 0,
    shape: prop.shape ?? 0.5,
    size: prop.size ?? 1,
    length: prop.length,
  });
  const tags = prop.tags ?? [];
  if (tags.includes('workshop')) parts[0]!.userData.workshop = design.style;
  if (tags.includes('windmill')) parts[0]!.userData.windmill = { x: prop.x, z: prop.z };
  const yard = tags.find((t) => t.startsWith('log-yard:'));
  if (yard) parts[0]!.userData.logYard = yard.slice('log-yard:'.length);
  if (prop.type === 'field') parts[0]!.userData.field = { x: prop.x, z: prop.z };
  return parts;
}

/** Is this prop one of the island's numbered residences? */
export const isResidence = (prop: PropDef) =>
  !!PROP_TYPES[prop.type]?.home && !prop.tags?.includes('outbuilding');

/**
 * A designed port island at its level, built from its island file (decision 0101): terrain,
 * stairs and paths, the lake, lanes near standing homes, homes, the docks, props and woods.
 */
export function designedTownParts(
  design: IslandDesign,
  R: number,
  level: TownLevel,
  /** False for an island with no harbour (decision 0110): no arrival pier, flag or side piers. */
  harbour = true,
): Parts {
  const layout = islandLayout(design, level);
  const stone = design.style === 'stone';
  // Grounds as data (palette.json › grounds): the style swaps the file's names for its own.
  const ground = (material: string) => groundColors(material, design.style);
  const beach = ground('sand');
  const out: Parts = [];
  const shape = (outline: Outline, holes: Outline[] = []) => {
    const s = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x * R, -z * R)));
    s.holes = holes.map((h) => new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x * R, -z * R))));
    return s;
  };
  const terrain = (
    outline: Outline,
    bottom: number,
    top: number,
    look: GroundColors,
    holes: Outline[] = [],
  ) => {
    const g = new THREE.ExtrudeGeometry(shape(outline, holes), {
      depth: top - bottom,
      bevelEnabled: false,
      curveSegments: 1,
    });
    g.rotateX(-Math.PI / 2).translate(0, bottom, 0);
    // The extrusion's first group is its caps, the second its sides (cliffs).
    const sideFrom = (g.groups[1]?.start ?? Infinity) / 3;
    out.push(
      paintFaces(g, look.top, (_x, _y, _z, face) => (face >= sideFrom ? look.side : undefined)),
    );
  };
  for (const coast of layout.coasts)
    terrain(coast, -1, BEACH_TOP, beach, layout.lake ? [layout.lake] : []);
  for (const s of layout.surfaces) {
    const look = ground(s.material);
    if (s.shape === 'peak') {
      const { cx, cz, rx, rz } = peakBox(s);
      const mountainBase = (s.base ?? 0) * R;
      const height = s.height * R - mountainBase;
      // A snow line (capAbove) needs rings up the cone to fall on; plain peaks keep one. A
      // volcano's cone is cut off at its crater's rim (decision 0171).
      const rings = look.cap ? 4 : 1;
      const g = (
        s.crater
          ? new THREE.CylinderGeometry(R * s.crater, R, height, PEAK_SEGMENTS, rings)
          : new THREE.ConeGeometry(R, height, PEAK_SEGMENTS, rings)
      )
        .scale(rx, 1, rz)
        .translate(cx * R, (s.height * R + mountainBase) / 2, cz * R);
      const line = mountainBase + height * (look.capAbove ?? 1);
      out.push(paintFaces(g, look.peak, (_x, y) => (look.cap && y > line ? look.cap : undefined)));
      if (s.crater) out.push(craterPool(s, R, look.glow ?? look.side[0]!, !!look.glow));
    } else terrain(s.outline, BEACH_TOP, s.height * R, look, s.holes);
  }
  // Sloped edges (decision 0096 §4): a ramp down from the top, outward, to the ground below.
  for (const s of layout.surfaces)
    if (s.slope && s.shape !== 'peak') out.push(ramp(layout, s, R, ground(s.material).top));
  // Ramps that climb along their length (decision 0123).
  for (const r of layout.ramps) out.push(...rampBand(r, R, ground(r.material)));
  // Glowing parts (a crater's lava) go to the windows' mesh, not the terrain's.
  for (const g of out) if (!isGlowing(g)) g.userData.islandTerrain = true;
  const pathColor = styleColor('path', design.style) as string;
  for (const lane of design.lanes) {
    if (lane.kind === 'stairs') stairs(out, lane, R);
    else if (lane.kind === 'path') {
      const path = new THREE.CatmullRomCurve3(
        lane.points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      );
      // At a fixed height, or along the ground: up slopes, never across a cliff or water.
      const p = path.getSpacedPoints(
        lane.y === undefined ? Math.ceil(path.getLength() / 0.03) : 25,
      );
      for (let i = 1; i < p.length; i++) {
        const a = p[i - 1]!,
          b = p[i]!;
        const len = a.distanceTo(b) * R;
        const g = paint(
          new THREE.PlaneGeometry(len + 0.02, R * 0.055).rotateX(-Math.PI / 2),
          pathColor,
        );
        let y = lane.y;
        if (y === undefined) {
          const ha = layoutGround(layout, a.x, a.z),
            hb = layoutGround(layout, b.x, b.z);
          if (ha === null || hb === null || crossesCliff(layout, a.x, a.z, b.x, b.z)) continue;
          y = (ha + hb) / 2;
          g.rotateZ(Math.atan2((hb - ha) * R, len));
        }
        put(
          out,
          [g],
          ((a.x + b.x) * R) / 2,
          y * R + 0.015,
          ((a.z + b.z) * R) / 2,
          -Math.atan2(b.z - a.z, b.x - a.x),
        );
      }
    }
  }
  if (layout.lake) {
    const lakeStart = out.length;
    terrain(insetOutline(layout.lake, -0.035), BEACH_TOP, 0.55, beach, [layout.lake]);
    // A true hole through the terrain; an independent still-water surface above the ocean.
    const water = new THREE.ShapeGeometry(shape(layout.lake));
    water.rotateX(-Math.PI / 2).translate(0, 0.5, 0);
    out.push(paint(water, '#319eae'));
    for (const g of out.slice(lakeStart)) g.userData.islandTerrain = true;
  }
  // Glowing cracks on lava fields and down a volcano's flanks (decision 0171).
  out.push(...lavaCracks(layout, (m) => ground(m).glow, design.seed, R));
  for (const g of groundSpecks(layout, (m) => ground(m).specks, design.seed, R)) {
    g.userData.islandTerrain = true;
    out.push(g);
  }
  // Rivers of water or lava (decision 0167) lie on the ground built above.
  for (const river of design.rivers ?? [])
    if (atLevel(river, level) && river.points.length >= 2)
      out.push(...riverParts(layout, river, R));

  const standing = design.props.filter((p) => atLevel(p, level));
  /** Places a prop's parts (into `into`) and returns how far it clears the woods. */
  const place = (prop: PropDef, parts: Parts, into: Parts = out) => {
    const type = PROP_TYPES[prop.type]!;
    const size = prop.size ?? 1;
    const clear = prop.clear ?? (extent(parts) * size) / R + 0.1;
    const y = prop.y !== undefined ? prop.y * R : standHeight(layout, prop.x, prop.z, R);
    put(
      into,
      parts,
      prop.x * R,
      y,
      prop.z * R,
      ((prop.turn ?? 0) * Math.PI) / 180,
      type.sizedInModel ? 1 : size,
    );
    return clear;
  };

  // Homes, numbered in file order; lanes appear piece by piece near the ones that stand.
  const homes: Parts[] = [];
  const active: { x: number; z: number }[] = [];
  design.props.filter(isResidence).forEach((prop, i) => {
    if (!atLevel(prop, level)) return;
    const parts = propParts(prop, design, R);
    place(prop, parts, []);
    const bounds = new THREE.Box3();
    for (const g of parts) {
      g.computeBoundingBox();
      bounds.union(g.boundingBox!);
    }
    parts[0]!.userData.residence = i;
    parts[0]!.userData.buildingBounds = {
      minX: bounds.min.x,
      maxX: bounds.max.x,
      minZ: bounds.min.z,
      maxZ: bounds.max.z,
    };
    homes.push(parts);
    active.push({ x: prop.x, z: prop.z });
  });
  // Lane pieces near standing homes, with no roads across water or cliffs.
  const clearedLanes: { x: number; z: number }[] = [];
  for (const lane of design.lanes) {
    if (lane.kind && lane.kind !== 'lane') continue;
    const street = new THREE.CatmullRomCurve3(
      lane.points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      'centripetal',
    );
    const points = street.getSpacedPoints(110);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!,
        b = points[i]!;
      const x = (a.x + b.x) / 2,
        z = (a.z + b.z) / 2;
      const h = layoutGround(layout, x, z, 0.025);
      if (h === null || !active.some((p) => Math.hypot(p.x - x, p.z - z) < 0.3)) continue;
      const ha = layoutGround(layout, a.x, a.z, 0.025),
        hb = layoutGround(layout, b.x, b.z, 0.025);
      // On one level, or climbing a slope (never across a cliff).
      const flat = ha === h && hb === h;
      if (!flat && (ha === null || hb === null || crossesCliff(layout, a.x, a.z, b.x, b.z)))
        continue;
      clearedLanes.push({ x, z });
      const len = a.distanceTo(b) * R;
      const g = paint(
        new THREE.PlaneGeometry(len + 0.01, R * 0.04).rotateX(-Math.PI / 2).translate(0, 0.012, 0),
        pathColor,
      );
      if (!flat) g.rotateZ(Math.atan2((hb! - ha!) * R, len));
      put(out, [g], x * R, h * R, z * R, -Math.atan2(b.z - a.z, b.x - a.x));
    }
  }
  for (const parts of homes) out.push(...parts);

  // The same blue-and-white harbour flag identifies the player berth at every port.
  if (harbour) harbourParts(out, design, R, level, stone);

  // Every other prop, in file order; fields claim woodland as the settlement grows.
  const occupied: { x: number; z: number; clear: number }[] = [];
  const fields: { x: number; z: number }[] = [];
  for (const prop of standing) {
    if (isResidence(prop)) continue;
    const clear = place(prop, propParts(prop, design, R));
    if (prop.type === 'field') fields.push(prop);
    else occupied.push({ x: prop.x, z: prop.z, clear });
  }

  // Fixed candidate trees keep untouched woods stable; occupied land alone clears them.
  const woods = design.woods;
  const make = WOODLAND_TREES[woods.tree]!;
  const finalLayout = islandLayout(design);
  // No trees on grounds that carry none (rock, ice): by the height of their tops.
  const rockHeights = layout.surfaces.filter((s) => !ground(s.material).trees).map((s) => s.height);
  const treesRng = createRng(design.seed + 789);
  const forest: { x: number; z: number }[] = [];
  const [x0, z0, x1, z1] = woods.area;
  for (let i = 0; i < woods.tries; i++) {
    const x = range(treesRng, x0, x1),
      z = range(treesRng, z0, z1);
    const buildTree = make(treesRng);
    const yaw = treesRng() * 6;
    const h = layoutGround(layout, x, z, woods.margin);
    // No trees on rock, nor where the grown town's ground (a level-4 quarry) will not carry one.
    if (
      h === null ||
      layoutGround(finalLayout, x, z, woods.margin) === null ||
      rockHeights.includes(h)
    )
      continue;
    const spacing = woods.spacingAt?.find(([at]) => at === h)?.[1] ?? woods.spacing;
    if (forest.some((p) => Math.hypot(p.x - x, p.z - z) < spacing)) continue;
    forest.push({ x, z });
    if (
      active.some((p) => Math.hypot(p.x - x, p.z - z) < 0.19) ||
      clearedLanes.some((p) => Math.hypot(p.x - x, p.z - z) < 0.09) ||
      occupied.some((p) => Math.hypot(p.x - x, p.z - z) < p.clear) ||
      fields.some((p) => Math.abs(p.x - x) < 0.22 && Math.abs(p.z - z) < 0.22) ||
      (woods.areas?.length && !woods.areas.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)) ||
      (harbour && Math.abs(x - 0.08) < 0.14 && z > 0.45) ||
      woods.clear?.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)
    )
      continue;
    const tree = buildTree();
    tree[0]!.userData.tree = { x, z };
    put(out, tree, x * R, h * R, z * R, yaw, woods.size);
  }
  return out.map(withoutUndersides);
}

/** The arrival pier with the player's flag, and the island file's side piers. */
function harbourParts(
  out: Parts,
  design: IslandDesign,
  R: number,
  level: TownLevel,
  stone: boolean,
) {
  const piers = characterPiers(design, R, level);
  const arrival = piers[0]!;
  dock(out, level, arrival, stone && level >= 3);
  if (level < 3) put(out, lampPost(), arrival.x + 0.25, 0.55, arrival.z0 + arrival.len - 0.4);
  const flag = [
    cyl(0.055, 0.07, 3.0, 0, 1.5, 0, C.post, 5),
    box(1.1, 0.8, 0.05, 0.55, 2.5, 0, '#f8f3ea'),
    box(0.45, 0.8, 0.055, 0.85, 2.5, 0, '#3f74a8'),
  ];
  flag[0]!.userData.playerBerth = true;
  put(out, flag, arrival.x - 0.33, 0.55, arrival.z0 + arrival.len - 0.35);
  // A pale landing strip makes the longest pier stand out without filling the water lane.
  out.push(
    box(
      0.35,
      0.025,
      Math.min(2.4, arrival.len),
      arrival.x,
      0.565,
      arrival.z0 + arrival.len - 1.2,
      '#f2d9a0',
    ),
  );
  // Additional finger piers use the shared harbour plan (including their collision segments).
  for (const p of piers.slice(1)) secondPier(out, p.x, p.z0, p.len, stone);
}

/**
 * The ramp of a sloped outline: a band from each sloped edge's top, outward by the slope's
 * width, down to the ground below, with a fan at each bend between two sloped edges.
 */
function ramp(layout: IslandLayout, s: LandSurface, R: number, colors: string[]) {
  const o = s.outline;
  const w = s.slope!;
  let area = 0;
  for (let i = 0; i < o.length; i++) {
    const a = o[i]!,
      b = o[(i + 1) % o.length]!;
    area += a[0] * b[1] - b[0] * a[1];
  }
  const out = area > 0 ? -1 : 1;
  const normal = (i: number) => {
    const a = o[i % o.length]!,
      b = o[(i + 1) % o.length]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [((b[1] - a[1]) / l) * out, (-(b[0] - a[0]) / l) * out] as const;
  };
  // Down to the ground below, not up a mountain's flat outline (its cone stands over the foot).
  const flat = flatLayout(layout);
  const foot = (x: number, z: number) => (layoutGround(flat, x, z) ?? 0) * R;
  const positions: number[] = [];
  const v = (x: number, y: number, z: number) => positions.push(x * R, y, z * R);
  /** One triangle, wound to face up. */
  const tri = (p: number[], q: number[], r: number[]) => {
    const up = (q[0]! - p[0]!) * (r[2]! - p[2]!) - (q[2]! - p[2]!) * (r[0]! - p[0]!) < 0;
    for (const [x, y, z] of up ? [p, q, r] : [p, r, q]) v(x!, y!, z!);
  };
  const top = s.height * R;
  for (let i = 0; i < o.length; i++) {
    if (!isSloped(s, i)) continue;
    const a = o[i]!,
      b = o[(i + 1) % o.length]!;
    const [nx, nz] = normal(i);
    const fa = [a[0] + nx * w, a[1] + nz * w],
      fb = [b[0] + nx * w, b[1] + nz * w];
    const A = [a[0], top, a[1]],
      B = [b[0], top, b[1]],
      FA = [fa[0]!, foot(fa[0]!, fa[1]!), fa[1]!],
      FB = [fb[0]!, foot(fb[0]!, fb[1]!), fb[1]!];
    tri(A, B, FB);
    tri(A, FB, FA);
    // The bend to the next edge, when it slopes too: a fan round the corner.
    if (isSloped(s, (i + 1) % o.length)) {
      const [mx, mz] = normal(i + 1);
      const fc = [b[0] + mx * w, b[1] + mz * w];
      tri(B, FB, [fc[0]!, foot(fc[0]!, fc[1]!), fc[1]!]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return paintFaces(g, colors);
}

/**
 * A ramp along its points (decision 0123): a band rising evenly from start to end, with rock
 * sides and ends down to the beach. Corners are mitred so the band keeps its width.
 */
function rampBand(r: LayoutRamp, R: number, look: GroundColors): Parts {
  const p = r.points;
  const total = r.along[r.along.length - 1]! || 1;
  const half = r.width / 2;
  const dir = (i: number) => {
    const [ax, az] = p[Math.max(0, i - 1)]!,
      [bx, bz] = p[Math.min(p.length - 1, Math.max(1, i))]!;
    const l = Math.hypot(bx - ax, bz - az) || 1;
    return [(bx - ax) / l, (bz - az) / l] as const;
  };
  // Left and right edge of each cross-section and its height.
  const sections = p.map(([x, z], i) => {
    const [ux, uz] = dir(i),
      [vx, vz] = dir(i + 1);
    let nx = -(uz + vz),
      nz = ux + vx;
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    // Mitre: as wide as the band across both runs, no more than twice at a sharp bend.
    const k = Math.min(2, 1 / Math.max(0.5, Math.abs(nx * -uz + nz * ux)));
    const y = (r.start + ((r.end - r.start) * r.along[i]!) / total) * R;
    return {
      left: [(x + nx * half * k) * R, y, (z + nz * half * k) * R],
      right: [(x - nx * half * k) * R, y, (z - nz * half * k) * R],
    };
  });
  const top: number[] = [],
    sides: number[] = [];
  const quad = (to: number[], a: number[], b: number[], c: number[], d: number[]) =>
    to.push(...a, ...b, ...c, ...a, ...c, ...d);
  const low = (v: number[]) => [v[0]!, BEACH_TOP, v[2]!];
  for (let i = 1; i < sections.length; i++) {
    const a = sections[i - 1]!,
      b = sections[i]!;
    quad(top, a.left, a.right, b.right, b.left);
    quad(sides, low(a.left), a.left, b.left, low(b.left));
    quad(sides, a.right, low(a.right), low(b.right), b.right);
  }
  const first = sections[0]!,
    last = sections[sections.length - 1]!;
  quad(sides, low(first.right), first.right, first.left, low(first.left));
  quad(sides, low(last.left), last.left, last.right, low(last.right));
  const mesh = (positions: number[], c: string[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    // Wound either way round: both faces drawn by flipping to face up or out.
    const faced = new THREE.BufferGeometry();
    const both = [...positions];
    for (let i = 0; i < positions.length; i += 9)
      both.push(
        ...positions.slice(i, i + 3),
        ...positions.slice(i + 6, i + 9),
        ...positions.slice(i + 3, i + 6),
      );
    faced.setAttribute('position', new THREE.Float32BufferAttribute(both, 3));
    g.dispose();
    return paintFaces(faced, c);
  };
  return [mesh(top, look.top), mesh(sides, look.side)];
}

/** Stairs over a cliff: treads on full masonry down to `base`, a landing at each bend. */
function stairs(out: Parts, lane: LaneDef, R: number) {
  const base = lane.base ?? 0;
  for (let k = 1; k < lane.points.length; k++) {
    const a = lane.points[k - 1]!,
      b = lane.points[k]!;
    for (let i = 0; i < 12; i++) {
      const t = (i + 0.5) / 12,
        x = a[0]! + (b[0]! - a[0]!) * t,
        z = a[1]! + (b[1]! - a[1]!) * t;
      const y = a[2]! + (b[2]! - a[2]!) * t;
      const length = (Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!) * R) / 12;
      // Full masonry beneath each tread bears on the dry lower terrace.
      const supportHeight = (y - base) * R;
      const step = box(
        length + 0.02,
        supportHeight + 0.03,
        R * 0.085,
        0,
        -supportHeight / 2,
        0,
        C.cut,
      );
      put(out, [step], x * R, y * R, z * R, -Math.atan2(b[1]! - a[1]!, b[0]! - a[0]!));
    }
  }
  for (const p of lane.points.slice(1, -1))
    put(out, [box(R * 0.13, 0.12, R * 0.12, 0, 0, 0, C.cut)], p[0]! * R, p[2]! * R, p[1]! * R);
}

/** Omit horizontal undersides: every island is viewed from above the sea. */
function withoutUndersides(g: THREE.BufferGeometry) {
  const normal = g.getAttribute('normal');
  const keep: number[] = [];
  for (let i = 0; i < normal.count; i += 3)
    if (!(normal.getY(i) < -0.999 && normal.getY(i + 1) < -0.999 && normal.getY(i + 2) < -0.999))
      keep.push(i, i + 1, i + 2);
  if (keep.length === normal.count) return g;
  const trimmed = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(g.attributes)) {
    const values = new Float32Array(keep.length * attribute.itemSize);
    keep.forEach((index, j) => {
      for (let k = 0; k < attribute.itemSize; k++)
        values[j * attribute.itemSize + k] = attribute.array[index * attribute.itemSize + k]!;
    });
    trimmed.setAttribute(
      name,
      new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized),
    );
  }
  trimmed.userData = g.userData;
  g.dispose();
  return trimmed;
}

/** Convex hull of a model's plan, in reference units. */
function planHull(parts: Parts): [number, number][] {
  const points: [number, number][] = [];
  for (const g of parts) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) points.push([p.getX(i), p.getZ(i)]);
  }
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a: number[], b: number[], c: number[]) =>
    (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!);
  const half = (ps: [number, number][]) => {
    const h: [number, number][] = [];
    for (const p of ps) {
      while (h.length > 1 && cross(h[h.length - 2]!, h[h.length - 1]!, p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(points), ...half([...points].reverse())];
}

/** What src/sim/islandChecks.ts needs from the models, for an island of radius R. */
export function islandCheckKit(design: IslandDesign, R: number, harbour = true): IslandCheckKit {
  const built = (prop: PropDef) => {
    const parts = propParts(prop, design, R);
    const scale = PROP_TYPES[prop.type]!.sizedInModel ? 1 : (prop.size ?? 1);
    return { parts, scale };
  };
  return {
    R,
    harbour,
    types: PROP_TYPES,
    woodlandTrees: Object.keys(WOODLAND_TREES),
    fit: (prop) => {
      const type = PROP_TYPES[prop.type]!;
      const { parts, scale } = built(prop);
      const fit = type.fitRadius ?? ((type.fit ?? extent(parts)) * scale) / R;
      parts.forEach((g) => g.dispose());
      return fit;
    },
    footprint: (prop) => {
      const { parts, scale } = built(prop);
      put([], parts, prop.x * R, 0, prop.z * R, ((prop.turn ?? 0) * Math.PI) / 180, scale);
      const hull = planHull(parts).map(([x, z]): [number, number] => [x / R, z / R]);
      parts.forEach((g) => g.dispose());
      return hull;
    },
    triangles: (level) => {
      const parts = designedTownParts(design, R, level as TownLevel, harbour);
      const count = parts.reduce((n, g) => n + g.getAttribute('position').count / 3, 0);
      parts.forEach((g) => g.dispose());
      return count;
    },
  };
}
