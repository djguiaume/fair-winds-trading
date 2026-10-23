import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BOAT_CLASSES } from '../src/render/models/storybookBoat';
import { createBoatModel as createStorybookBoat } from '../src/render/models';
import { STYLE_D, BOAT_SCALE } from '../src/render/models/boatStyle';
import { fluytDetails } from '../src/render/models/fluytDetails';
import { indiamanDetails } from '../src/render/models/indiamanDetails';
import { isGlowing } from '../src/render/models/geometry';

for (const [id, details, panes] of [
  ['fluyt', fluytDetails, 4],
  ['indiaman', indiamanDetails, 5],
] as const) {
  describe(`${id} immersed rudder and stern windows`, () => {
    it('crosses the waterline, follows the stern and reaches near the keel at every hull level', () => {
      const cls = BOAT_CLASSES[id]!;
      const depth = cls.H * STYLE_D.H;
      const deckAt = (z: number) =>
        depth * 0.55 + STYLE_D.sheer * Math.sqrt(cls.L / 5) * (z / (cls.L / 2)) ** 2;
      for (const level of [1, 2, 3] as const) {
        const parts = details({
          length: cls.L,
          beam: cls.B * STYLE_D.B,
          depth,
          deckAt,
          hull: cls.hull,
          band: cls.band,
          upgrades: { hull: level, hold: level, sails: level },
        });
        const rudders = parts.filter((p) => p.userData.rudder === true);
        expect(rudders.length).toBeGreaterThan(0);
        const bounds = new THREE.Box3();
        for (const rudder of rudders) {
          rudder.computeBoundingBox();
          bounds.union(rudder.boundingBox!);
        }
        expect(bounds.min.y).toBeLessThan(-0.4);
        expect(bounds.max.y).toBeGreaterThan(0.1);
        expect(bounds.min.y).toBeGreaterThan(-depth * 0.45 - 0.1);
        expect(bounds.max.z - bounds.min.z).toBeGreaterThan(cls.L * 0.035);
        expect(bounds.max.x - bounds.min.x).toBeLessThan(cls.B * 0.1);
        // The blade remains meaningfully immersed as the boat heels; the model's waterline is y=0.
        for (const heel of [-0.3, 0, 0.3]) {
          const world = new THREE.Box3();
          for (const rudder of rudders) {
            const p = rudder.getAttribute('position');
            for (let i = 0; i < p.count; i++)
              world.expandByPoint(
                new THREE.Vector3()
                  .fromBufferAttribute(p, i)
                  .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
                  .multiplyScalar(BOAT_SCALE)
                  .applyAxisAngle(new THREE.Vector3(0, 0, 1), heel),
              );
          }
          expect(world.min.y).toBeLessThan(-0.8);
        }
        expect(parts.filter(isGlowing)).toHaveLength(panes);
        parts.forEach((p) => p.dispose());
      }
    });

    it('retains visible quiet rear glazing on Low and night transitions', () => {
      const b = createStorybookBoat(id, { upgrades: { hull: 3, hold: 3, sails: 3 } });
      b.setLowDetail?.(true);
      const windows = b.root.getObjectByName('SternWindows') as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshBasicMaterial
      >;
      expect(windows.visible).toBe(true);
      b.setNightLighting?.(0);
      const day = windows.material.color.clone();
      b.setNightLighting?.(1);
      expect(windows.material.color.r).toBeGreaterThan(day.r);
      expect(windows.material.color.r).toBeLessThan(0.6);
      windows.geometry.computeBoundingBox();
      expect(windows.geometry.boundingBox!.min.y).toBeGreaterThan(1);
      b.dispose();
    });
  });
}
