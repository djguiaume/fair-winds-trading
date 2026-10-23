import * as THREE from 'three';
import type { IslandDef, MapDef, TerrainDef } from '../../sim/map';
import { pierAt } from '../../sim/collision';
import { bearingTo } from '../../sim/math';
import { type Rng, createRng, range } from '../../sim/rng';
import {
  blobShape,
  isGlowing,
  mergeAll,
  paint,
  slab,
  vertexColorMaterial,
  windowPanes,
} from './geometry';
import type { IslandModel, IslandsBuilder } from './types';
import { landmarkParts } from './landmarks';
import { type Spot, landmarkRadius, sampleInside, terrainSeed } from '../../sim/landmarks';
import { insetOutline } from '../../sim/coast';
import { type TownLevel, townIslandParts } from './towns';

/**
 * B2 "Bright highlands" islands (decision 0012), ported from the reference builder in
 * docs/art/src/lib.js (`kit('highlandLight')`, `island`): a beach, stacked sandstone layers and a
 * grass cap, with props that show what the island produces. Each island is batched separately so the camera can cull distant land. The shallows glow is drawn by the ocean shader.
 */
export const B2 = {
  sand: '#f2d9a0',
  grass: '#7cc04f',
  rock: '#c2ad8c',
  rock2: '#d6c4a4',
  field: ['#e8c547', '#c9d65a', '#e2b53e'],
  furrow: '#8f7a30',
  leaves: ['#3f8f45', '#4aa04f', '#38833f'],
  trunk: '#5a3d24',
  walls: ['#f4ede0', '#ece2cf', '#f8f3ea'],
  roofs: ['#c8603e', '#3f74a8', '#c8603e'],
  chimney: '#8a8174',
  dock: '#9b6b3d',
  post: '#6b4a2a',
  rack: '#b08a5a',
  logs: '#a8703c',
  mill: '#fff3dc',
  millCap: '#8a4a2a',
  blade: '#f4ead2',
  cart: '#8a6a4a',
};

/**
 * Islands are designed in the reference sheet's units, where a sloop is 5 m long; the game draws
 * the sloop 2.2× bigger, so islands and props scale the same way to keep the sheet's proportions.
 */
export const ISLAND_SCALE = 2.2;

type Parts = THREE.BufferGeometry[];

/** Move a group of parts to (x, y, z), turned by rotY. */
function put(out: Parts, parts: Parts, x: number, y: number, z: number, rotY = 0, scale = 1) {
  for (const g of parts) {
    if (scale !== 1) g.scale(scale, scale, scale);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    out.push(g);
  }
}

function tree(rng: Rng): Parts {
  const parts = [
    paint(new THREE.CylinderGeometry(0.08, 0.12, 0.6, 5).translate(0, 0.3, 0), B2.trunk),
  ];
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.ConeGeometry(0.65 - i * 0.16, 0.9, 6).rotateY(rng() * 2);
    parts.push(paint(cone.translate(0, 0.75 + i * 0.45, 0), B2.leaves[i]!));
  }
  const sc = 0.8 + rng() * 0.5;
  for (const g of parts) g.scale(sc, sc, sc);
  return parts;
}

function house(i: number): Parts {
  const roof = new THREE.CylinderGeometry(0, 0.75, 0.6, 4, 1).rotateY(Math.PI / 4);
  roof.scale(1.15, 1, 0.85);
  return [
    paint(new THREE.BoxGeometry(1.2, 0.9, 0.9).translate(0, 0.45, 0), B2.walls[i % 3]!),
    paint(roof.translate(0, 1.2, 0), B2.roofs[i % 3]!),
    paint(new THREE.BoxGeometry(0.18, 0.5, 0.18).translate(0.35, 1.3, 0), B2.chimney),
    ...windowPanes(1.2, 0.9, 0.5, 2, 1, i),
  ];
}

function logPile(): Parts {
  const parts: Parts = [];
  for (let i = 0; i < 5; i++) {
    const layer = Math.floor(i / 3);
    const log = new THREE.CylinderGeometry(0.18, 0.18, 1.6, 6).rotateZ(Math.PI / 2);
    log.translate(0, 0.18 + layer * 0.3, (i % 3) * 0.37 - 0.37 + layer * 0.18);
    parts.push(paint(log, B2.logs));
  }
  return parts;
}

function windmill(): Parts {
  const parts = [
    paint(new THREE.CylinderGeometry(0.45, 0.65, 2.2, 8).translate(0, 1.1, 0), B2.mill),
    paint(new THREE.ConeGeometry(0.6, 0.7, 8).translate(0, 2.55, 0), B2.millCap),
  ];
  for (let k = 0; k < 4; k++) {
    const blade = new THREE.BoxGeometry(0.25, 1.8, 0.05).translate(0, 0.9, 0);
    blade.rotateZ((k * Math.PI) / 2 + 0.4);
    parts.push(paint(blade.translate(0, 2.2, 0.55), B2.blade));
  }
  return parts;
}

/**
 * One island in reference units around its own origin, with its harbour side toward +Z.
 * Returns the parts, already scaled, turned and moved to the island's place on the map.
 */
export function islandParts(
  island: IslandDef,
  map: MapDef,
  seed: number,
  onHarbour?: (point: { x: number; y: number }) => void,
  level?: TownLevel,
  homeBuilt?: Record<string, string>,
): Parts {
  const rng = createRng(seed);
  const look = island.look ?? {};
  const kind = look.kind ?? map.ports.find((p) => p.islandId === island.id)?.produces[0];
  const R = island.radius / ISLAND_SCALE;
  const sx = 1 + (rng() - 0.5) * 0.16;
  const sz = 1 + (rng() - 0.5) * 0.16;
  const out: Parts = [];
  // A port with a settlement level grows its own town and island profile (decision 0060); any
  // island with its own file is built from it, a harbour only with a dock (decision 0110).
  const town = !!look.design || ((level !== undefined || !!look.profile) && !!look.dock);

  if (town) {
    out.push(
      ...townIslandParts({
        seed,
        // An island with no port has no levels: everything in its file stands.
        level: level ?? (look.dock ? 1 : 4),
        design: look.design,
        profile: look.profile,
        kind,
        R,
        sx,
        sz,
        landmark: look.landmark,
        pier: { x: R * 0.08, z0: R * 0.85, len: Math.min(R * 0.75, 4.5) },
        harbour: !!look.dock,
        homeBuilt,
      }),
    );
  } else {
    // Beach: from under the waves to just above them; its waterline sits on the collision radius.
    out.push(
      paint(
        slab(blobShape(rng, R * 1.1, 14, 0.2, sx, sz), 1.45, 0.85).translate(0, -1, 0),
        B2.sand,
      ),
    );

    // Sandstone layers, each stepped back from the harbour so the dock side stays low.
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
      const layer = slab(blobShape(rng, R * (0.9 - i * 0.15), 11, 0.3, sx, sz), h, 0.9);
      out.push(paint(layer.translate(ox, y, oz), i % 2 ? B2.rock2 : B2.rock));
      y += h;
    }
    const capR = R * (0.92 - layers * 0.15);
    out.push(
      paint(slab(blobShape(rng, capR, 11, 0.2, sx, sz), 0.25, 0.95).translate(ox, y, oz), B2.grass),
    );
    const top = y + 0.25;
    // Props sit on the cap: angle 0 = +X, π/2 = harbour (+Z); d is a fraction of the cap radius.
    const HARBOUR = Math.PI / 2;
    const at = (parts: Parts, a: number, d: number, rotY = 0, yOff = 0) =>
      put(
        out,
        parts,
        ox + Math.cos(a) * d * capR * sx,
        top + yOff,
        oz + Math.sin(a) * d * capR * sz,
        rotY,
      );

    if (look.dock) {
      const len = Math.min(R * 0.75, 4.5);
      const z0 = R * 0.85;
      out.push(
        paint(
          new THREE.BoxGeometry(0.9, 0.2, len).translate(R * 0.08, 0.45, z0 + len / 2),
          B2.dock,
        ),
      );
      for (const k of [-1, 1]) {
        for (const t of [0.35, 0.95]) {
          const post = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 5);
          out.push(paint(post.translate(R * 0.08 + k * 0.4, 0, z0 + len * t), B2.post));
        }
      }
      if (kind === 'fish') {
        // Fish-drying racks on stilts beside the pier.
        for (const k of [-1, 1]) {
          const rack = new THREE.BoxGeometry(1.2, 0.5, 0.1).rotateY(Math.PI / 2);
          out.push(paint(rack.translate(R * 0.08 + k * 1.05, 0.8, z0 + len * 0.55), B2.rack));
          out.push(
            paint(
              new THREE.BoxGeometry(0.1, 0.9, 0.1).translate(
                R * 0.08 + k * 1.05,
                0.2,
                z0 + len * 0.55,
              ),
              B2.post,
            ),
          );
        }
      }
    }

    const houses = look.houses ?? 0;
    const trees = look.trees ?? 0;
    if (kind === 'fish') {
      for (let i = 0; i < houses; i++) {
        at(house(i), HARBOUR + (i - (houses - 1) / 2) * 0.6, i % 2 ? 0.4 : 0.72, rng() * 3);
      }
      for (let i = 0; i < trees; i++) at(tree(rng), -HARBOUR + (i - (trees - 1) / 2) * 0.7, 0.62);
    } else if (kind === 'timber') {
      for (let i = 0; i < Math.max(trees, 14); i++) {
        const a = rng() * Math.PI * 2;
        // Leave a clearing on the harbour side for the log pile and the hut.
        if (Math.abs(Math.atan2(Math.sin(a - HARBOUR), Math.cos(a - HARBOUR))) < 0.6) continue;
        at(tree(rng), a, Math.sqrt(rng()) * 0.85, rng() * 3);
      }
      at(logPile(), HARBOUR - 0.35, 0.55, 0.3);
      for (let i = 0; i < Math.max(1, houses); i++)
        at(house(i + 1), HARBOUR + 0.45 + i * 0.5, 0.6, 0.5);
    } else if (kind === 'grain') {
      const w = capR * 0.32;
      for (let i = 0; i < 4; i++) {
        const fx = ox + (i - 1.5) * capR * 0.34;
        const fz = oz - capR * 0.15;
        out.push(
          paint(
            new THREE.BoxGeometry(w, 0.12, capR * 0.6).translate(fx, top + 0.05, fz),
            B2.field[i % 3]!,
          ),
        );
        for (let k = 0; k < 3; k++) {
          const furrow = new THREE.BoxGeometry(w * 0.94, 0.05, 0.06);
          out.push(paint(furrow.translate(fx, top + 0.13, fz + (k - 1) * capR * 0.18), B2.furrow));
        }
      }
      at(windmill(), HARBOUR + 0.8, 0.62, 0.4);
      for (let i = 0; i < Math.max(1, houses); i++)
        at(house(i + 2), HARBOUR - 0.8 + i * 0.45, 0.6, rng() * 3);
      for (let i = 0; i < trees; i++) at(tree(rng), -HARBOUR + (i - (trees - 1) / 2) * 0.5, 0.88);
    } else if (kind === 'stone') {
      for (let i = 0; i < 3; i++) {
        const boulder = new THREE.DodecahedronGeometry(R * (0.24 - i * 0.05), 0).scale(1, 1.3, 1);
        at([paint(boulder, i % 2 ? B2.rock2 : B2.rock)], i * 2.1, 0.45 * i, rng() * 3, R * 0.1);
      }
      for (let i = 0; i < houses; i++) at(house(i), HARBOUR - 0.5 - i * 0.5, 0.55, rng() * 3);
      for (let i = 0; i < trees; i++) at(tree(rng), 3 + i * 0.5, 0.75);
      at(
        [paint(new THREE.BoxGeometry(0.8, 0.4, 0.6).translate(0, 0.2, 0), B2.cart)],
        HARBOUR + 0.3,
        0.5,
        0.4,
      );
    } else {
      if (look.rock && !look.landmark) {
        const boulder = new THREE.DodecahedronGeometry(R * 0.3, 0).scale(1, 1.3, 1);
        at([paint(boulder, B2.rock2)], rng() * 6, 0.2, rng() * 3, R * 0.12);
      }
      for (let i = 0; i < houses; i++)
        at(house(i), HARBOUR + (i - (houses - 1) / 2) * 0.6, 0.6, rng() * 3);
      for (let i = 0; i < trees; i++)
        at(
          tree(rng),
          rng() * Math.PI * 2,
          look.landmark ? 0.78 + rng() * 0.1 : 0.3 + rng() * 0.5,
          rng() * 3,
        );
    }

    if (look.landmark) {
      const size = Math.min(1.15, capR / 3.8);
      if (look.landmark === 'wreck') {
        put(out, landmarkParts('wreck', Math.min(0.9, R * 0.07)), 0, 0.6, R * 0.84, Math.PI / 2);
      } else {
        put(out, landmarkParts(look.landmark, size), ox, top, oz, 0.2);
      }
    }
  }

  // The harbour (+Z) faces the course buoy named after this island, else a seeded direction.
  const wp = map.course.find((w) => w.label === island.name);
  const bearing = look.harbourBearing ?? (wp ? bearingTo(island, wp) : rng() * Math.PI * 2);
  // Exact pier head, shared with the pier's collision segment (decision 0038).
  if (look.dock && onHarbour) {
    const pier = pierAt(island, bearing);
    onHarbour({ x: pier.x1, y: pier.y1 });
  }
  // rotateY(π - bearing) turns +Z to (sin b, 0, -cos b), the bearing's direction in the scene.
  for (const g of out) {
    g.scale(ISLAND_SCALE, ISLAND_SCALE, ISLAND_SCALE);
    g.rotateY(Math.PI - bearing);
    g.translate(island.x, 0, -island.y);
  }
  return out;
}

/**
 * Terraces of a barrier island (decision 0031): the beach is the exact collision outline, then
 * two sandstone tiers and a grass cap, each inset so nothing overhangs the shore.
 */
const RIDGE_TIERS = [
  { inset: 0, bottom: -0.8, top: 1, color: B2.sand },
  { inset: 4, bottom: 0.8, top: 4.6, color: B2.rock },
  { inset: 8, bottom: 4.4, top: 7.6, color: B2.rock2 },
  { inset: 10, bottom: 7.5, top: 8, color: B2.grass },
] as const;
const RIDGE_TOP = 8;
const CORAL = ['#e08a6a', '#f0a580', '#d9707a'];

function extrudeOutline(outline: TerrainDef['outline'], bottom: number, top: number) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: top - bottom,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry.translate(0, bottom, 0);
}

/** Detail geometry only, anchored inside the exact solid shoreline. */
export function terrainProps(feature: TerrainDef, seed: number): Parts {
  const parts: Parts = [];
  const bank = feature.kind === 'sandbank';
  const reef = feature.kind === 'reef';
  // Decoration stays inside the shore (on barriers, on the grass cap); it cannot narrow passages.
  const area = bank || reef ? feature.outline : insetOutline(feature.outline, RIDGE_TIERS[3].inset);
  const rng = createRng(seed);
  const occupied: Spot[] = [];
  const sample = (radius: number) => sampleInside(rng, area, radius, occupied);
  const topY = reef ? 0 : bank ? 0.8 : RIDGE_TOP;
  if (feature.look?.landmark) {
    const s = bank || reef ? 1.15 : 1.8;
    const p = sample(landmarkRadius(feature.look.landmark));
    if (!p) throw new Error(`Landmark does not fit on ${feature.id}`);
    put(parts, landmarkParts(feature.look.landmark, s), p.x, topY, -p.y, 0.3);
  }
  if (reef) {
    // Rocks and coral heads just awash; the ocean shader paints the shallows and foam around them.
    for (let i = 0; i < 26; i++) {
      const size = range(rng, 1.1, 2.2);
      const p = sample(size + 1.2);
      if (!p) break;
      parts.push(
        paint(
          new THREE.DodecahedronGeometry(size, 0)
            .scale(1, 0.6, 1)
            .rotateY(rng() * 6)
            .translate(p.x, size * 0.35, -p.y),
          i % 3 ? B2.rock : B2.rock2,
        ),
      );
      if (i % 2) {
        const coral = new THREE.ConeGeometry(0.8, 1.6, 5).translate(
          p.x + size * 0.6,
          0.7,
          -p.y + size * 0.3,
        );
        parts.push(paint(coral, CORAL[i % 3]!));
      }
    }
    return parts;
  }
  if (!bank) {
    // Small terraced outcrops give the long barriers relief like the highland islands.
    for (let i = 0; i < 4; i++) {
      const p = sample(3.4);
      if (!p) break;
      const base = new THREE.CylinderGeometry(2.4, 3.2, 1.7, 7).translate(p.x, topY + 0.85, -p.y);
      parts.push(paint(base, B2.rock));
      parts.push(
        paint(
          new THREE.CylinderGeometry(1.7, 1.8, 0.2, 6).translate(p.x, topY + 1.75, -p.y),
          B2.grass,
        ),
      );
    }
  }
  for (let i = 0; i < (feature.look?.trees ?? 0); i++) {
    const p = sample(2.4);
    if (!p) break;
    put(parts, tree(rng), p.x, topY, -p.y, rng() * 6, 2.3);
  }
  // Rock outcrops, grass tufts and driftwood break up the otherwise flat surfaces.
  for (let i = 0; i < (bank ? 7 : 9); i++) {
    const p = sample(bank ? 1.1 : 2);
    if (!p) break;
    const size = bank ? range(rng, 0.45, 0.85) : range(rng, 1.0, 1.7);
    parts.push(
      paint(
        new THREE.DodecahedronGeometry(size, 0)
          .scale(1, 0.7, 1)
          .translate(p.x, topY + size * 0.35, -p.y),
        i % 2 ? B2.rock : B2.rock2,
      ),
    );
    if (bank) {
      const driftwood = new THREE.BoxGeometry(1.8, 0.25, 0.3)
        .rotateY(rng() * 6)
        .translate(p.x, topY + 0.3, -p.y);
      parts.push(paint(driftwood, B2.logs));
    } else {
      parts.push(
        paint(new THREE.ConeGeometry(0.7, 1.4, 4).translate(p.x, topY + 0.7, -p.y), B2.leaves[1]!),
      );
    }
  }
  return parts;
}

/** Separate land batches keep camera and shadow culling local to each island. */
export class HighlandIslands extends THREE.Group implements IslandModel {
  private readonly land = vertexColorMaterial();
  private readonly glass = new THREE.MeshBasicMaterial({ vertexColors: true });
  private readonly batches = new Map<string, THREE.Group>();
  private levels: Record<string, TownLevel>;
  private homeBuilt: Record<string, string> = {};

  constructor(
    private readonly map: MapDef,
    private readonly shadows: boolean,
    levels = {} as Record<string, TownLevel>,
  ) {
    super();
    this.levels = { ...levels };
    this.userData.harbours = {};
    // Keep the model-sheet/night-lighting API: every window shares this tint material.
    this.userData.windows = this.glass;
    for (const [index, island] of map.islands.entries()) {
      const group = this.buildIsland(island, index);
      this.batches.set(island.id, group);
      this.add(group);
    }
    // Collision terrain is independent of settlement growth and never rebuilt for a level-up.
    for (const feature of map.terrain ?? []) {
      const parts: Parts = [];
      if (feature.kind === 'sandbank') {
        parts.push(paint(extrudeOutline(feature.outline, -0.4, 0.8), B2.sand));
      } else if (feature.kind === 'island') {
        for (const tier of RIDGE_TIERS) {
          const outline = tier.inset ? insetOutline(feature.outline, tier.inset) : feature.outline;
          parts.push(paint(extrudeOutline(outline, tier.bottom, tier.top), tier.color));
        }
      }
      parts.push(...terrainProps(feature, terrainSeed(map, feature)));
      const group = this.batch(parts);
      group.name = `terrain:${feature.id}`;
      this.add(group);
    }
  }

  private mesh(parts: Parts, material: THREE.Material) {
    const geometry = mergeAll(parts);
    // Bounds include authored outlying props, piers and raised terrain, not just radius.
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = material === this.land && this.shadows;
    mesh.receiveShadow = material === this.land && this.shadows;
    return mesh;
  }

  private batch(parts: Parts) {
    const group = new THREE.Group();
    for (const [name, selected, material] of [
      ['terrain', parts.filter((g) => g.userData.islandTerrain), this.land],
      ['town', parts.filter((g) => !g.userData.islandTerrain && !isGlowing(g)), this.land],
      ['windows', parts.filter(isGlowing), this.glass],
    ] as const) {
      if (!selected.length) continue;
      const mesh = this.mesh(selected, material);
      mesh.name = name;
      group.add(mesh);
    }
    return group;
  }

  private buildIsland(island: IslandDef, index: number) {
    const port = this.map.ports.find((p) => p.islandId === island.id);
    const parts = islandParts(
      island,
      this.map,
      this.map.seed * 1000 + index,
      (point) => {
        if (!port) return;
        const harbours = this.userData.harbours as Record<string, { x: number; y: number }>;
        // HUD, chart and tutorial may retain both the record and individual points.
        if (harbours[port.id]) Object.assign(harbours[port.id]!, point);
        else harbours[port.id] = point;
      },
      port ? this.levels[port.id] : undefined,
      island.id === this.map.homeIsland ? this.homeBuilt : undefined,
    );
    const group = this.batch(parts);
    group.name = `island:${island.id}`;
    return group;
  }

  setSettlementLevels(levels: Record<string, TownLevel>) {
    const previous = this.levels;
    this.levels = { ...levels };
    for (const [index, island] of this.map.islands.entries()) {
      const port = this.map.ports.find((p) => p.islandId === island.id);
      if (!port || previous[port.id] === levels[port.id]) continue;
      const old = this.batches.get(island.id)!;
      const next = this.buildIsland(island, index);
      const oldTerrain = old.getObjectByName('terrain') as THREE.Mesh | undefined;
      const newTerrain = next.getObjectByName('terrain') as THREE.Mesh | undefined;
      // Most designed terrain is permanent; level-dependent authored quarry benches are not.
      if (oldTerrain && newTerrain && sameGeometry(oldTerrain.geometry, newTerrain.geometry)) {
        newTerrain.geometry.dispose();
        next.remove(newTerrain);
        old.remove(oldTerrain);
        next.add(oldTerrain);
      }
      this.remove(old);
      disposeGeometry(old);
      this.batches.set(island.id, next);
      this.add(next);
    }
  }

  /** Redraw the home island with what stands on its spots now (decision 0126). */
  setHomeBuildings(built: Record<string, string>) {
    if (JSON.stringify(built) === JSON.stringify(this.homeBuilt)) return;
    this.homeBuilt = { ...built };
    const index = this.map.islands.findIndex((i) => i.id === this.map.homeIsland);
    if (index < 0) return;
    const island = this.map.islands[index]!;
    const old = this.batches.get(island.id)!;
    const next = this.buildIsland(island, index);
    this.remove(old);
    disposeGeometry(old);
    this.batches.set(island.id, next);
    this.add(next);
  }

  dispose() {
    disposeGeometry(this);
    this.land.dispose();
    this.glass.dispose();
    this.clear();
    this.batches.clear();
  }
}

function disposeGeometry(root: THREE.Object3D) {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
}

/** Compare all vertex attributes: unchanged land retains its already-uploaded GPU geometry. */
function sameGeometry(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const names = Object.keys(a.attributes);
  return (
    names.length === Object.keys(b.attributes).length &&
    names.every((name) => {
      const first = a.attributes[name]!,
        second = b.attributes[name];
      return (
        second &&
        first.itemSize === second.itemSize &&
        first.array.length === second.array.length &&
        first.array.every((value, i) => value === second.array[i])
      );
    })
  );
}

export const buildHighlandIslands: IslandsBuilder = (map, { shadows, levels }) =>
  new HighlandIslands(map, shadows, levels);
