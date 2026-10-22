import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { RefinedHoy } from '../src/render/models/hoy';
import { createBoatModel } from '../src/render/models';
import { isRefinedShip } from '../src/render/models/shipModels';
import { QUALITY } from '../src/render/quality';
import { STYLE_D } from '../src/render/models/boatStyle';
import { triangleCount } from '../src/render/models/geometry';
import type { BoatPose } from '../src/render/models/types';

const POSE: BoatPose = { sail: 1, boomAngle: 0, luff: 0, heel: 0, windRelative: 0, time: 0 };
const v = () => new THREE.Vector3();
const mesh = (b: RefinedHoy, name: string) => b.root.getObjectByName(name) as THREE.Mesh;
const near = (a: THREE.Vector3, b: THREE.Vector3) => expect(a.distanceTo(b)).toBeLessThan(1e-5);
const L = 6.2;
const deckAt = (z: number) =>
  1.3 * STYLE_D.H * 0.55 + STYLE_D.sheer * (L / 5) ** 0.5 * (z / (L / 2)) ** 2;
const MAST = { z: 0.9, h: 5.6, boom: 3.4, gaff: 1.7, gooseneck: 1.1 };

describe('refined hoy', () => {
  it('routes through the real factory with its beamy envelope, flat bottom, leeboards and a boom clear of the cargo', () => {
    expect(isRefinedShip('hoy')).toBe(true);
    const b = createBoatModel('hoy') as RefinedHoy;
    expect(b).toBeInstanceOf(RefinedHoy);
    expect(b.wakeHull.length).toBeCloseTo(13.64);
    expect(b.wakeHull.beam).toBeCloseTo(6.237);
    const hull = mesh(b, 'HoyHull').geometry;
    const p = hull.getAttribute('position');
    const halfBeam = (2.7 * STYLE_D.B) / 2;
    // Bluff bow: the second outline point is already 27% of the beam out (sloop 23%, clipper 8%).
    expect(p.getX(42 + 1) / (2.7 * STYLE_D.B)).toBeCloseTo(0.27);
    // Flat bottom: the keel section keeps 60% of the deck beam, against the swift line's 6–7%.
    expect(p.getX(4 * 42 + 16) / p.getX(4 * 42 + 1)).toBeCloseTo(0.6);
    // Leeboards hang outside the gunwale abreast the mast and stop above the keel.
    hull.computeBoundingBox();
    expect(hull.boundingBox!.max.x).toBeGreaterThan(halfBeam + 0.1);
    expect(hull.boundingBox!.min.x).toBeLessThan(-halfBeam - 0.1);
    expect(hull.boundingBox!.min.y).toBeCloseTo(deckAt(0) - 1.3 * STYLE_D.H, 1);
    const pivot = b.root.getObjectByName('MainsailPivot')!;
    expect(pivot.position.y).toBeCloseTo(deckAt(MAST.z) + MAST.gooseneck);
    const spar = mesh(b, 'BoomAndGaff').geometry;
    spar.computeBoundingBox();
    // The long boom ends inside the stern and swings above two layers of deck cargo.
    expect(pivot.position.z + spar.boundingBox!.min.z).toBeGreaterThan(-L / 2 + 0.1);
    const cargoTop = deckAt(-0.2 - 2 * 0.65) + 0.23 + 0.43 + 0.21;
    expect(pivot.position.y - 0.05).toBeGreaterThan(cargoTop);
    b.dispose();
  });

  it('preserves all 27 upgrade combinations, actual cloth attachments and working ropes through every pose', () => {
    for (const sails of [1, 2, 3] as const)
      for (const hold of [1, 2, 3] as const)
        for (const hull of [1, 2, 3] as const) {
          const b = new RefinedHoy({ upgrades: { sails, hold, hull } });
          const nj = sails >= 2 ? 2 : 1;
          expect(b.stats.crates + b.stats.barrels).toBe([4, 6, 9][hold - 1]);
          expect(b.stats.jibs).toBe(nj);
          expect(b.stats.topsail).toBe(sails === 3);
          expect(b.stats.meshes).toBeLessThanOrEqual(6);
          expect(b.stats.triangles).toBeLessThanOrEqual(999);
          let triangles = 0;
          b.root.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) triangles += triangleCount((o as THREE.Mesh).geometry);
          });
          expect(b.stats.triangles).toBe(triangles);
          const colors = mesh(b, 'HoyHull').geometry.getAttribute('color');
          for (const [required, hex] of [
            [hull >= 2, '#c9a23a'],
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
          const running = nj * 2 + 4; // jib stays, then the two main shrouds
          for (const sail of [0, 0.35, 1])
            for (const boomAngle of [-1, 0, 1])
              for (const luff of [0, 1])
                for (const heel of [-0.3, 0.3]) {
                  b.update({ ...POSE, sail, boomAngle, heel, luff, time: 0.06 });
                  b.root.updateWorldMatrix(true, true);
                  const m = mesh(b, 'Mainsail');
                  const pivot = m.parent!;
                  expect(pivot.position.z).toBe(MAST.z);
                  // Tack on the gooseneck; every luff vertex on the mast.
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
                    expect(inShip.z).toBeCloseTo(MAST.z, 5);
                  }
                  expect(luffVertices).toBeGreaterThan(6);
                  // Gaff lift to the real peak, sheet to the real clew.
                  const peak = new THREE.Vector3(0, MAST.h * STYLE_D.mastK * 0.69, -MAST.gaff);
                  near(
                    pivot.localToWorld(peak),
                    rope.localToWorld(v().fromBufferAttribute(lines, running + 1)),
                  );
                  near(
                    m.localToWorld(v().fromBufferAttribute(p, 31)),
                    rope.localToWorld(v().fromBufferAttribute(lines, running + 3)),
                  );
                  for (let j = 0; j < nj; j++) {
                    const jib = mesh(b, `Jib${j + 1}`);
                    const jp = jib.geometry.getAttribute('position');
                    const tack = v().fromBufferAttribute(lines, j * 2);
                    const head = v().fromBufferAttribute(lines, j * 2 + 1);
                    expect(head.z).toBeCloseTo(MAST.z);
                    expect(head.y).toBeLessThan(deckAt(MAST.z) + MAST.h * STYLE_D.mastK);
                    expect(tack.z).toBeLessThan(L * 0.73);
                    // Luff stays on its own stay while the free edge rolls and swings.
                    let count = 0;
                    for (let i = 0; i < jp.count; i++) {
                      if (Math.abs(jp.getX(i)) > 1e-6 || Math.abs(jp.getZ(i)) > 1e-6) continue;
                      count++;
                      const point = v().fromBufferAttribute(jp, i);
                      near(jib.localToWorld(point.clone()), jib.parent!.localToWorld(point));
                    }
                    expect(count).toBeGreaterThan(6);
                    const height = Math.max(
                      ...Array.from({ length: jp.count }, (_, i) => jp.getY(i)),
                    );
                    near(
                      jib.localToWorld(new THREE.Vector3(0, height, 0)),
                      rope.localToWorld(head),
                    );
                    near(jib.localToWorld(v()), rope.localToWorld(tack));
                    near(
                      jib.localToWorld(v().fromBufferAttribute(jp, 31)),
                      rope.localToWorld(v().fromBufferAttribute(lines, running + 4 + j * 2 + 1)),
                    );
                  }
                }
          b.dispose();
        }
  });

  it('keeps upgrades and attachment animation on all quality levels, skips hidden rope updates and restores them', () => {
    const b = new RefinedHoy({ upgrades: { sails: 3, hold: 3, hull: 3 } });
    const rope = b.root.getObjectByName('Rigging') as THREE.LineSegments;
    const p = rope.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (const quality of [...Object.keys(QUALITY), 'low', 'high']) {
      b.setLowDetail(quality === 'low');
      const version = p.version;
      b.update({ ...POSE, sail: 0.35, boomAngle: -0.6 });
      expect(rope.visible).toBe(quality !== 'low');
      expect(p.version > version).toBe(quality !== 'low');
      expect(mesh(b, 'Jib2').visible).toBe(true);
    }
    b.dispose();
    const disabled = new RefinedHoy({ rigging: false });
    disabled.setLowDetail(false);
    expect(disabled.root.getObjectByName('Rigging')!.visible).toBe(false);
    disabled.dispose();
  });
});
