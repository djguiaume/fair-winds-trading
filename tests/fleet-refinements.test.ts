import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBoatModel } from '../src/render/models';
import type { RefinedBoat } from '../src/render/models/refinedBoat';
import { fluytDetails, FLUYT_MIZZEN } from '../src/render/models/fluytDetails';
import { indiamanDetails, INDIAMAN_MIZZEN } from '../src/render/models/indiamanDetails';
import { STYLE_D } from '../src/render/models/boatStyle';

describe('fleet refinements on the current ship registry', () => {
  for (const [id, length, beam, depth, z, details, layout] of [
    ['fluyt', 11.5, 3.5, 1.8, -3.3, fluytDetails, FLUYT_MIZZEN],
    ['indiaman', 13, 3.8, 2, -3.8, indiamanDetails, INDIAMAN_MIZZEN],
  ] as const) {
    it(`${id} has an actual raised deck under the rear mast and quiet night glazing`, () => {
      const deckAt = (z: number) =>
        depth * STYLE_D.H * 0.55 + STYLE_D.sheer * Math.sqrt(length / 5) * (z / (length / 2)) ** 2;
      const parts = details({
        length,
        beam: beam * STYLE_D.B,
        depth: depth * STYLE_D.H,
        deckAt,
        hull: '#6e4520',
        band: '#b5652a',
        upgrades: { hull: 3, hold: 3, sails: 3 },
      });
      const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      const meshes = parts.map((g) => new THREE.Mesh(g, material));
      meshes.forEach((m) => m.updateMatrixWorld(true));
      for (const x of [-0.2, 0, 0.2]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
        expect(ray.intersectObjects(meshes)[0]!.point.y).toBeCloseTo(layout.deck, 4);
      }
      const b = createBoatModel(id);
      const pivot = b.root.getObjectByName('MizzenPivot')!;
      expect(pivot.position.y).toBeCloseTo(deckAt(z) + layout.foot);
      b.setLowDetail?.(true);
      b.setNightLighting?.(1);
      const glass = b.root.getObjectByName('SternWindows') as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshBasicMaterial
      >;
      expect(glass.visible).toBe(true);
      expect(glass.material.color.r).toBeGreaterThan(0.4);
      expect(glass.material.color.r).toBeLessThan(0.6);
      b.dispose();
      parts.forEach((p) => p.dispose());
      material.dispose();
    });
  }

  it('keeps every fluyt cargo upgrade below the real square sails and away from the mast', () => {
    for (const hold of [1, 2, 3] as const) {
      const b = createBoatModel('fluyt', { upgrades: { hold, hull: 3, sails: 3 } }) as RefinedBoat;
      expect(b.cargoBounds).toHaveLength([6, 8, 11][hold - 1]!);
      const ship = b.root.getObjectByName('FluytHull')!.parent!;
      for (const angle of [-1.2, -0.6, 0.6, 1.2]) {
        b.update({
          sail: 1,
          boomAngle: angle / 2,
          windRelative: angle,
          heel: 0.2,
          luff: 0,
          time: 3,
        });
        b.root.updateWorldMatrix(true, true);
        for (const name of ['ForeCourses', 'MainCourses']) {
          const sail = b.root.getObjectByName(name) as THREE.Mesh;
          const p = sail.geometry.getAttribute('position');
          const box = new THREE.Box3();
          for (let i = 0; i < p.count; i++)
            box.expandByPoint(
              ship.worldToLocal(sail.localToWorld(new THREE.Vector3().fromBufferAttribute(p, i))),
            );
          b.cargoBounds.forEach((c) => expect(box.intersectsBox(c)).toBe(false));
        }
      }
      b.cargoBounds.forEach((c, i) => {
        expect(c.min.x > 0.6 || c.max.x < -0.6).toBe(true);
        for (let j = i + 1; j < b.cargoBounds.length; j++)
          expect(c.intersectsBox(b.cargoBounds[j]!)).toBe(false);
      });
      b.dispose();
    }
  });
});
