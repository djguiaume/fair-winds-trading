import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PHASE0_MAP } from '../src/data/maps';
import { bearingTo } from '../src/sim/math';
import { buildHighlandIslands } from '../src/render/models/highlandIslands';
import { islandParts } from '../src/render/models/islandParts';
import type { StorybookBoat } from '../src/render/models/storybookBoat';
import { createShipModel } from '../src/render/models/shipModels';
import { triangleCount } from '../src/render/models/geometry';
import type { BoatPose, ShipUpgrades, UpgradeLevel } from '../src/render/models/types';

const POSE: BoatPose = { sail: 1, boomAngle: 0, luff: 0, heel: 0, windRelative: 0, time: 0 };
const level = (n: UpgradeLevel): ShipUpgrades => ({ sails: n, hold: n, hull: n });

function boat(id = 'sloop', upgrades = level(1)) {
  return createShipModel(id, { upgrades }) as StorybookBoat;
}

function worldBox(o: THREE.Object3D) {
  o.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(o);
}

/** The mesh using the sail material that hangs under a boom pivot (the mainsail). */
function mainsail(b: StorybookBoat) {
  let found: THREE.Object3D | undefined;
  b.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.parent?.children.length === 2 && m.parent.children[1] === m) found ??= m;
  });
  return found!;
}

describe('storybook boats (style D)', () => {
  it('points the bow to -Z with the waterline at y = 0', () => {
    const box = worldBox(boat().root);
    expect(-box.min.z).toBeGreaterThan(box.max.z); // bowsprit reaches farther forward
    expect(box.min.y).toBeLessThan(0);
    expect(box.max.y).toBeGreaterThan(9); // ~11 m mast, chunky like the ad
  });

  it('swings the boom and mainsail to the side of boomAngle, aft of the mast', () => {
    const b = boat();
    b.update({ ...POSE, boomAngle: 0.6 });
    const star = worldBox(mainsail(b)).getCenter(new THREE.Vector3());
    b.update({ ...POSE, boomAngle: -0.6 });
    const port = worldBox(mainsail(b)).getCenter(new THREE.Vector3());
    expect(star.x).toBeGreaterThan(0.5);
    expect(port.x).toBeLessThan(-0.5);
    expect(star.z).toBeGreaterThan(0);
  });

  it('streams the flag with the wind like the placeholder pennant', () => {
    const b = boat();
    const flag = b.root.children[0]!.children[0]!.children.find(
      (o) => (o as THREE.Mesh).material instanceof THREE.MeshBasicMaterial,
    )!;
    const tipDir = (windRelative: number) => {
      b.update({ ...POSE, windRelative });
      b.root.updateWorldMatrix(true, true);
      const base = flag.localToWorld(new THREE.Vector3(0, 0, 0));
      return flag.localToWorld(new THREE.Vector3(0, -0.25, -1)).sub(base);
    };
    expect(tipDir(0).z).toBeLessThan(0); // wind blowing toward the bow: flag points forward
    expect(tipDir(Math.PI / 2).x).toBeGreaterThan(0); // toward starboard
  });

  it('shows every upgrade level on the model', () => {
    const stock = boat('sloop', level(1)).stats;
    const l2 = boat('sloop', level(2)).stats;
    const l3 = boat('sloop', level(3)).stats;
    expect([stock.crates + stock.barrels, l2.crates + l2.barrels, l3.crates + l3.barrels]).toEqual([
      2, 4, 7,
    ]);
    expect(stock.barrels).toBe(0);
    expect(l2.barrels).toBeGreaterThan(0);
    expect([stock.jibs, l2.jibs, l3.jibs]).toEqual([1, 2, 2]);
    expect([stock.topsail, l2.topsail, l3.topsail]).toEqual([false, false, true]);
    // Band (hull 2) and copper (hull 3) add triangles to the hull mesh.
    expect(l2.triangles).toBeGreaterThan(stock.triangles);
    expect(boat('cutter', level(1)).stats.jibs).toBe(2);
  });

  it('draws the cutter longer than the sloop', () => {
    const sloop = worldBox(boat('sloop').root);
    const cutter = worldBox(boat('cutter').root);
    expect(cutter.max.z - cutter.min.z).toBeGreaterThan(sloop.max.z - sloop.min.z);
  });

  it('stays within the old-tablet budget (decision 0006)', () => {
    for (const id of ['sloop', 'cutter']) {
      const s = boat(id, level(3)).stats;
      expect(s.meshes).toBeLessThanOrEqual(id === 'cutter' ? 7 : 6);
      expect(s.triangles).toBeLessThan(1500);
    }
  });

  it('falls back to the sloop for classes without a model yet', () => {
    expect(boat('brig').stats.triangles).toBe(boat('sloop').stats.triangles);
  });
});

describe('highland islands (B2)', () => {
  const map = PHASE0_MAP;

  it('batches each island separately within the original triangle budget', () => {
    const mesh = buildHighlandIslands(map, { shadows: false });
    let triangles = 0;
    mesh.traverse((o) => {
      if (o instanceof THREE.Mesh) triangles += triangleCount(o.geometry);
    });
    expect(mesh.children).toHaveLength(map.islands.length);
    expect(triangles).toBeLessThan(20000);
    mesh.dispose();
  });

  it('keeps everything above water inside the collision circle, except the dock', () => {
    for (const [i, island] of map.islands.entries()) {
      if (island.look?.dock) continue;
      const geo = islandParts(island, map, map.seed * 1000 + i);
      let maxD = 0;
      for (const g of geo) {
        const p = g.attributes.position!;
        for (let k = 0; k < p.count; k++) {
          if (p.getY(k) < 0) continue;
          maxD = Math.max(maxD, Math.hypot(p.getX(k) - island.x, p.getZ(k) + island.y));
        }
      }
      expect(maxD, island.id).toBeLessThan(island.radius * 1.15);
    }
  });

  it('turns each harbour toward its course buoy', () => {
    for (const [i, island] of map.islands.entries()) {
      const wp = map.course.find((w) => w.label === island.name);
      if (!wp || !island.look?.dock) continue;
      const geo = islandParts(island, map, map.seed * 1000 + i);
      let sx = 0;
      let sy = 0;
      for (const g of geo) {
        const p = g.attributes.position!;
        for (let k = 0; k < p.count; k++) {
          const dx = p.getX(k) - island.x;
          const dy = -p.getZ(k) - island.y;
          if (p.getY(k) >= 0 && Math.hypot(dx, dy) > island.radius * 1.2) {
            sx += dx;
            sy += dy;
          }
        }
      }
      const dockBearing = Math.atan2(sx, sy);
      const want = bearingTo(island, wp);
      expect(
        Math.abs(Math.atan2(Math.sin(dockBearing - want), Math.cos(dockBearing - want))),
      ).toBeLessThan(0.3);
    }
  });

  it("takes the island's look from the good its port produces", () => {
    const calda = map.islands.find((i) => i.id === 'calda')!;
    const port = map.ports.find((p) => p.islandId === 'calda')!;
    expect(port.produces[0]).toBe('timber');
    const count = (m: typeof map) =>
      islandParts(calda, m, 1).reduce((n, g) => n + triangleCount(g), 0);
    // Timber islands get a forest even if the map asks for few trees.
    expect(count(map)).toBeGreaterThan(count({ ...map, ports: [] }));
  });
});
