import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { HighlandIslands, islandParts } from '../src/render/models/highlandIslands';
import { settlementLevels } from '../src/sim/settlement';
import { createWorld } from '../src/sim/world';
import { SLOOP } from '../src/sim/ship';
import type { TownLevel } from '../src/render/models/towns';

function meshes(root: THREE.Object3D) {
  const result: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) result.push(o);
  });
  return result;
}

// Compare the complete vertex/normal/colour multiset, independent of batch order.
function vertices(geometries: THREE.BufferGeometry[]) {
  return geometries
    .flatMap((g) => {
      const position = g.attributes.position!;
      return Array.from({ length: position.count }, (_, i) =>
        ['position', 'normal', 'color']
          .flatMap((name) => {
            const a = g.attributes[name]!;
            return [a.getX(i), a.getY(i), a.getZ(i)];
          })
          .join(','),
      );
    })
    .sort();
}

const allLevels = (level: TownLevel) =>
  Object.fromEntries(PHASE1_MAP.ports.map((p) => [p.id, level]));

describe('local island rendering', () => {
  it.each([1, 2, 3, 4] as const)(
    'preserves every authored vertex, normal and colour at level %i',
    (level) => {
      const map = { ...PHASE1_MAP, terrain: [] };
      const model = new HighlandIslands(map, true, allLevels(level));
      const expected = map.islands.flatMap((island, i) =>
        islandParts(
          island,
          map,
          map.seed * 1000 + i,
          undefined,
          map.ports.some((p) => p.islandId === island.id) ? level : undefined,
        ),
      );
      expect(vertices(meshes(model).map((m) => m.geometry))).toEqual(vertices(expected));
      for (const g of expected) g.dispose();
      model.dispose();
    },
  );

  it('rebuilds only the changed island, retaining stable terrain and harbour references', () => {
    const levels = allLevels(1);
    const model = new HighlandIslands(PHASE1_MAP, true, levels);
    const port = PHASE1_MAP.ports.find((p) => p.islandId === 'calda')!;
    const anchors = model.userData.harbours;
    const anchor = anchors[port.id];
    const before = [...model.children];
    const old = model.getObjectByName('island:calda')!;
    const terrain = old.getObjectByName('terrain') as THREE.Mesh;
    const town = old.getObjectByName('town') as THREE.Mesh;
    const disposeTown = vi.spyOn(town.geometry, 'dispose');
    const disposeTerrain = vi.spyOn(terrain.geometry, 'dispose');
    const material = model.userData.windows as THREE.Material;
    const disposeMaterial = vi.spyOn(material, 'dispose');
    model.setSettlementLevels({ ...levels, [port.id]: 2 });
    const changed = model.getObjectByName('island:calda')!;
    expect(changed).not.toBe(old);
    expect(changed.getObjectByName('terrain')).toBe(terrain);
    expect(disposeTerrain).not.toHaveBeenCalled();
    expect(disposeTown).toHaveBeenCalledOnce();
    expect(disposeMaterial).not.toHaveBeenCalled();
    for (const object of before.filter((o) => o !== old)) expect(model.children).toContain(object);
    expect(model.userData.harbours).toBe(anchors);
    expect(anchors[port.id]).toBe(anchor);
    const now = [...model.children];
    model.setSettlementLevels({ ...levels, [port.id]: 2 });
    expect(model.children).toEqual(now);
    model.dispose();
    expect(disposeTerrain).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });

  it('replaces level-dependent quarry terrain and matches a fresh build', () => {
    const levels = allLevels(1);
    const model = new HighlandIslands(PHASE1_MAP, false, levels);
    const port = PHASE1_MAP.ports.find((p) => p.islandId === 'south-cay')!;
    const old = model.getObjectByName('island:south-cay')!.getObjectByName('terrain') as THREE.Mesh;
    const disposed = vi.spyOn(old.geometry, 'dispose');
    model.setSettlementLevels({ ...levels, [port.id]: 4 });
    const next = model
      .getObjectByName('island:south-cay')!
      .getObjectByName('terrain') as THREE.Mesh;
    expect(next.geometry).not.toBe(old.geometry);
    expect(disposed).toHaveBeenCalledOnce();
    const fresh = new HighlandIslands(PHASE1_MAP, false, { ...levels, [port.id]: 4 });
    expect(vertices(meshes(model).map((m) => m.geometry))).toEqual(
      vertices(meshes(fresh).map((m) => m.geometry)),
    );
    model.dispose();
    fresh.dispose();
  });

  it('bounds every vertex and culls an island outside a local camera without clipping piers', () => {
    const model = new HighlandIslands(PHASE1_MAP, true, allLevels(4));
    for (const mesh of meshes(model)) {
      expect(mesh.frustumCulled).toBe(true);
      const { boundingBox: box, boundingSphere: sphere } = mesh.geometry;
      expect(box).not.toBeNull();
      expect(sphere).not.toBeNull();
      const p = mesh.geometry.attributes.position!;
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i);
        expect(box!.containsPoint(v)).toBe(true);
        expect(sphere!.distanceToPoint(v)).toBeLessThan(1e-4);
      }
    }
    const island = PHASE1_MAP.islands[0]!;
    const camera = new THREE.PerspectiveCamera(40, 1, 1, 200);
    camera.position.set(island.x, 100, -island.y);
    camera.lookAt(island.x, 0, -island.y);
    camera.updateMatrixWorld();
    model.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
    const land = meshes(model).filter((m) => m.name !== 'windows');
    expect(land.some((m) => frustum.intersectsObject(m))).toBe(true);
    expect(land.some((m) => !frustum.intersectsObject(m))).toBe(true);
    model.dispose();
  });

  it('uses restored levels immediately and supports arbitrary ids and map placement', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const levels = settlementLevels(world.trade);
    const original = PHASE1_MAP.islands.find((i) => i.id === 'calda')!;
    const originalPort = PHASE1_MAP.ports.find((p) => p.islandId === original.id)!;
    const island = {
      ...original,
      id: 'edited-island',
      x: 1100,
      y: -800,
      radius: original.radius * 1.3,
    };
    const port = { ...originalPort, id: 'edited-port', islandId: island.id };
    const map = { ...PHASE1_MAP, islands: [island], ports: [port], terrain: [] };
    const savedLevels = { ...levels, [port.id]: 4 as const };
    const model = new HighlandIslands(map, true, savedLevels);
    const expected = islandParts(island, map, map.seed * 1000, undefined, 4);
    expect(vertices(meshes(model).map((m) => m.geometry))).toEqual(vertices(expected));
    expect(model.userData.harbours[port.id]).toBeDefined();
    expect(
      meshes(model).every((m) => m.name === 'windows' || (m.castShadow && m.receiveShadow)),
    ).toBe(true);
    for (const geometry of expected) geometry.dispose();
    model.dispose();
  });
});
