import { INDIAMAN_PORTS } from '../src/render/models/shipParts';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BOAT_LOOK } from '../src/render/models/boatLook';
import { INDIAMAN_MIZZEN } from '../src/render/models/indiamanDetails';
import { createBoatModel } from '../src/render/models';
import { isRefinedShip } from '../src/render/models/shipModels';
import { QUALITY } from '../src/render/quality';
import { STYLE_D } from '../src/render/models/boatStyle';
import { triangleCount } from '../src/render/models/geometry';
import type { BoatPose } from '../src/render/models/types';
import { shipModel } from '../src/render/models/shipModels';
import type { RefinedBoat } from '../src/render/models/refinedBoat';

const POSE: BoatPose = { sail: 1, boomAngle: 0, luff: 0, heel: 0, windRelative: 0, time: 0 };
const v = () => new THREE.Vector3();
const mesh = (b: RefinedBoat, name: string) => b.root.getObjectByName(name) as THREE.Mesh;
const near = (a: THREE.Vector3, b: THREE.Vector3) => expect(a.distanceTo(b)).toBeLessThan(1e-4);
const L = 13;
const deckAt = (z: number) =>
  2 * STYLE_D.H * 0.55 + STYLE_D.sheer * (L / 5) ** 0.5 * (z / (L / 2)) ** 2;
const CASTLE = 0.9 * STYLE_D.H;
const DEG = Math.PI / 180;
const BOOMS = [-80, -40, -12, -3.6, 0, 3.6, 12, 40, 80].map((d) => d * DEG);
/** Expected yard brace for a boom angle: hard round close-hauled, square running (view.ts range). */
const braceFor = (b: number) =>
  -Math.sign(b) *
  40 *
  DEG *
  (1 - Math.min(1, Math.max(0, (Math.abs(b) - 12 * DEG) / (68 * DEG)))) *
  Math.min(1, Math.abs(b) / (12 * DEG));
const squares = [
  { name: 'Fore', z: 3.8, h: 9.6 },
  { name: 'Main', z: 0.4, h: 10.8 },
];

/** Vertex i of a morphing mesh as drawn, in world space (CPU copy of the morph blend). */
function drawn(m: THREE.Mesh, i: number) {
  const p = m.geometry.getAttribute('position');
  const f = m.geometry.morphAttributes.position![0]!;
  const w = m.morphTargetInfluences![0]!;
  const base = v().fromBufferAttribute(p, i);
  return m.localToWorld(base.lerp(v().fromBufferAttribute(f, i), w));
}

describe('refined indiaman', () => {
  it('routes through the real factory with its own hull, stern castle and envelope', () => {
    expect(isRefinedShip('indiaman')).toBe(true);
    const b = createBoatModel('indiaman') as RefinedBoat;
    expect((b as RefinedBoat).name).toBe('Indiaman');
    expect(b.wakeHull.length).toBeCloseTo(L * 2.2);
    expect(b.wakeHull.beam).toBeCloseTo(3.8 * STYLE_D.B * 2.2);
    const half = 3.8 * STYLE_D.B * 0.5;
    const hull = mesh(b, 'IndiamanHull').geometry;
    hull.computeBoundingBox();
    // Wall-sided: only a slight tumblehome, much less than the fluyt's pear-shaped sections.
    expect(hull.boundingBox!.max.x).toBeLessThan(half * 1.08);
    const fluyt = shipModel('fluyt');
    const fh = mesh(fluyt, 'FluytHull').geometry;
    fh.computeBoundingBox();
    expect(hull.boundingBox!.max.x / half).toBeLessThan(
      fh.boundingBox!.max.x / (3.5 * STYLE_D.B * 0.5),
    );
    // Broad square transom, where the fluyt pinches in.
    const p = hull.getAttribute('position');
    let transom = 0;
    for (let i = 0; i < p.count; i++)
      if (Math.abs(p.getZ(i) + L / 2) < 1e-4 && Math.abs(p.getY(i) - deckAt(-L / 2)) < 1e-4)
        transom = Math.max(transom, p.getX(i));
    expect(transom).toBeGreaterThan(half * 0.8);
    // The castle deck stands above the sheer at the stern; the mizzen stands on it.
    expect(hull.boundingBox!.max.y).toBeGreaterThan(deckAt(-L / 2) + CASTLE);
    const mizzen = b.root.getObjectByName('MizzenPivot')!;
    expect(mizzen.position.z).toBe(-3.8);
    expect(mizzen.position.y).toBeCloseTo(deckAt(-3.8) + INDIAMAN_MIZZEN.foot);
    // Its boom finishes inside the stern.
    const spar = mesh(b, 'MizzenBoomAndGaff').geometry;
    spar.computeBoundingBox();
    expect(mizzen.position.z + spar.boundingBox!.min.z).toBeGreaterThan(-L / 2);
    expect(b.root.getObjectByName('Mainsail')).toBeUndefined();
    // Bigger than the fluyt in every direction.
    expect(b.wakeHull.length).toBeGreaterThan(fluyt.wakeHull.length);
    expect(b.wakeHull.beam).toBeGreaterThan(fluyt.wakeHull.beam);
    const clipper = shipModel('clipper');
    expect(b.wakeHull.beam).toBeGreaterThan(clipper.wakeHull.beam * 1.4);
    clipper.dispose();
    fluyt.dispose();
    b.dispose();
  });

  it('paints a row of gun ports flush on both topsides', () => {
    const b = shipModel('indiaman');
    const hull = mesh(b, 'IndiamanHull').geometry;
    const p = hull.getAttribute('position');
    const c = hull.getAttribute('color');
    const port = new THREE.Color('#1d130b');
    const found = new Map<string, number>();
    for (let i = 0; i < p.count; i++) {
      if (
        Math.abs(c.getX(i) - port.r) + Math.abs(c.getY(i) - port.g) + Math.abs(c.getZ(i) - port.b) >
        1e-5
      )
        continue;
      const z = INDIAMAN_PORTS.reduce((a, q) =>
        Math.abs(q - p.getZ(i)) < Math.abs(a - p.getZ(i)) ? q : a,
      );
      expect(Math.abs(p.getZ(i) - z)).toBeLessThan(0.2);
      // On the upper strake, below the deck edge.
      expect(p.getY(i)).toBeLessThan(deckAt(z));
      expect(p.getY(i)).toBeGreaterThan(deckAt(z) - 0.72);
      const key = `${z}:${Math.sign(p.getX(i))}`;
      found.set(key, (found.get(key) ?? 0) + 1);
    }
    expect(found.size).toBe(INDIAMAN_PORTS.length * 2);
    for (const n of found.values()) expect(n).toBe(6);
    b.dispose();
  });

  it('keeps every upgrade, course head, clew, jib and sheet attached through every pose', () => {
    for (const sails of [1, 2, 3] as const)
      for (const hold of [1, 2, 3] as const)
        for (const hull of [1, 2, 3] as const) {
          const b = shipModel('indiaman', { upgrades: { sails, hold, hull } });
          expect(b.stats.crates + b.stats.barrels).toBe([7, 9, 12][hold - 1]);
          expect(b.stats.barrels > 0).toBe(hold >= 2);
          expect(b.stats.jibs).toBe(sails >= 2 ? 3 : 2);
          expect(b.stats.courses).toBe(sails === 3 ? 6 : 4);
          expect(b.stats.topsail).toBe(sails === 3);
          expect(b.stats.meshes).toBeLessThanOrEqual(12); // Includes one quiet glazing mesh.
          expect(b.stats.triangles).toBeLessThanOrEqual(2167);
          let triangles = 0;
          b.root.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) triangles += triangleCount((o as THREE.Mesh).geometry);
          });
          expect(b.stats.triangles).toBe(triangles);
          const colors = mesh(b, 'IndiamanHull').geometry.getAttribute('color');
          for (const [required, hex] of [
            [hull >= 2, '#8a2f2f'],
            [hull >= 3, BOAT_LOOK.hull.copper],
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
          const point = (k: number) => rope.localToWorld(v().fromBufferAttribute(lines, k));
          const jibs = b.stats.jibs;
          // Jib stays, mizzen shrouds, 2 × (4 shrouds + 1 stay) on the square masts.
          const running = (jibs + 2 + 2 * 5) * 2;
          for (const sail of [0, 0.35, 1])
            for (const boomAngle of BOOMS)
              for (const luff of [0, 1])
                for (const heel of [-0.3, 0.3]) {
                  b.update({ ...POSE, sail, boomAngle, heel, luff, time: 0.06 });
                  b.root.updateWorldMatrix(true, true);
                  let sheet = running + 4 + jibs * 2; // after the mizzen's lift/sheet and jib sheets
                  for (const sq of squares) {
                    const sails = mesh(b, `${sq.name}Courses`);
                    const yards = mesh(b, `${sq.name}Yards`).geometry;
                    const p = sails.geometry.getAttribute('position');
                    const brace = sails.parent!;
                    expect(brace.position.z).toBeCloseTo(sq.z + 0.14);
                    expect(brace.rotation.y).toBeCloseTo(braceFor(boomAngle));
                    // The leeward yard-arm (the boom's side) is braced aft, never forward.
                    const lee = boomAngle < 0 ? 1 : -1; // ship-local +x is port
                    const arm0 = brace.position.clone().add(
                      v()
                        .set(lee, 0, 0)
                        .applyAxisAngle(v().set(0, 1, 0), brace.rotation.y),
                    );
                    if (Math.abs(boomAngle) > 0.01)
                      expect(arm0.z).toBeLessThanOrEqual(brace.position.z + 1e-9);
                    yards.computeBoundingBox();
                    const arm = Math.max(yards.boundingBox!.max.x, -yards.boundingBox!.min.x);
                    const courseCount = b.stats.courses / 2;
                    const perCourse = p.count / courseCount;
                    // Every head vertex stays on its course's yard, inside the yard-arms, at any furl.
                    for (let k = 0; k < courseCount; k++) {
                      let top = -Infinity;
                      for (let i = k * perCourse; i < (k + 1) * perCourse; i++)
                        top = Math.max(top, p.getY(i));
                      let headVertices = 0;
                      for (let i = k * perCourse; i < (k + 1) * perCourse; i++) {
                        if (Math.abs(p.getY(i) - top) > 1e-6) continue;
                        headVertices++;
                        const inBrace = brace.worldToLocal(drawn(sails, i));
                        expect(inBrace.y).toBeCloseTo(top, 5);
                        expect(inBrace.z).toBeCloseTo(0, 5);
                        expect(Math.abs(inBrace.x)).toBeLessThanOrEqual(arm);
                      }
                      expect(headVertices).toBeGreaterThan(5);
                    }
                    // Each course's two clews (lowest corners) follow their sheets.
                    for (let k = 0; k < courseCount; k++) {
                      let lo = Infinity;
                      for (let i = k * perCourse; i < (k + 1) * perCourse; i++)
                        lo = Math.min(lo, p.getY(i));
                      for (const side of [-1, 1]) {
                        let corner = -1;
                        for (let i = k * perCourse; i < (k + 1) * perCourse; i++)
                          if (Math.abs(p.getY(i) - lo) < 1e-6 && Math.sign(p.getX(i)) === side)
                            if (corner < 0 || Math.abs(p.getX(i)) > Math.abs(p.getX(corner)))
                              corner = i;
                        near(drawn(sails, corner), point(sheet + 1));
                        sheet += 2;
                      }
                    }
                  }
                  // Jibs: luff on its own stay from the fore masthead, and clear of the fore courses.
                  const foreSails = mesh(b, 'ForeCourses');
                  const fp = foreSails.geometry.getAttribute('position');
                  let footY = Infinity;
                  let headY = -Infinity;
                  let halfW = 0;
                  for (let i = 0; i < fp.count; i++) {
                    footY = Math.min(footY, fp.getY(i));
                    headY = Math.max(headY, fp.getY(i));
                    halfW = Math.max(halfW, Math.abs(fp.getX(i)));
                  }
                  for (let j = 0; j < jibs; j++) {
                    const m = mesh(b, `Jib${j + 1}`);
                    const p = m.geometry.getAttribute('position');
                    const top = v().fromBufferAttribute(lines, j * 2 + 1);
                    expect(top.z).toBeCloseTo(3.8);
                    expect(top.y).toBeLessThan(deckAt(3.8) + 9.6 * STYLE_D.mastK);
                    // Above every yard: no course hangs where the stay meets the mast.
                    expect(top.y).toBeGreaterThan(headY);
                    for (let i = 0; i < p.count; i++) {
                      const q = foreSails.parent!.worldToLocal(
                        m.localToWorld(v().fromBufferAttribute(p, i)),
                      );
                      if (q.y < footY || q.y > headY || Math.abs(q.x) > halfW) continue;
                      expect(q.z).toBeGreaterThan(0.3 + 0.02); // forward of the fullest belly
                    }
                    // The jib's head is on its stay, between the bowsprit and the masthead.
                    let hi = 0;
                    for (let i = 0; i < p.count; i++) if (p.getY(i) > p.getY(hi)) hi = i;
                    const tack = point(j * 2);
                    const stay = new THREE.Line3(tack, rope.localToWorld(top.clone()));
                    const jibHead = m.localToWorld(v().fromBufferAttribute(p, hi));
                    near(stay.closestPointToPoint(jibHead, true, v()), jibHead);
                    let count = 0;
                    for (let i = 0; i < p.count; i++) {
                      if (Math.abs(p.getX(i)) > 1e-6 || Math.abs(p.getZ(i)) > 1e-6) continue;
                      count++;
                      const q = v().fromBufferAttribute(p, i);
                      near(m.localToWorld(q.clone()), m.parent!.localToWorld(q));
                    }
                    expect(count).toBeGreaterThan(6);
                    near(m.localToWorld(v()), point(j * 2));
                    near(
                      m.localToWorld(v().fromBufferAttribute(p, 31)),
                      point(running + 4 + j * 2 + 1),
                    );
                  }
                  // Mizzen gaff: luff on its mast, clew on its sheet.
                  const mz = mesh(b, 'Mizzen');
                  const mp = mz.geometry.getAttribute('position');
                  near(mz.localToWorld(v().fromBufferAttribute(mp, 31)), point(running + 3));
                }
          b.dispose();
        }
  }, 60_000);

  it('furls each course up to its own yard and keeps furled canvas visible', () => {
    const b = shipModel('indiaman', { upgrades: { sails: 3, hold: 1, hull: 1 } });
    b.update({ ...POSE, sail: 0 });
    const m = mesh(b, 'MainCourses');
    expect(m.morphTargetInfluences![0]).toBe(1);
    expect(m.visible).toBe(true);
    b.update({ ...POSE, sail: 1 });
    expect(m.morphTargetInfluences![0]).toBe(0);
    b.dispose();
  });

  it('keeps sails and upgrades on all quality levels and skips hidden rope updates', () => {
    const b = shipModel('indiaman', { upgrades: { sails: 3, hold: 3, hull: 3 } });
    const rope = b.root.getObjectByName('Rigging') as THREE.LineSegments;
    const p = rope.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (const quality of [...Object.keys(QUALITY), 'low', 'high']) {
      b.setLowDetail(quality === 'low');
      const version = p.version;
      b.update({ ...POSE, sail: 0.35, boomAngle: -0.6 });
      expect(rope.visible).toBe(quality !== 'low');
      expect(p.version > version).toBe(quality !== 'low');
      expect(mesh(b, 'ForeCourses').visible).toBe(true);
    }
    b.dispose();
  });
});
