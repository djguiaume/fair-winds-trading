import * as THREE from 'three';
import { groundColors, styleColor } from '../../data/grounds';
import { atLevel, type IslandDesign, type PropDef } from '../../data/islands';
import { coastDistance } from '../../sim/coast';
import type { IslandDef } from '../../sim/map';
import { type Heightfield, SEA_LEVEL, heightAt, islandHeightfield } from '../../sim/heightfield';
import { islandLayout, islandPoint, layoutGround, type IslandLayout } from '../../sim/islandLayout';
import { BEACH_TOP, ISLAND_SCALE } from '../../sim/islandUnits';
import { createRng, range } from '../../sim/rng';
import type { ForestClearings } from '../../sim/forest';
import { FORESTS } from '../../data/forests';
import { isGlowing, paint } from './geometry';
import { PROP_TYPES, WOODLAND_TREES, put, type Parts } from './props';
import { lanePieces } from './townLanes';
import type { TerrainLook } from '../terrainLook';

/** The height a prop stands at over a point of its island (reference units, harbour toward +Z). */
export type Stand = (x: number, z: number) => number;

/** Standing on the shared height field (decision 0222): its ground, or the sea's surface. */
export function fieldStand(island: IslandDef, field: Heightfield): Stand {
  return (x, z) => {
    const p = islandPoint(island, x, z);
    return Math.max(SEA_LEVEL, heightAt(field, p.x, p.y)) / ISLAND_SCALE;
  };
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

/**
 * Where a prop stands on an island at a level: on the shared height field under the new look
 * (decision 0222), on the classic tiers otherwise.
 */
export function propStand(
  island: IslandDef,
  design: IslandDesign,
  level: number,
  look: TerrainLook,
): Stand {
  if (look === 'v2') return fieldStand(island, islandHeightfield(island, level));
  const layout = islandLayout(design, level);
  return (x, z) => standHeight(layout, x, z, island.radius / ISLAND_SCALE);
}

/** The half-diagonal of a model's plan, the footprint the old town code checked with. */
export function extent(parts: Parts) {
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

/**
 * A home's richer parts (issue #500), not yet placed; windows are the plain house's. The two are
 * told apart by `userData.house`, so the island draws one set near and the other far.
 */
export function richParts(prop: PropDef, design: IslandDesign, R: number): Parts | undefined {
  const build = PROP_TYPES[prop.type]?.buildRich;
  if (!build) return undefined;
  const rich = build({
    R,
    style: design.style,
    variant: prop.variant ?? 0,
    shape: prop.shape ?? 0.5,
    size: prop.size ?? 1,
  });
  for (const g of rich) g.userData.house = 'rich';
  return rich;
}

/** Is this prop one of the island's numbered residences? */
export const isResidence = (prop: PropDef) =>
  !!PROP_TYPES[prop.type]?.home && !prop.tags?.includes('outbuilding');

/** The classic woods' clear strip up the arrival pier, in file units. */
const HARBOUR_LANE = { x: 0.08, half: 0.14, from: 0.45 };

/**
 * A designed island's town at its level (decision 0101): lanes near standing homes, the homes,
 * the harbour (`harbour` adds it in its turn), every other prop and the woods. Props stand on
 * `stand`, the new look's ground (decision 0222); left out, on the classic tiers of the layout.
 * With `clearings`, the new look's forest grows the trees (issue #275): this notes the ground the
 * town keeps clear there instead of scattering the classic woods.
 */
export function townProps(
  out: Parts,
  design: IslandDesign,
  layout: IslandLayout,
  R: number,
  level: number,
  hasHarbour: boolean,
  harbour: (out: Parts) => void,
  stand?: Stand,
  clearings?: ForestClearings,
) {
  const ground = (material: string) => groundColors(material, design.style);
  const pathColor = styleColor('path', design.style) as string;
  const standAt = stand ?? ((x: number, z: number) => standHeight(layout, x, z, R));
  const standing = design.props.filter((p) => atLevel(p, level));
  /** Places a prop's parts (into `into`) and returns how far it clears the woods. */
  const place = (prop: PropDef, parts: Parts, into: Parts = out) => {
    const type = PROP_TYPES[prop.type]!;
    const size = prop.size ?? 1;
    const clear = prop.clear ?? (extent(parts) * size) / R + 0.1;
    const y = prop.y !== undefined ? prop.y * R : standAt(prop.x, prop.z);
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
  const richHomes: Parts[] = [];
  const active: { x: number; z: number }[] = [];
  design.props.filter(isResidence).forEach((prop, i) => {
    if (!atLevel(prop, level)) return;
    const parts = propParts(prop, design, R);
    const half = (extent(parts) * (prop.size ?? 1)) / R;
    const clear = place(prop, parts, []);
    const rich = richParts(prop, design, R);
    if (rich) {
      place(prop, rich, []);
      richHomes.push(rich);
      for (const g of parts) if (!isGlowing(g)) g.userData.house = 'plain';
    }
    if (clearings) {
      // A house keeps the forest 1.5 house widths off (art direction, new look §3).
      const margin = half * (1 + 2 * FORESTS.clear.houseWidths);
      clearings.circles.push([prop.x, prop.z, Math.max(clear, margin)]);
      clearings.homes.push([prop.x, prop.z]);
    }
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
  for (const piece of lanePieces(design, layout, active)) {
    const { ax, az, bx, bz, x, z, h, ha, hb, flat, width } = piece;
    clearedLanes.push({ x, z });
    clearings?.lanes.push([ax, az, bx, bz, width / 2]);
    const len = Math.hypot(bx - ax, bz - az) * R;
    const g = paint(
      new THREE.PlaneGeometry(len + 0.01, R * width).rotateX(-Math.PI / 2).translate(0, 0.012, 0),
      pathColor,
    );
    if (!flat) g.rotateZ(Math.atan2((hb - ha) * R, len));
    put(out, [g], x * R, h * R, z * R, -Math.atan2(bz - az, bx - ax));
  }
  for (const parts of [...homes, ...richHomes]) out.push(...parts);

  harbour(out);

  // Every other prop, in file order; fields claim woodland as the settlement grows.
  const occupied: { x: number; z: number; clear: number }[] = [];
  const fields: { x: number; z: number }[] = [];
  for (const prop of standing) {
    if (isResidence(prop)) continue;
    const clear = place(prop, propParts(prop, design, R));
    if (prop.type === 'field') fields.push(prop);
    else occupied.push({ x: prop.x, z: prop.z, clear });
  }
  if (clearings) {
    const { x, half, from } = HARBOUR_LANE;
    for (const f of fields) clearings.circles.push([f.x, f.z, 0.24]);
    for (const o of occupied) clearings.circles.push([o.x, o.z, o.clear]);
    if (hasHarbour) for (let z = from; z <= 1.2; z += half) clearings.circles.push([x, z, half]);
    return;
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
      (hasHarbour && Math.abs(x - HARBOUR_LANE.x) < HARBOUR_LANE.half && z > HARBOUR_LANE.from) ||
      woods.clear?.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)
    )
      continue;
    const tree = buildTree();
    tree[0]!.userData.tree = { x, z };
    put(out, tree, x * R, stand ? stand(x, z) : h * R, z * R, yaw, woods.size);
  }
}
