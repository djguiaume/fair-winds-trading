import * as THREE from 'three';
import { FORESTS } from '../../data/forests';
import type { ForestTree } from '../../sim/forest';
import { buildProp } from './propRecipe';
import { mergeAll, triangleCount } from './geometry';
import type { QualityLevel } from '../quality';

/**
 * The new look's forests drawn (issue #275): per island, one instanced mesh per tree kind, so an
 * island's whole forest costs a draw call or two and is culled with its own bounds. Each mesh holds
 * its trees in rank order and a quality level draws the first `share` of them: lowering the
 * quality draws fewer of the same trees, and nothing is rebuilt.
 */

/** One kind's model, built once per island style (styles recolour props) and shared. */
const models = new Map<string, THREE.BufferGeometry>();
function modelOf(kind: string, style: string) {
  const key = `${kind}/${style}`;
  let model = models.get(key);
  if (!model) {
    const look = FORESTS.kinds[kind]!;
    const parts = buildProp(look.prop, {
      R: 1,
      style,
      variant: 0,
      shape: 0.5,
      size: 1,
      vars: look.vars,
    });
    model = mergeAll(parts);
    model.computeBoundingSphere();
    models.set(key, model);
  }
  return model;
}

/** The ranks of a mesh's trees, lowest first: a quality level draws the first ones. */
interface ForestMeshData {
  ranks: number[];
}

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const turn = new THREE.Quaternion();
const size = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tint = new THREE.Color();

/** An island's trees as instanced meshes, in a group named `forest`. */
export function forestMeshes(
  trees: readonly ForestTree[],
  style: string,
  material: THREE.Material,
  level: QualityLevel,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'forest';
  const byKind = new Map<string, ForestTree[]>();
  for (const t of trees) {
    const list = byKind.get(t.kind);
    if (list) list.push(t);
    else byKind.set(t.kind, [t]);
  }
  for (const [kind, list] of byKind) {
    list.sort((a, b) => a.rank - b.rank);
    const look = FORESTS.kinds[kind]!;
    const mesh = new THREE.InstancedMesh(modelOf(kind, style), material, list.length);
    mesh.name = `forest:${kind}`;
    list.forEach((t, i) => {
      // Sunk a little, so the trunk meets sloping ground on its low side.
      position.set(t.x, t.height - FORESTS.sink * t.scale, -t.y);
      turn.setFromAxisAngle(UP, t.yaw);
      size.setScalar(t.scale);
      mesh.setMatrixAt(i, matrix.compose(position, turn, size));
      mesh.setColorAt(i, tint.set(look.tints[t.tint]!));
    });
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    (mesh.userData as ForestMeshData).ranks = list.map((t) => t.rank);
    group.add(mesh);
  }
  setForestQuality(group, level);
  return group;
}

/**
 * Draw the trees a quality level keeps, with or without their shadows: the `share` of each kind
 * with the lowest ranks, which are the trees deepest in their woods.
 */
export function setForestQuality(group: THREE.Object3D, level: QualityLevel) {
  const { share, shadows } = FORESTS.quality[level];
  for (const mesh of group.children as THREE.InstancedMesh[]) {
    const { ranks } = mesh.userData as ForestMeshData;
    mesh.count = Math.round(ranks.length * share);
    mesh.visible = mesh.count > 0;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
  }
}

/** What a forest group draws: trees, draw calls and triangles (the `?perf` and test budgets). */
export function forestCost(group: THREE.Object3D) {
  let trees = 0,
    draws = 0,
    triangles = 0;
  for (const mesh of group.children as THREE.InstancedMesh[]) {
    if (!mesh.visible) continue;
    trees += mesh.count;
    draws++;
    triangles += mesh.count * triangleCount(mesh.geometry);
  }
  return { trees, draws, triangles };
}
