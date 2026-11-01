import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BOAT_LOOK } from '../src/render/models/boatLook';
import { createBoatModel } from '../src/render/models';
import { STYLE_D } from '../src/render/models/boatStyle';
import { QUALITY } from '../src/render/quality';
import type { BoatPose, ShipUpgrades } from '../src/render/models/types';
import { shipModel } from '../src/render/models/shipModels';
import type { RefinedBoat } from '../src/render/models/refinedBoat';

const POSE: BoatPose = { sail: 1, boomAngle: 0, luff: 0, heel: 0, windRelative: 0, time: 0 };
const level = (n: 1 | 2 | 3): ShipUpgrades => ({ sails: n, hold: n, hull: n });
const v = () => new THREE.Vector3();
const near = (a: THREE.Vector3, b: THREE.Vector3) => expect(a.distanceTo(b)).toBeLessThan(1e-5);
const mesh = (b: RefinedBoat, name: string) => b.root.getObjectByName(name) as THREE.Mesh;

/** Read real geometry vertices, so a correct-looking pivot with detached cloth cannot pass. */
function luffVertices(m: THREE.Mesh) {
  const p = m.geometry.getAttribute('position');
  return Array.from({ length: p.count }, (_, i) => v().fromBufferAttribute(p, i)).filter(
    (p) => Math.abs(p.x) < 1e-6 && Math.abs(p.z) < 1e-6,
  );
}

describe('refined upgraded schooner', () => {
  it('routes only the schooner to its refined class and preserves the hull-sized wake', () => {
    const schooner = createBoatModel('schooner');
    const sloop = createBoatModel('sloop');
    expect((schooner as RefinedBoat).name).toBe('Schooner');
    expect((sloop as RefinedBoat).name).toBe('Sloop');
    expect(schooner.wakeHull.length).toBeCloseTo(18.04);
    expect(schooner.wakeHull.beam).toBeCloseTo(5.313);
    expect(schooner.wakeHull.length / schooner.wakeHull.beam).toBeGreaterThan(
      sloop.wakeHull.length / sloop.wakeHull.beam,
    );
    schooner.dispose();
    sloop.dispose();
  });
  it('retains its independent long hull, narrow counter and two unequal mast stations', () => {
    const b = shipModel('schooner');
    const p = mesh(b, 'SchoonerHull').geometry.getAttribute('position');
    const normalized = (i: number) =>
      new THREE.Vector2(p.getX(i * 42 + 1) / (2.3 * STYLE_D.B), p.getZ(i * 42 + 1) / 8.2);
    expect(normalized(1).x).toBeCloseTo(0.12);
    expect(normalized(3).y).toBeCloseTo(0.06);
    expect(normalized(6).x).toBeCloseTo(0.22);
    expect(normalized(6).y).toBeCloseTo(-0.5);
    expect(p.getX(3 * 42 + 16) / p.getX(3 * 42 + 1)).toBeCloseTo(0.09);
    const main = b.root.getObjectByName('MainsailPivot')!;
    const fore = b.root.getObjectByName('ForesailPivot')!;
    expect(main.position.z).toBe(-1.4);
    expect(fore.position.z).toBe(1.6);
    expect(main.position.y).toBeLessThan(fore.position.y);
    // Forward boom clears the aft mast even with both sails on the centreline.
    const boom = mesh(b, 'ForeBoomAndGaff').geometry;
    boom.computeBoundingBox();
    expect(fore.position.z + boom.boundingBox!.min.z).toBeGreaterThan(main.position.z + 0.1);
    b.dispose();
  });

  it('keeps both ends of EVERY upgraded jib on its own forestay while tacking, reefing and heeling', () => {
    for (const sails of [1, 2, 3] as const)
      for (const hold of [1, 2, 3] as const)
        for (const hull of [1, 2, 3] as const) {
          const b = shipModel('schooner', { upgrades: { sails, hold, hull } });
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
                  // Compare the actual free corner to its working sheet, not just a named pivot.
                  const clew = v().fromBufferAttribute(jib.geometry.getAttribute('position'), 31);
                  near(
                    jib.localToWorld(clew),
                    rig.localToWorld(
                      v().fromBufferAttribute(line, b.stats.jibs * 2 + 10 + 8 + index * 2 + 1),
                    ),
                  );
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
          // Fixed stays really terminate on the foremast and along the solid bowsprit.
          const deckAt = (z: number) =>
            1.1 * STYLE_D.H * 0.55 + STYLE_D.sheer * (8.2 / 5) ** 0.5 * (z / 4.1) ** 2;
          const bowY = deckAt(4.1) + 0.13;
          for (let j = 0; j < jibs.length; j++) {
            const tack = v().fromBufferAttribute(line, j * 2);
            const head = v().fromBufferAttribute(line, j * 2 + 1);
            expect(head.x).toBeCloseTo(0);
            expect(head.z).toBeCloseTo(1.6);
            expect(head.y).toBeLessThan(deckAt(1.6) + 6.4 * STYLE_D.mastK);
            expect(tack.y).toBeCloseTo(bowY - 0.1 + (0.3 * (tack.z / 8.2 - 0.35)) / 0.38);
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

  it('keeps both gaff sails on their own mast and their running rigging attached in every upgrade combination', () => {
    for (const sails of [1, 2, 3] as const)
      for (const hold of [1, 2, 3] as const)
        for (const hull of [1, 2, 3] as const) {
          const b = shipModel('schooner', { upgrades: { sails, hold, hull } });
          const rig = b.root.getObjectByName('Rigging') as THREE.LineSegments;
          const ropes = rig.geometry.getAttribute('position');
          // Individual stays, four shrouds and one inter-mast stay precede the running lines.
          const running = b.stats.jibs * 2 + 10;
          for (const sail of [0, 0.4, 1])
            for (const boomAngle of [-1, 0, 1])
              for (const heel of [-0.3, 0.3]) {
                b.update({ ...POSE, sail, boomAngle, luff: 1, heel, time: 0.2 });
                b.root.updateWorldMatrix(true, true);
                for (const [index, name] of ['Mainsail', 'Foresail'].entries()) {
                  const cloth = mesh(b, name);
                  const pivot = cloth.parent!;
                  const tack = pivot.position.clone();
                  const vertices = luffVertices(cloth);
                  expect(vertices.length).toBeGreaterThan(6);
                  near(cloth.localToWorld(v()), pivot.parent!.localToWorld(tack));
                  for (const p of vertices) {
                    const inShip = pivot.parent!.worldToLocal(cloth.localToWorld(p.clone()));
                    expect(inShip.x).toBeCloseTo(0, 5);
                    expect(inShip.z).toBeCloseTo(pivot.position.z, 5);
                  }
                  const height = (index === 0 ? 7.4 : 6.4) * STYLE_D.mastK;
                  const peak = new THREE.Vector3(0, height * 0.69, -(index === 0 ? 2.55 : 1.95));
                  const clew = new THREE.Vector3(0, 0, -(index === 0 ? 3.4 : 2.45));
                  near(
                    pivot.localToWorld(peak),
                    rig.localToWorld(v().fromBufferAttribute(ropes, running + index * 4 + 1)),
                  );
                  near(
                    pivot.localToWorld(clew),
                    rig.localToWorld(v().fromBufferAttribute(ropes, running + index * 4 + 3)),
                  );
                  expect(mesh(b, index === 0 ? 'BoomAndGaff' : 'ForeBoomAndGaff').parent).toBe(
                    pivot,
                  );
                }
              }
          b.dispose();
        }
  });

  it('retains every independent upgrade combination within the documented schooner geometry/draw budget', () => {
    for (const sails of [1, 2, 3] as const)
      for (const hold of [1, 2, 3] as const)
        for (const hull of [1, 2, 3] as const) {
          const b = shipModel('schooner', { upgrades: { sails, hold, hull } });
          expect(b.stats.crates + b.stats.barrels).toBe([4, 6, 9][hold - 1]);
          expect(b.stats.jibs).toBe(sails === 1 ? 2 : 3);
          expect(b.stats.topsail).toBe(sails === 3);
          expect(b.stats.meshes).toBeLessThanOrEqual(9);
          expect(b.stats.triangles).toBeLessThanOrEqual(1071);
          expect(b.wakeHull.length).toBeCloseTo(18.04);
          expect(b.wakeHull.beam).toBeCloseTo(5.313);
          // Hull 2 keeps green paint, hull 3 also keeps copper: colour upgrades remain actual geometry.
          const colors = mesh(b, 'SchoonerHull').geometry.getAttribute('color');
          for (const [required, hex] of [
            [hull >= 2, '#2f8f7a'],
            [hull >= 3, BOAT_LOOK.hull.copper],
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
    const b = shipModel('schooner', { upgrades: level(3) });
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
    const noRopes = shipModel('schooner', { rigging: false });
    noRopes.setLowDetail(false);
    expect(noRopes.root.getObjectByName('Rigging')!.visible).toBe(false);
    noRopes.dispose();
  });
});
