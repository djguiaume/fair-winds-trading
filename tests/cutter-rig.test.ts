import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBoatModel } from '../src/render/models';
import { RefinedSloop } from '../src/render/models/sloop';
import { RefinedCutter } from '../src/render/models/cutter';
import { STYLE_D } from '../src/render/models/boatStyle';
import { QUALITY } from '../src/render/quality';
import type { BoatPose, ShipUpgrades } from '../src/render/models/types';

const POSE: BoatPose = { sail: 1, boomAngle: 0, luff: 0, heel: 0, windRelative: 0, time: 0 };
const level = (n: 1 | 2 | 3): ShipUpgrades => ({ sails: n, hold: n, hull: n });
const v = () => new THREE.Vector3();
const near = (a: THREE.Vector3, b: THREE.Vector3) => expect(a.distanceTo(b)).toBeLessThan(1e-5);
const mesh = (b: RefinedCutter, name: string) => b.root.getObjectByName(name) as THREE.Mesh;

/** Read real geometry vertices, so a correct-looking pivot with detached cloth cannot pass. */
function luffVertices(m: THREE.Mesh) {
  const p = m.geometry.getAttribute('position');
  return Array.from({ length: p.count }, (_, i) => v().fromBufferAttribute(p, i)).filter(
    (p) => Math.abs(p.x) < 1e-6 && Math.abs(p.z) < 1e-6,
  );
}

describe('refined upgraded cutter', () => {
  it('routes only the cutter to its refined class and preserves the hull-sized wake', () => {
    const cutter = createBoatModel('cutter');
    const sloop = createBoatModel('sloop');
    expect(cutter).toBeInstanceOf(RefinedCutter);
    expect(sloop).toBeInstanceOf(RefinedSloop);
    expect(cutter.wakeHull.length).toBeCloseTo(13.64);
    expect(cutter.wakeHull.beam).toBeCloseTo(4.851);
    expect(cutter.wakeHull.length / cutter.wakeHull.beam).toBeGreaterThan(
      sloop.wakeHull.length / sloop.wakeHull.beam,
    );
    cutter.dispose();
    sloop.dispose();
  });
  it('has its own fine bow, wide flat transom and V bottom at every hull upgrade', () => {
    for (const hull of [1, 2, 3] as const) {
      const cutter = new RefinedCutter({ upgrades: { hull, hold: 1, sails: 1 } });
      const sloop = new RefinedSloop({ upgrades: { hull, hold: 1, sails: 1 } });
      const cp = mesh(cutter, 'CutterHull').geometry.getAttribute('position');
      const sp = sloop.root.getObjectByName('SloopHull') as THREE.Mesh;
      const positions = sp.geometry.getAttribute('position');
      // Each outline station emits 42 vertices: deck, three shell bands, bottom, gunwale.
      // Read the merged production geometry, normalized by each class's dimensions.
      const deck = (
        p: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
        i: number,
        length: number,
        beam: number,
      ) => new THREE.Vector2(p.getX(i * 42 + 1) / (beam * STYLE_D.B), p.getZ(i * 42 + 1) / length);
      const bow = deck(cp, 1, 6.2, 2.1);
      const sloopBow = deck(positions, 1, 5, 1.9);
      expect(bow.x).toBeCloseTo(0.14);
      expect(sloopBow.x).toBeCloseTo(0.23);
      expect(bow.x).toBeLessThan(sloopBow.x);
      // Both transom corners share a stern plane, but the cutter has a broad working stern.
      const stern = deck(cp, 6, 6.2, 2.1);
      const opposite = deck(cp, 7, 6.2, 2.1);
      expect(stern.x).toBeCloseTo(0.38);
      expect(opposite.x).toBeCloseTo(-0.38);
      expect(stern.y).toBeCloseTo(-0.5);
      expect(opposite.y).toBeCloseTo(stern.y);
      expect(stern.x / deck(positions, 6, 5, 1.9).x).toBeGreaterThan(2);
      // Actual bottom section is independently shaped too, not just a new deck outline.
      expect(cp.getX(3 * 42 + 16) / cp.getX(3 * 42 + 1)).toBeCloseTo(0.06);
      expect(positions.getX(3 * 42 + 16) / positions.getX(3 * 42 + 1)).toBeCloseTo(0.18);
      cutter.dispose();
      sloop.dispose();
    }
  });

  it('keeps both ends of EVERY upgraded jib on its own forestay while tacking, reefing and heeling', () => {
    for (const sails of [1, 2, 3] as const)
      for (const hold of [1, 2, 3] as const)
        for (const hull of [1, 2, 3] as const) {
          const b = new RefinedCutter({ upgrades: { sails, hold, hull } });
          const jibs = Array.from({ length: b.stats.jibs }, (_, j) => mesh(b, `Jib${j + 1}`));
          const endpoints = jibs.map((j) => luffVertices(j));
          const rig = b.root.getObjectByName('Rigging') as THREE.LineSegments;
          const line = rig.geometry.getAttribute('position');
          for (const sail of [0, 0.35, 1])
            for (const boomAngle of [-1, 0, 1])
              for (const luff of [0, 1]) {
                b.update({ ...POSE, sail, boomAngle, luff, heel: -0.25, time: 0.06 });
                b.root.updateWorldMatrix(true, true);
                jibs.forEach((jib, index) => {
                  const vertices = endpoints[index]!;
                  const height = Math.max(...vertices.map((p) => p.y));
                  expect(vertices.length).toBeGreaterThan(6);
                  for (const p of vertices)
                    near(jib.localToWorld(p.clone()), jib.parent!.localToWorld(p.clone()));
                  // Also compare the actual cloth tips to the static forestay line tips.
                  near(
                    jib.localToWorld(v()),
                    rig.localToWorld(v().fromBufferAttribute(line, index * 2)),
                  );
                  near(
                    jib.localToWorld(new THREE.Vector3(0, height, 0)),
                    rig.localToWorld(v().fromBufferAttribute(line, index * 2 + 1)),
                  );
                });
              }
          // Extra jib is not accidentally using the first jib's inclined axis.
          for (let j = 1; j < jibs.length; j++) {
            expect(
              jibs[j - 1]!.parent!.position.distanceTo(jibs[j]!.parent!.position),
            ).toBeGreaterThan(0.4);
            expect(
              jibs[j - 1]!.parent!.quaternion.angleTo(jibs[j]!.parent!.quaternion),
            ).toBeGreaterThan(0.01);
          }
          b.dispose();
        }
  });

  it('keeps the mainsail tack at the gooseneck and its luff on the mast throughout sail lowering', () => {
    const b = new RefinedCutter({ upgrades: level(3) });
    const main = mesh(b, 'Mainsail');
    const pivot = main.parent!;
    const vertices = luffVertices(main);
    expect(vertices.length).toBeGreaterThan(6);
    const tack = pivot.position.clone();
    for (const sail of [0, 0.4, 1])
      for (const boomAngle of [-1, 0, 1]) {
        b.update({ ...POSE, sail, boomAngle, luff: 1, heel: 0.2, time: 0.2 });
        b.root.updateWorldMatrix(true, true);
        near(main.localToWorld(v()), pivot.parent!.localToWorld(tack.clone()));
        for (const p of vertices) {
          const inShip = pivot.parent!.worldToLocal(main.localToWorld(p.clone()));
          expect(inShip.x).toBeCloseTo(tack.x, 5);
          expect(inShip.z).toBeCloseTo(tack.z, 5);
        }
        // Gaff and boom share the cloth's yaw and lowering transform; no detached wooden spars.
        const spars = mesh(b, 'BoomAndGaff');
        expect(spars.parent).toBe(pivot);
        expect(main.scale.y).toBe(1);
        expect(pivot.position.equals(tack)).toBe(true);
      }
    b.dispose();
  });

  it('retains every independent upgrade combination within the documented cutter geometry/draw budget', () => {
    for (const sails of [1, 2, 3] as const)
      for (const hold of [1, 2, 3] as const)
        for (const hull of [1, 2, 3] as const) {
          const b = new RefinedCutter({ upgrades: { sails, hold, hull } });
          expect(b.stats.crates + b.stats.barrels).toBe([3, 5, 8][hold - 1]);
          expect(b.stats.jibs).toBe(sails === 1 ? 2 : 3);
          expect(b.stats.topsail).toBe(sails === 3);
          expect(b.stats.meshes).toBeLessThanOrEqual(7);
          expect(b.stats.triangles).toBeLessThanOrEqual(827);
          expect(b.wakeHull.length).toBeCloseTo(13.64);
          expect(b.wakeHull.beam).toBeCloseTo(4.851);
          // Hull 2 keeps red paint, hull 3 also keeps copper: colour upgrades remain actual geometry.
          const colors = mesh(b, 'CutterHull').geometry.getAttribute('color');
          for (const [required, hex] of [
            [hull >= 2, '#c0533a'],
            [hull >= 3, '#c8743c'],
          ] as const) {
            const want = new THREE.Color(hex);
            const found = Array.from({ length: colors.count }, (_, i) => i).some(
              (i) =>
                Math.abs(colors.getX(i) - want.r) +
                  Math.abs(colors.getY(i) - want.g) +
                  Math.abs(colors.getZ(i) - want.b) <
                1e-5,
            );
            expect(found).toBe(required);
          }
          b.dispose();
        }
  });

  it('honours all three quality levels and skips rope-buffer updates on Low', () => {
    const b = new RefinedCutter({ upgrades: level(3) });
    const rig = b.root.getObjectByName('Rigging') as THREE.LineSegments;
    const positions = rig.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (const quality of Object.keys(QUALITY)) {
      b.setLowDetail(quality === 'low');
      const version = positions.version;
      b.update({ ...POSE, boomAngle: -0.6, sail: 0.5 });
      expect(rig.visible).toBe(quality !== 'low');
      expect(positions.version > version).toBe(quality !== 'low');
      expect(mesh(b, 'Jib3').visible).toBe(true);
    }
    b.dispose();
    const noRopes = new RefinedCutter({ rigging: false });
    noRopes.setLowDetail(false);
    expect(noRopes.root.getObjectByName('Rigging')!.visible).toBe(false);
    noRopes.dispose();
  });
});
