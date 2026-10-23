import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBoatModel } from '../src/render/models';
import { QUALITY } from '../src/render/quality';
import { STYLE_D } from '../src/render/models/boatStyle';
import { triangleCount } from '../src/render/models/geometry';
import type { BoatPose } from '../src/render/models/types';
import { shipModel } from '../src/render/models/shipModels';
import type { RefinedBoat } from '../src/render/models/refinedBoat';

const POSE: BoatPose = { sail: 1, boomAngle: 0, luff: 0, heel: 0, windRelative: 0, time: 0 };
const v = () => new THREE.Vector3();
const mesh = (b: RefinedBoat, name: string) => b.root.getObjectByName(name) as THREE.Mesh;
const near = (a: THREE.Vector3, b: THREE.Vector3) => expect(a.distanceTo(b)).toBeLessThan(1e-5);
const deckAt = (z: number) =>
  1.15 * STYLE_D.H * 0.55 + STYLE_D.sheer * (9.8 / 5) ** 0.5 * (z / 4.9) ** 2;
const rigs = [
  { name: 'Mainsail', z: 0.2, h: 8.8, boom: 2.45, gaff: 2.05, spar: 'BoomAndGaff' },
  { name: 'Foresail', z: 2.8, h: 7.6, boom: 2.2, gaff: 1.8, spar: 'ForeBoomAndGaff' },
  { name: 'Mizzen', z: -2.6, h: 7.8, boom: 2.15, gaff: 1.8, spar: 'MizzenBoomAndGaff' },
];

describe('refined clipper', () => {
  it('routes through the real factory, retains its long hull envelope and independent sections', () => {
    const b = createBoatModel('clipper') as RefinedBoat;
    expect((b as RefinedBoat).name).toBe('Clipper');
    expect(b.wakeHull.length).toBeCloseTo(21.56);
    expect(b.wakeHull.beam).toBeCloseTo(5.544);
    const p = mesh(b, 'ClipperHull').geometry.getAttribute('position');
    // Each hull outline section contributes 42 vertices. Inspect actual authored geometry.
    expect(p.getX(42 + 1) / (2.4 * STYLE_D.B)).toBeCloseTo(0.08);
    expect(p.getZ(4 * 42 + 1) / 9.8).toBeCloseTo(-0.08);
    expect(p.getX(6 * 42 + 1) / (2.4 * STYLE_D.B)).toBeCloseTo(0.28);
    expect(p.getX(4 * 42 + 16) / p.getX(4 * 42 + 1)).toBeCloseTo(0.07);
    const schooner = shipModel('schooner');
    expect(b.wakeHull.length / b.wakeHull.beam).toBeGreaterThan(
      schooner.wakeHull.length / schooner.wakeHull.beam,
    );
    // Booms clear the next mast and the aft boom finishes within the stern.
    for (const [index, rig] of rigs.entries()) {
      const pivot = b.root.getObjectByName(`${rig.name}Pivot`)!;
      expect(pivot.position.y).toBeCloseTo(deckAt(rig.z) + 0.7);
      const spar = mesh(b, rig.spar).geometry;
      spar.computeBoundingBox();
      const nextZ = index === 0 ? -2.6 : index === 1 ? 0.2 : -4.9;
      expect(pivot.position.z + spar.boundingBox!.min.z).toBeGreaterThan(nextZ + 0.1);
    }
    schooner.dispose();
    b.dispose();
  });

  it('preserves all 27 upgrade combinations, actual cloth attachments and working ropes through every pose', () => {
    for (const sails of [1, 2, 3] as const)
      for (const hold of [1, 2, 3] as const)
        for (const hull of [1, 2, 3] as const) {
          const b = shipModel('clipper', { upgrades: { sails, hold, hull } });
          expect(b.stats.crates + b.stats.barrels).toBe([4, 6, 9][hold - 1]);
          expect(b.stats.jibs).toBe(3); // Existing clipper caps at three, including sails 2/3.
          expect(b.stats.topsail).toBe(sails === 3);
          expect(b.stats.meshes).toBeLessThanOrEqual(11);
          expect(b.stats.triangles).toBeLessThanOrEqual(1359);
          let triangles = 0;
          b.root.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) triangles += triangleCount((o as THREE.Mesh).geometry);
          });
          expect(b.stats.triangles).toBe(triangles);
          const colors = mesh(b, 'ClipperHull').geometry.getAttribute('color');
          for (const [required, hex] of [
            [hull >= 2, '#d8b04a'],
            [hull >= 3, '#c8743c'],
          ] as const) {
            const c = new THREE.Color(hex);
            expect(
              Array.from({ length: colors.count }, (_, i) => i).some(
                (i) =>
                  Math.abs(colors.getX(i) - c.r) +
                    Math.abs(colors.getY(i) - c.g) +
                    Math.abs(colors.getZ(i) - c.b) <
                  1e-5,
              ),
            ).toBe(required);
          }
          const rope = b.root.getObjectByName('Rigging') as THREE.LineSegments;
          const lines = rope.geometry.getAttribute('position');
          const running = 3 * 2 + 10 + 6; // stays, fore/main shrouds and interstay, mizzen shrouds/interstay
          for (const sail of [0, 0.35, 1])
            for (const boomAngle of [-1, 0, 1])
              for (const luff of [0, 1])
                for (const heel of [-0.3, 0.3]) {
                  b.update({ ...POSE, sail, boomAngle, heel, luff, time: 0.06 });
                  b.root.updateWorldMatrix(true, true);
                  for (const [index, rig] of rigs.entries()) {
                    const m = mesh(b, rig.name);
                    const pivot = m.parent!;
                    expect(pivot.position.z).toBe(rig.z);
                    near(m.localToWorld(v()), pivot.parent!.localToWorld(pivot.position.clone()));
                    const p = m.geometry.getAttribute('position');
                    let luffVertices = 0;
                    for (let i = 0; i < p.count; i++) {
                      if (Math.abs(p.getX(i)) > 1e-6 || Math.abs(p.getZ(i)) > 1e-6) continue;
                      luffVertices++;
                      const inShip = pivot.parent!.worldToLocal(
                        m.localToWorld(v().fromBufferAttribute(p, i)),
                      );
                      expect(inShip.x).toBeCloseTo(0, 5);
                      expect(inShip.z).toBeCloseTo(rig.z, 5);
                    }
                    expect(luffVertices).toBeGreaterThan(6);
                    const peak = new THREE.Vector3(0, rig.h * STYLE_D.mastK * 0.69, -rig.gaff);
                    near(
                      pivot.localToWorld(peak),
                      rope.localToWorld(v().fromBufferAttribute(lines, running + index * 4 + 1)),
                    );
                    // Actual free cloth corner follows its sheet; tack stays on its mast.
                    near(
                      m.localToWorld(v().fromBufferAttribute(p, 31)),
                      rope.localToWorld(v().fromBufferAttribute(lines, running + index * 4 + 3)),
                    );
                  }
                  for (let j = 0; j < 3; j++) {
                    const m = mesh(b, `Jib${j + 1}`);
                    const p = m.geometry.getAttribute('position');
                    const tack = v().fromBufferAttribute(lines, j * 2);
                    const head = v().fromBufferAttribute(lines, j * 2 + 1);
                    expect(head.z).toBeCloseTo(2.8);
                    expect(head.y).toBeLessThan(deckAt(2.8) + 7.6 * STYLE_D.mastK);
                    expect(tack.y).toBeCloseTo(
                      deckAt(4.9) + 0.13 - 0.1 + (0.3 * (tack.z / 9.8 - 0.35)) / 0.38,
                    );
                    expect(tack.z).toBeLessThan(9.8 * 0.73);
                    let count = 0;
                    for (let i = 0; i < p.count; i++) {
                      if (Math.abs(p.getX(i)) > 1e-6 || Math.abs(p.getZ(i)) > 1e-6) continue;
                      count++;
                      const point = v().fromBufferAttribute(p, i);
                      near(m.localToWorld(point.clone()), m.parent!.localToWorld(point));
                    }
                    expect(count).toBeGreaterThan(6);
                    const height = Math.max(
                      ...Array.from({ length: p.count }, (_, i) => p.getY(i)),
                    );
                    near(m.localToWorld(new THREE.Vector3(0, height, 0)), rope.localToWorld(head));
                    if (j > 0)
                      expect(
                        m.parent!.quaternion.angleTo(mesh(b, `Jib${j}`).parent!.quaternion),
                      ).toBeGreaterThan(0.01);
                    near(m.localToWorld(v()), rope.localToWorld(tack));
                    near(
                      m.localToWorld(v().fromBufferAttribute(p, 31)),
                      rope.localToWorld(v().fromBufferAttribute(lines, running + 12 + j * 2 + 1)),
                    );
                  }
                }
          b.dispose();
        }
  });

  it('keeps upgrades and attachment animation on all quality levels, skips hidden rope updates and restores them', () => {
    const b = shipModel('clipper', { upgrades: { sails: 3, hold: 3, hull: 3 } });
    const rope = b.root.getObjectByName('Rigging') as THREE.LineSegments;
    const p = rope.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (const quality of [...Object.keys(QUALITY), 'low', 'high']) {
      b.setLowDetail(quality === 'low');
      const version = p.version;
      b.update({ ...POSE, sail: 0.35, boomAngle: -0.6 });
      expect(rope.visible).toBe(quality !== 'low');
      expect(p.version > version).toBe(quality !== 'low');
      expect(mesh(b, 'Jib3').visible).toBe(true);
    }
    b.dispose();
    const disabled = shipModel('clipper', { rigging: false });
    disabled.setLowDetail(false);
    expect(disabled.root.getObjectByName('Rigging')!.visible).toBe(false);
    disabled.dispose();
  });
});
