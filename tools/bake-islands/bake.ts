/**
 * One-off bake of the four port islands into island files (decision 0097). It runs the old code
 * (the legacy copy in tests/helpers/legacy) and writes what it builds as data:
 *   node tools/bake-islands/run.mjs        -> src/data/islands/<id>.json
 * Coasts, ground, lanes and the plan homes come straight out of the old functions; the per-kind
 * placements of the old `characterTownParts` are transcribed below, level by level, and merged into
 * props with `from` and `to`. tests/island-files-proof.test.ts then proves the files rebuild the
 * very same geometry, so any slip in this transcription fails a test instead of moving a house.
 */
import * as THREE from 'three';
import { insetOutline } from '../../src/sim/coast';
import { createRng } from '../../src/sim/rng';
import * as L from '../../tests/helpers/legacy/towns';
import {
  characterPiers,
  fishingMoorings,
  islandLayout,
  layoutGround,
  type IslandLayout,
  type IslandTheme,
} from '../../tests/helpers/legacy/islandLayout';

type Parts = THREE.BufferGeometry[];
type Level = 1 | 2 | 3 | 4;

export const ISLANDS = [
  { id: 'calda', name: 'Port Calda', style: 'timber', radius: 26, seed: 7000 },
  { id: 'saltmere', name: 'Saltmere', style: 'fish', radius: 24, seed: 7001 },
  { id: 'westholm', name: 'Westholm', style: 'grain', radius: 24, seed: 7002 },
  { id: 'south-cay', name: 'Stonehaven', style: 'stone', radius: 23, seed: 7003 },
] as const;

const r6 = (v: number) => Math.round(v * 1e6) / 1e6 || 0;
const r4 = (v: number) => Math.round(v * 1e4) / 1e4 || 0;
const deg = (rad: number) => r4((rad * 180) / Math.PI);
const pts = (o: [number, number][]) => o.map(([x, z]) => [r6(x), r6(z)]);

interface Placement {
  type: string;
  x: number;
  z: number;
  turn?: number;
  size?: number;
  variant?: number;
  shape?: number;
  length?: number;
  y?: number;
  fit?: number;
  clear?: number;
  tags?: string[];
}

/** placeAt's margin: the model's half-diagonal times its scale, in radius units. */
function margin(parts: Parts, scale: number, R: number) {
  const bounds = new THREE.Box3();
  for (const g of parts) {
    g.computeBoundingBox();
    bounds.union(g.boundingBox!);
  }
  parts.forEach((g) => g.dispose());
  return (
    (Math.hypot(
      Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
      Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)),
    ) *
      scale) /
    R
  );
}

/** The height the island builder picks by itself: ground, else beach sand, else the sea. */
function autoHeight(layout: IslandLayout, x: number, z: number, R: number) {
  const h = layoutGround(layout, x, z, 0);
  if (h !== null) return h * R;
  return layout.coasts.some((c) => insideOutline(x, z, c)) ? 0.3 : 0;
}
function insideOutline(x: number, z: number, o: [number, number][]) {
  let inside = false;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const [xi, zi] = o[i]!,
      [xj, zj] = o[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** The old per-kind placements at one level, in the order the old code drew them. */
function placements(kind: IslandTheme, level: Level, R: number, seed: number): Placement[] {
  const layout = islandLayout(kind, level);
  const out: Placement[] = [];
  /** placeAt: kept only where its footprint fits the ground; clears woods by its margin. */
  const placeAt = (
    type: string,
    parts: Parts,
    x: number,
    z: number,
    scale = 1.1,
    footprint?: number,
    extra: Partial<Placement> = {},
  ) => {
    const m = margin(parts, scale, R);
    if (layoutGround(layout, x, z, footprint ?? m) === null) return;
    out.push({ type, x, z, size: scale, fit: footprint, ...extra });
  };
  /** put: drawn as is at a given height (world units), never checked, clears nothing unless told. */
  const put = (
    type: string,
    x: number,
    y: number,
    z: number,
    rot: number,
    scale: number,
    extra: Partial<Placement> = {},
  ) => {
    const auto = autoHeight(layout, x, z, R);
    out.push({
      type,
      x,
      z,
      turn: rot,
      size: scale,
      clear: 0,
      ...(Math.abs(auto - y) > 1e-9 ? { y: y / R } : {}),
      ...extra,
    });
  };
  const roof = L.STYLE[kind].roofs[0]!;
  if (level >= 2) placeAt('warehouse', L.warehouse(roof), -0.2, 0.5);
  if (level >= (kind === 'timber' || kind === 'stone' ? 3 : 4)) {
    const civic =
      kind === 'fish'
        ? (['market-hall', L.marketHall()] as const)
        : kind === 'timber'
          ? (['sawmill', L.workingSawmill()] as const)
          : kind === 'stone'
            ? (['masons', L.masons()] as const)
            : (['spire-church', L.spireChurch()] as const);
    placeAt(
      civic[0],
      civic[1],
      kind === 'fish' ? 0.15 : kind === 'timber' ? -0.05 : kind === 'stone' ? 0.68 : -0.35,
      kind === 'fish' ? -0.45 : kind === 'timber' ? -0.2 : kind === 'stone' ? 0.12 : -0.25,
      2.0,
      kind === 'stone' ? 0.025 : 0.12,
      kind === 'timber' || kind === 'stone' ? { tags: ['workshop'] } : {},
    );
  }
  const features = [1, 2, 4, 6][level - 1]!;
  if (kind === 'fish') {
    for (let i = 0; i < features + 2; i++) {
      const x = -1.1 + (i % 4) * 0.28,
        z = 0.52 - Math.floor(i / 4) * 0.22;
      const drying = L.rack();
      for (let f = 0; f < 5; f++)
        drying.push(L.cyl(0.04, 0.1, 0.3, -0.45 + f * 0.22, 0.55, 0.06, '#cad7d5', 5));
      placeAt('drying-rack', drying, x, z, 1.5, 0.06);
      placeAt('crates', L.crates(2), x, z - 0.09, 1.0, 0.04, { variant: 2 });
    }
    placeAt('smokehouse', L.smokehouse(), 0.85, 0.06, level >= 3 ? 2.1 : 1.45, 0.1, {
      tags: ['workshop'],
    });
    put('lighthouse', 1.95, 0.12 * R, -0.65, 0, 0.8);
    if (level >= 3) {
      const rng = createRng(seed);
      placeAt('fish-house', L.fishHouse(1, createRng(seed)), 1.95, 0.65, 1.1, undefined, {
        variant: 1,
        shape: rng(),
        tags: ['outbuilding'],
      });
    }
    for (const m of fishingMoorings(level)) put('moored-boat', m.x, 0, m.z, m.yaw, 1.55);
  } else if (kind === 'timber') {
    if (level >= 3) {
      placeAt('cutting-shed', L.timberWorkshop(false), 0.4, 0.43, 1.1, 0.1);
      placeAt('lumber-store', L.timberWorkshop(true), -0.12, -1.16, 1.1, 0.1);
    }
    for (let i = 0; i < features; i++) {
      if (i < 3) {
        const x = 0.35 + i * 0.21,
          z = 0.82;
        put('log-pile', x, 0.3, z, 0.08, 1.1, {
          clear: 0.14 + 0.1,
          tags: ['log-yard:shore'],
        });
      } else
        placeAt('log-pile', L.logPile(), 0.2 + (i - 3) * 0.23, -0.9, 1.1, 0.09, {
          tags: ['log-yard:upland'],
        });
    }
    if (level < 3)
      placeAt('sawmill', L.workingSawmill(), -0.05, -0.2, 1.7, 0.12, { tags: ['workshop'] });
    put('lamp-post', 0.12, 0.11 * R, -0.05, 0, 1.3);
    put('lamp-post', 0.95, 0.3, 0.82, 0, 1.3);
    if (level >= 3) put('lamp-post', 0.9, 0.32 * R, -0.9, 0, 1.3);
    put(level >= 3 ? 'slipway-hull' : 'slipway', 1.05, 0.11 * R, 0.38, 0.25, 1.65, {
      clear: 0.28 + 0.1,
    });
  } else if (kind === 'stone') {
    const benches = [
      [0.85, 0.22],
      [0.32, -0.22],
      [-0.03, -0.28],
    ];
    benches.slice(0, Math.min(level, 3)).forEach(([x, z]) => {
      placeAt('derrick', L.derrick(), x!, z!, 1.65, 0.025);
      placeAt('stone-blocks', L.blocks(3 + level), x! + 0.12, z! + 0.12, 1.3, 0.025, {
        variant: 3 + level,
      });
      const h = layoutGround(layout, x!, z!);
      if (h === null) throw new Error(`bench rails without ground at level ${level}`);
      // The bench clears the woods around it; the first rail carries that clearing.
      for (const offset of [-0.025, 0.025])
        put('rail', x!, h * R, z! + offset, -0.2, 1, {
          clear: offset < 0 ? 0.2 + 0.1 : 0,
        });
    });
    placeAt('keep', L.keep(), -0.65, -0.55, level === 4 ? 1.25 : 0.7);
  } else {
    placeAt('windmill', L.windmill(), -1.15, -0.4, 1.25, 0.07, { tags: ['windmill'] });
    if (level >= 3) placeAt('windmill', L.windmill(), 1.0, -0.5, 1.25, 0.07);
    placeAt('barn', L.barn(), 0.85, -0.05, level >= 2 ? 1.65 : 1.1, 0.12);
    if (level >= 3) placeAt('granary', L.granary(), -0.9, -0.65, 1.7, 0.1);
    if (level >= 3) placeAt('bakery', L.bakery(), 1.25, -0.05, 1.75, 0.1, { tags: ['workshop'] });
  }
  return out;
}

/** Placements equal at consecutive levels become one prop with `from` and `to`. */
function mergeLevels(byLevel: Placement[][]) {
  const props: (Placement & { from: number; to?: number; key: string })[] = [];
  byLevel.forEach((list, i) => {
    const level = i + 1;
    const used = new Set<object>();
    for (const p of list) {
      const key = JSON.stringify(tidy(p));
      const open = props.find((q) => q.key === key && q.to === level - 1 && !used.has(q));
      if (open) {
        open.to = level;
        used.add(open);
      } else {
        const fresh = { ...p, from: level, to: level, key };
        props.push(fresh);
        used.add(fresh);
      }
    }
  });
  return props.map(({ from, to, ...rest }) => ({
    ...tidy(rest),
    from,
    ...(to !== 4 ? { to } : {}),
  }));
}

/** Rounded, in file order, defaults left out. */
function tidy(p: Placement) {
  return {
    type: p.type,
    x: r6(p.x),
    z: r6(p.z),
    ...(p.turn ? { turn: deg(p.turn) } : {}),
    ...(p.size !== undefined && p.size !== 1 ? { size: p.size } : {}),
    ...(p.variant !== undefined ? { variant: p.variant } : {}),
    ...(p.shape !== undefined ? { shape: r6(p.shape) } : {}),
    ...(p.length !== undefined ? { length: p.length } : {}),
    ...(p.y !== undefined ? { y: r6(p.y) } : {}),
    ...(p.fit !== undefined ? { fit: p.fit } : {}),
    ...(p.clear !== undefined ? { clear: r6(p.clear) } : {}),
    ...(p.tags ? { tags: p.tags } : {}),
  };
}

const HOME: Record<IslandTheme, { type: string; size: number }> = {
  fish: { type: 'fish-house', size: 1.15 },
  timber: { type: 'cabin', size: 1 },
  stone: { type: 'stone-house', size: 1.15 },
  grain: { type: 'farmhouse', size: 0.8 },
};

const WOODS: Record<IslandTheme, object> = {
  timber: {
    tree: 'woodland-pine',
    tries: 2600,
    area: [-1.7, -1.8, 1.95, 0.72],
    size: 1.8,
    margin: 0.055,
    spacing: 0.185,
    spacingAt: [[0.32, 0.11]],
  },
  stone: {
    tree: 'woodland-fir',
    tries: 1100,
    area: [-1.7, -1.3, 1.7, 0.72],
    size: 1.1,
    margin: 0.09,
    spacing: 0.23,
  },
  fish: {
    tree: 'woodland-broadleaf',
    tries: 1100,
    area: [-1.7, -1.3, 1.7, 0.72],
    size: 1.7,
    margin: 0.09,
    spacing: 0.27,
  },
  grain: {
    tree: 'woodland-broadleaf',
    tries: 1100,
    area: [-1.7, -1.3, 1.7, 0.72],
    size: 1.7,
    margin: 0.09,
    spacing: 0.27,
  },
};

const LANDMARK: Record<IslandTheme, [number, number]> = {
  fish: [1.95, -0.65],
  timber: [0.55, -0.65],
  stone: [-0.65, -0.55],
  grain: [1.0, -0.5],
};

export function bakeIsland(island: (typeof ISLANDS)[number]) {
  const kind = island.style as IslandTheme;
  const R = island.radius / 2.2;
  const final = islandLayout(kind);

  // Ground: a low surface that is the beach inset of a coast refers to it; the rest are outlines.
  const ground: object[] = [];
  const count = final.surfaces.length;
  for (let s = 0; s < count; s++) {
    const runs: { outline: [number, number][]; from: number; to: number }[] = [];
    for (const level of [1, 2, 3, 4]) {
      const surface = islandLayout(kind, level).surfaces[s]!;
      const last = runs[runs.length - 1];
      if (last && JSON.stringify(last.outline) === JSON.stringify(surface.outline)) last.to = level;
      else runs.push({ outline: surface.outline, from: level, to: level });
    }
    const surface = final.surfaces[s]!;
    for (const run of runs) {
      const coast = final.coasts.findIndex(
        (c) => JSON.stringify(insetOutline(c, 0.085)) === JSON.stringify(run.outline),
      );
      ground.push({
        ...(coast >= 0 ? { coast } : { outline: pts(run.outline) }),
        ...(surface.holes ? { holes: surface.holes.map(pts) } : {}),
        height: surface.height,
        material: surface.material,
        ...(surface.material === 'rock' && surface.height > 0.7
          ? { shape: 'peak', ...(kind === 'timber' ? { base: 0.32 } : {}) }
          : {}),
        ...(run.from > 1 ? { from: run.from } : {}),
        ...(run.to < 4 ? { to: run.to } : {}),
      });
    }
  }

  const lanes: object[] = L.characterStreets(kind).map((curve) => ({
    points: curve.points.map((p) => [r6(p.x), r6(p.z)]),
  }));
  if (kind === 'stone')
    lanes.push(
      {
        kind: 'stairs',
        points: [
          [-1.1, 0.18, 0.68],
          [-0.4, 0.34, 0.38],
          [-1.05, 0.46, 0.08],
        ],
        base: 0.08,
      },
      {
        kind: 'path',
        points: [
          [-1.05, 0.46],
          [-0.7, 0.57],
          [-0.25, 0.58],
          [0.08, 0.63],
        ],
        y: 0.08,
      },
    );

  const piers = characterPiers(kind, 1, 4)
    .slice(1)
    .map((p, i) => ({ x: p.x, z: p.z0, length: p.len, from: 3 + i }));

  // Homes: the old plan after its overlap filter, in residence order, revealed 3 · 10 · 21 · 32.
  L.townIslandParts({
    seed: island.seed,
    level: 4,
    kind,
    profile: kind,
    R,
    sx: 1,
    sz: 1,
    pier: { x: R * 0.08, z0: R * 0.85, len: Math.min(R * 0.75, 4.5) },
  }).forEach((g) => g.dispose());
  const kept = [...L.bakeLog.homes];
  const fields = [...L.bakeLog.fields];
  const growth = [3, 10, Math.min(21, Math.ceil(kept.length * 0.75)), 32];
  const homes = kept.slice(0, 32).map((p, i) => ({
    ...tidy({
      type: HOME[kind].type,
      x: p.ux,
      z: p.uz,
      turn: p.yaw,
      size: HOME[kind].size,
      variant: i,
      ...(p.draw !== null ? { shape: p.draw } : {}),
    }),
    from: growth.findIndex((n) => i < n) + 1,
  }));

  const levels = ([1, 2, 3, 4] as const).map((level) => placements(kind, level, R, island.seed));
  if (kind === 'grain')
    for (const level of [1, 2, 3, 4] as const)
      levels[level - 1]!.push(
        ...fields.slice(0, [3, 7, 13, 22][level - 1]!).map((f, i) => ({
          type: 'field',
          x: f.x,
          z: f.z,
          variant: i % 5,
        })),
      );
  if (kind === 'stone')
    for (const list of levels)
      list.push({ type: 'paving', x: -1.07, z: 0.04, turn: Math.PI / 2, y: 0.68, clear: 0 });

  return {
    id: island.id,
    name: island.name,
    style: kind,
    seed: island.seed,
    coasts: final.coasts.map(pts),
    ...(final.lake ? { lake: pts(final.lake) } : {}),
    ground,
    lanes,
    piers,
    props: [...homes, ...mergeLevels(levels)],
    woods: { ...WOODS[kind], clear: [[...LANDMARK[kind], 0.23]] },
  };
}
