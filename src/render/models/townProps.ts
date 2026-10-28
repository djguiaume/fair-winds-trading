import * as THREE from 'three';
import { groundColors, styleColor } from '../../data/grounds';
import { atLevel, LANE_WIDTH, type IslandDesign, type PropDef } from '../../data/islands';
import { coastDistance } from '../../sim/coast';
import type { IslandDef } from '../../sim/map';
import { type Heightfield, SEA_LEVEL, heightAt } from '../../sim/heightfield';
import {
  crossesCliff,
  islandLayout,
  islandPoint,
  layoutGround,
  type IslandLayout,
} from '../../sim/islandLayout';
import { BEACH_TOP, ISLAND_SCALE } from '../../sim/islandUnits';
import { createRng, range } from '../../sim/rng';
import { paint } from './geometry';
import { PROP_TYPES, WOODLAND_TREES, put, type Parts } from './props';

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

/** Is this prop one of the island's numbered residences? */
export const isResidence = (prop: PropDef) =>
  !!PROP_TYPES[prop.type]?.home && !prop.tags?.includes('outbuilding');

/**
 * A designed island's town at its level (decision 0101): lanes near standing homes, the homes,
 * the harbour (`harbour` adds it in its turn), every other prop and the woods. Props stand on
 * `stand`, the new look's ground (decision 0222); left out, on the classic tiers of the layout.
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
        new THREE.PlaneGeometry(len + 0.01, R * (lane.width ?? LANE_WIDTH))
          .rotateX(-Math.PI / 2)
          .translate(0, 0.012, 0),
        pathColor,
      );
      if (!flat) g.rotateZ(Math.atan2((hb! - ha!) * R, len));
      put(out, [g], x * R, h * R, z * R, -Math.atan2(b.z - a.z, b.x - a.x));
    }
  }
  for (const parts of homes) out.push(...parts);

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
      (hasHarbour && Math.abs(x - 0.08) < 0.14 && z > 0.45) ||
      woods.clear?.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)
    )
      continue;
    const tree = buildTree();
    tree[0]!.userData.tree = { x, z };
    put(out, tree, x * R, stand ? stand(x, z) : h * R, z * R, yaw, woods.size);
  }
}
