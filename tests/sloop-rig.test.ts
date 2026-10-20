import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createStorybookBoat } from '../src/render/models/storybookBoat';
import { RefinedSloop } from '../src/render/models/sloop';
import { QUALITY } from '../src/render/quality';
import type { BoatPose, ShipUpgrades } from '../src/render/models/types';

const POSE: BoatPose = { sail: 1, boomAngle: 0, luff: 0, heel: 0, windRelative: 0, time: 0 };
const level = (n: 1 | 2 | 3): ShipUpgrades => ({ sails: n, hold: n, hull: n });
const v = () => new THREE.Vector3();
const near = (a: THREE.Vector3, b: THREE.Vector3) => expect(a.distanceTo(b)).toBeLessThan(1e-5);
const mesh = (b: RefinedSloop, name: string) => b.root.getObjectByName(name) as THREE.Mesh;

/** Read real geometry vertices, so a correct-looking pivot with detached cloth cannot pass. */
function luffVertices(m: THREE.Mesh) {
  const p = m.geometry.getAttribute('position');
  return Array.from({ length: p.count }, (_, i) => v().fromBufferAttribute(p, i)).filter(
    (p) => Math.abs(p.x) < 1e-6 && Math.abs(p.z) < 1e-6,
  );
}

describe('refined upgraded sloop', () => {
  it('uses the new model only for the sloop (and the documented unknown-class fallback)', () => {
    const sloop = createStorybookBoat('sloop');
    const fallback = createStorybookBoat('unknown');
    const cutter = createStorybookBoat('cutter');
    expect(sloop).toBeInstanceOf(RefinedSloop);
    expect(fallback).toBeInstanceOf(RefinedSloop);
    expect(cutter).not.toBeInstanceOf(RefinedSloop);
    for (const b of [sloop, fallback, cutter]) b.dispose();
  });

  it('keeps both ends of EVERY upgraded jib on its own forestay while tacking, reefing and heeling', () => {
    const b = new RefinedSloop({ upgrades: level(3) });
    const jibs = [mesh(b, 'Jib1'), mesh(b, 'Jib2')];
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
            near(jib.localToWorld(v()), rig.localToWorld(v().fromBufferAttribute(line, index * 2)));
            near(
              jib.localToWorld(new THREE.Vector3(0, height, 0)),
              rig.localToWorld(v().fromBufferAttribute(line, index * 2 + 1)),
            );
          });
        }
    // Extra jib is not accidentally using the first jib's inclined axis.
    expect(jibs[0]!.parent!.position.distanceTo(jibs[1]!.parent!.position)).toBeGreaterThan(0.5);
    b.dispose();
  });

  it('keeps the mainsail tack at the gooseneck and its luff on the mast throughout sail lowering', () => {
    const b = new RefinedSloop({ upgrades: level(3) });
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

  it('retains every independent upgrade combination within the original geometry/draw budget', () => {
    for (const sails of [1, 2, 3] as const)
      for (const hold of [1, 2, 3] as const)
        for (const hull of [1, 2, 3] as const) {
          const b = new RefinedSloop({ upgrades: { sails, hold, hull } });
          expect(b.stats.crates + b.stats.barrels).toBe([2, 4, 7][hold - 1]);
          expect(b.stats.jibs).toBe(sails === 1 ? 1 : 2);
          expect(b.stats.topsail).toBe(sails === 3);
          expect(b.stats.meshes).toBeLessThanOrEqual(6);
          expect(b.stats.triangles).toBeLessThan(1500);
          // Hull 2 keeps blue paint, hull 3 also keeps copper: colour upgrades remain actual geometry.
          const colors = mesh(b, 'SloopHull').geometry.getAttribute('color');
          for (const [required, hex] of [
            [hull >= 2, '#2f6f9f'],
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
    const b = new RefinedSloop({ upgrades: level(3) });
    const rig = b.root.getObjectByName('Rigging') as THREE.LineSegments;
    const positions = rig.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (const quality of Object.keys(QUALITY)) {
      b.setLowDetail(quality === 'low');
      const version = positions.version;
      b.update({ ...POSE, boomAngle: -0.6, sail: 0.5 });
      expect(rig.visible).toBe(quality !== 'low');
      expect(positions.version > version).toBe(quality !== 'low');
      expect(mesh(b, 'Jib2').visible).toBe(true);
    }
    b.dispose();
    const noRopes = new RefinedSloop({ rigging: false });
    noRopes.setLowDetail(false);
    expect(noRopes.root.getObjectByName('Rigging')!.visible).toBe(false);
    noRopes.dispose();
  });
});
