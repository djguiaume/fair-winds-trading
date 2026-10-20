import * as THREE from 'three';
import { RefinedSloop } from './sloop';
import { BOAT_SCALE, STYLE_D } from './boatStyle';
export { BOAT_SCALE, STYLE_D } from './boatStyle';
import { createRng } from '../../sim/rng';
import { keepGroup, mergeAll, paint, paintGroups, vertexColorMaterial } from './geometry';
import {
  type BoatModel,
  type BoatModelFactory,
  type BoatPose,
  type ShipUpgrades,
  STOCK_UPGRADES,
} from './types';

interface MastDef {
  /** Position along the hull in reference units, + toward the bow. */
  z: number;
  h: number;
  /** Carries a topsail at sails level 3. */
  top?: boolean;
  /** Square rig: `n` courses on yards (one fewer below sails level 3). Default fore-and-aft. */
  square?: number;
}

export interface BoatClassDef {
  /** Length, beam and hull depth in reference units (before STYLE_D and SCALE). */
  L: number;
  B: number;
  H: number;
  masts: MastDef[];
  /** Headsails at stock; sails level 2 adds one. */
  jibs: number;
  hull: string;
  /** Class colour: painted band, flag and racing-sail stripe. */
  band: string;
  /** Class index: bigger ships carry more cargo. */
  ci: number;
  /** Raised stern deck with lit windows, 1 or 2 high (big square riggers). */
  castle?: number;
}

/**
 * Every class the player can sail (decision 0035): the swift line keeps slim hulls and tall
 * fore-and-aft rigs in cool colours, the hauler line deep broad hulls, square sails and warm
 * colours. Proportions follow the reference sheets (docs/art/src/lib.js `CLASSES`).
 */
export const BOAT_CLASSES: Record<string, BoatClassDef> = {
  sloop: {
    L: 5.0,
    B: 1.9,
    H: 0.9,
    masts: [{ z: 0.5, h: 5.2, top: true }],
    jibs: 1,
    hull: '#9a5a2a',
    band: '#2f6f9f',
    ci: 0,
  },
  cutter: {
    L: 6.2,
    B: 2.1,
    H: 1.0,
    masts: [{ z: 0.2, h: 6.4, top: true }],
    jibs: 2,
    hull: '#8a4f24',
    band: '#c0533a',
    ci: 1,
  },
  schooner: {
    L: 8.2,
    B: 2.3,
    H: 1.1,
    masts: [
      { z: 1.6, h: 6.4 },
      { z: -1.4, h: 7.4, top: true },
    ],
    jibs: 2,
    hull: '#7d4a22',
    band: '#2f8f7a',
    ci: 2,
  },
  clipper: {
    L: 9.8,
    B: 2.4,
    H: 1.15,
    masts: [
      { z: 2.8, h: 7.6 },
      { z: 0.2, h: 8.8, top: true },
      { z: -2.6, h: 7.8, top: true },
    ],
    jibs: 3,
    hull: '#3b3d48',
    band: '#d8b04a',
    ci: 2,
  },
  hoy: {
    L: 6.2,
    B: 2.7,
    H: 1.3,
    masts: [{ z: 0.6, h: 5.6, top: true }],
    jibs: 1,
    hull: '#8f6a3a',
    band: '#c9a23a',
    ci: 3,
  },
  fluyt: {
    L: 11.5,
    B: 3.5,
    H: 1.8,
    masts: [
      { z: 3.2, h: 8.6, square: 3 },
      { z: 0, h: 9.6, square: 3 },
      { z: -3.3, h: 6.8 },
    ],
    jibs: 1,
    hull: '#6e4520',
    band: '#b5652a',
    ci: 4,
    castle: 2,
  },
  indiaman: {
    L: 13,
    B: 3.8,
    H: 2,
    masts: [
      { z: 3.8, h: 9.6, square: 3 },
      { z: 0.4, h: 10.8, square: 3 },
      { z: -3.8, h: 7.6 },
    ],
    jibs: 2,
    hull: '#5c3a1c',
    band: '#8a2f2f',
    ci: 5,
    castle: 2,
  },
};

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Hull outline extruded down from y = 0 and tapered toward the keel, with a curved sheer. */
function hullGeo(L: number, B: number, H: number, sheer: number, bx = 0.5, bz = 0.82) {
  const s = new THREE.Shape();
  s.moveTo(0, L / 2);
  s.quadraticCurveTo(B * 0.55, L * 0.22, B / 2, -L * 0.08);
  s.lineTo(B * 0.38, -L / 2);
  s.lineTo(-B * 0.38, -L / 2);
  s.lineTo(-B / 2, -L * 0.08);
  s.quadraticCurveTo(-B * 0.55, L * 0.22, 0, L / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: false, curveSegments: 5 });
  g.rotateX(Math.PI / 2); // shape y → +Z (bow), extrusion goes down to y = -H
  const p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const z = p.getZ(i);
    const t = -y / H; // 0 at deck, 1 at keel
    const sh = sheer * (z / (L / 2)) ** 2 * (1 - t * 0.6);
    p.setX(i, p.getX(i) * (1 - t * (1 - bx)));
    p.setZ(i, z * (1 - t * (1 - bz)));
    p.setY(i, y + sh);
  }
  return g;
}

type CellColor = (i: number, j: number) => THREE.Color;

/**
 * Bilinear sail patch, bellied along `dir`, as flat-shaded triangles with a colour per cell
 * (patches and stripes without a texture). Corners: a foot fwd, b foot aft, c head fwd, d head aft.
 */
function sailGeo(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  belly: number,
  dir: THREE.Vector3,
  color: CellColor,
  nu = 6,
  nv = 6,
) {
  const at = (u: number, v: number) =>
    new THREE.Vector3()
      .addScaledVector(a, (1 - u) * (1 - v))
      .addScaledVector(b, u * (1 - v))
      .addScaledVector(c, (1 - u) * v)
      .addScaledVector(d, u * v)
      .addScaledVector(
        dir,
        belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1 + 0.05)),
      );
  const pos: number[] = [];
  const col: number[] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const p00 = at(i / nu, j / nv);
      const p10 = at((i + 1) / nu, j / nv);
      const p01 = at(i / nu, (j + 1) / nv);
      const p11 = at((i + 1) / nu, (j + 1) / nv);
      for (const p of [p00, p10, p01, p10, p11, p01]) pos.push(p.x, p.y, p.z);
      const k = color(i, j);
      for (let n = 0; n < 6; n++) col.push(k.r, k.g, k.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Sail cloth per upgrade level: patched canvas, new canvas, racing sails with a class stripe. */
function sailColors(level: number, band: string): CellColor {
  const base = new THREE.Color(level === 1 ? STYLE_D.patchedSail : STYLE_D.sail);
  const stripe = new THREE.Color(band);
  const patches = STYLE_D.patches.map((p) => new THREE.Color(p));
  return (i, j) => {
    if (level === 1 && (i * 7 + j * 3) % 8 === 1) return patches[(i + j) % 2]!;
    if (level === 3 && (j === 2 || j === 3)) return stripe;
    return base;
  };
}

/**
 * A storybook sloop or cutter. Hull, deck, band, copper, cargo, masts and bowsprit are one merged
 * mesh; each mast's boom and sails swing on a pivot, the jibs turn around the forestay, and the
 * flag shows the wind. Parts are built in the reference frame (bow +Z) inside `ship`, which is
 * turned around so the bow faces -Z as BoatModel requires.
 */
export class StorybookBoat implements BoatModel {
  readonly root = new THREE.Group();
  /** Object counts for tests and the model sheet. */
  readonly stats = { triangles: 0, meshes: 0, crates: 0, barrels: 0, jibs: 0, topsail: false };
  private readonly body = new THREE.Group();
  private readonly ship = new THREE.Group();
  private readonly booms: THREE.Group[] = [];
  private readonly mainsails: THREE.Mesh[] = [];
  /** Square rig: each mast's yards turn together; each course furls up to its yard. */
  private readonly yards: THREE.Group[] = [];
  private readonly courses: THREE.Mesh[] = [];
  private readonly jibPivot = new THREE.Group();
  private readonly jibs: THREE.Mesh;
  private readonly flag: THREE.Mesh;
  private readonly rigging: THREE.LineSegments;
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  constructor(cls: BoatClassDef, upg: ShipUpgrades = STOCK_UPGRADES, rigging = true) {
    const st = STYLE_D;
    const rng = createRng(cls.ci * 31 + upg.hold * 7 + 1);
    const L = cls.L * st.L;
    const B = cls.B * st.B;
    const H = cls.H * st.H;
    const sheer = st.sheer * (L / 5) ** 0.5;
    const deckY = H * 0.55;
    const deckAt = (z: number) => deckY + sheer * (z / (L / 2)) ** 2;
    const parts: THREE.BufferGeometry[] = [];

    // Hull with its deck, then the painted band (hull 2+) and copper sheathing (hull 3).
    parts.push(paintGroups(hullGeo(L, B, H, sheer).translate(0, deckY, 0), [st.deck, cls.hull]));
    if (upg.hull >= 2) {
      const band = keepGroup(hullGeo(L * 1.015, B * 1.03, H * 0.28, sheer, 0.97, 0.985), 1);
      parts.push(paint(band.translate(0, deckY + 0.02, 0), cls.band));
    }
    if (upg.hull >= 3) {
      const cu = keepGroup(hullGeo(L * 0.93, B * 0.82, H * 0.35, sheer * 0.4, 0.7, 0.9), 1);
      parts.push(paint(cu.translate(0, deckY - H * 0.42, 0), st.copper));
    }

    // Raised stern deck with lit windows on the big square riggers (reference `castle`).
    let castleFront = -L / 2;
    if (cls.castle) {
      const ch = 0.4 * cls.castle * st.H;
      const cw = B * 0.78;
      const cl = L * (0.22 + 0.05 * cls.castle);
      const y = deckY + sheer * 0.7;
      castleFront = -L / 2 + cl;
      parts.push(
        paint(
          new THREE.BoxGeometry(cw, ch, cl).translate(0, y + ch / 2, castleFront - cl / 2 + 0.05),
          cls.hull,
        ),
      );
      parts.push(
        paint(
          new THREE.BoxGeometry(cw * 0.84, 0.06, cl * 0.9).translate(
            0,
            y + ch,
            castleFront - cl / 2 + 0.1,
          ),
          st.deck,
        ),
      );
      if (upg.hull >= 2)
        parts.push(
          paint(
            new THREE.BoxGeometry(cw * 1.02, ch * 0.25, 0.08).translate(
              0,
              y + ch * 0.7,
              -L / 2 + 0.03,
            ),
            cls.band,
          ),
        );
      for (let i = -1; i <= 1; i++)
        parts.push(
          paint(
            new THREE.BoxGeometry(0.28, 0.22, 0.05).translate(
              i * cw * 0.25,
              y + ch * 0.45,
              -L / 2 + 0.03,
            ),
            STYLE_D.lamp,
          ),
        );
    }

    // Cargo on deck grows with the hold, stowed forward of any stern castle.
    const crates = [2, 4, 7][upg.hold - 1]! + cls.ci;
    const s = 0.42 * Math.min(1.6, st.H);
    const firstZ = -L * 0.08 + (cls.masts.length > 1 ? L * 0.05 : 0);
    const room = cls.castle ? firstZ - castleFront - s * 0.5 : L * 0.42;
    const maxCol = Math.max(1, Math.floor(room / (s * 1.08)));
    const per = maxCol * 2;
    for (let i = 0; i < crates; i++) {
      const layer = Math.floor(i / per);
      const row = i % 2;
      const colIdx = Math.floor((i % per) / 2);
      const isBarrel = upg.hold >= 2 && i % 3 === 2;
      const z = firstZ - colIdx * s * 1.08;
      const geo = isBarrel
        ? new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 0.8, 7)
        : new THREE.BoxGeometry(s, s * 0.85, s);
      geo.rotateY((rng() - 0.5) * 0.3);
      geo.translate((row - 0.5) * s * 1.1, deckAt(z) + s * 0.42 + layer * s * 0.85, z);
      parts.push(paint(geo, isBarrel ? st.barrel : st.crate));
      if (isBarrel) this.stats.barrels++;
      else this.stats.crates++;
    }

    const woodMat = vertexColorMaterial();
    const sailMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      flatShading: true,
      emissive: '#ffffff',
      emissiveIntensity: 0.22,
    });
    this.disposables.push(woodMat, sailMat);
    const cloth = sailColors(upg.sails, cls.band);
    const extraTop = upg.sails >= 3;
    // Bellies point to reference -X, which the half turn of `ship` makes starboard (+X); update()
    // mirrors them with scale.x so they always fill to leeward.
    const belly = V(-1, 0, 0);
    const bel = st.belly * (B / 2);
    let foremost: { y: number; z: number; top: number } | null = null;

    for (const m of cls.masts) {
      const mz = m.z * st.L;
      const mh = m.h * st.mastK;
      const base = deckAt(mz);
      parts.push(
        paint(
          new THREE.CylinderGeometry(0.07 * st.B, 0.11 * st.B, mh, 6).translate(
            0,
            base + mh / 2,
            mz,
          ),
          st.mast,
        ),
      );
      foremost ??= { y: base + mh * 0.82, z: mz, top: base + mh + 0.1 };
      if (m.square) {
        this.addSquareRig(m.square, extraTop, base, mh, mz, B, cloth, woodMat, sailMat);
        continue;
      }
      // Boom and sails pivot on the mast at the foot of the sail, so reefing scales from there.
      const foot = base + 0.7;
      const head = base + mh * 0.8 - foot;
      const aft = Math.min(L * 0.55, mh * 0.62);
      const pivot = new THREE.Group();
      pivot.position.set(0, foot, mz);
      const boomGeo = paint(
        new THREE.CylinderGeometry(0.05, 0.05, aft, 5)
          .rotateX(Math.PI / 2)
          .translate(0, -0.05, -aft / 2),
        st.mast,
      );
      this.disposables.push(boomGeo);
      pivot.add(new THREE.Mesh(boomGeo, woodMat));

      const sailParts = [
        sailGeo(
          V(0, 0, 0),
          V(0, 0, -aft),
          V(0, head, 0),
          V(0, head - mh * 0.12, -aft * 0.8),
          bel,
          belly,
          cloth,
        ),
      ];
      if (m.top && extraTop) {
        const top = mh - 0.7;
        sailParts.push(
          sailGeo(
            V(0, head + 0.1, 0),
            V(0, head + 0.1, -aft * 0.5),
            V(0, top - 0.1, 0),
            V(0, top - 0.15, -0.05),
            bel * 0.5,
            belly,
            cloth,
            4,
            3,
          ),
        );
        this.stats.topsail = true;
      }
      const sailGeoMerged = mergeAll(sailParts);
      this.disposables.push(sailGeoMerged);
      const sail = new THREE.Mesh(sailGeoMerged, sailMat);
      sail.castShadow = true;
      pivot.add(sail);
      this.mainsails.push(sail);
      this.booms.push(pivot);
      this.ship.add(pivot);
    }
    const fore = foremost!;

    // Flag at the head of the first mast, in the class colour.
    const flagGeo = new THREE.BufferGeometry().setFromPoints([
      V(0, 0, 0),
      V(0, -0.5, 0),
      V(0, -0.25, -1),
    ]);
    flagGeo.computeVertexNormals();
    const flagMat = new THREE.MeshBasicMaterial({ color: cls.band, side: THREE.DoubleSide });
    this.disposables.push(flagGeo, flagMat);
    this.flag = new THREE.Mesh(flagGeo, flagMat);
    this.flag.scale.setScalar(st.flag);
    this.flag.position.set(0, fore.top, fore.z);
    this.ship.add(this.flag);

    // Bowsprit, then the jibs from it to the mast; they turn together around the forestay.
    const bowY = deckY + sheer;
    const bowZ = L / 2;
    parts.push(
      paint(
        new THREE.CylinderGeometry(0.05, 0.07, L * 0.25, 5)
          .rotateX(Math.PI / 2 - 0.25)
          .translate(0, bowY + 0.15, bowZ + L * 0.1),
        st.mast,
      ),
    );
    const nj = Math.min(3, cls.jibs + (upg.sails >= 2 ? 1 : 0));
    this.stats.jibs = nj;
    const tack = V(0, bowY + 0.2, bowZ + L * 0.04);
    const stay = V(0, fore.y, fore.z + 0.15)
      .sub(tack)
      .normalize();
    this.jibPivot.position.copy(tack);
    this.jibPivot.quaternion.setFromUnitVectors(V(0, 1, 0), stay);
    const toStay = new THREE.Matrix4()
      .makeRotationFromQuaternion(this.jibPivot.quaternion.clone().invert())
      .multiply(new THREE.Matrix4().makeTranslation(-tack.x, -tack.y, -tack.z));
    const jibParts: THREE.BufferGeometry[] = [];
    for (let j = 0; j < nj; j++) {
      const tipZ = bowZ + L * (0.04 + j * 0.08);
      const tipY = bowY + 0.2 + j * 0.03;
      const hy = fore.y - j * 0.5;
      const headPt = V(0, hy, fore.z + 0.15);
      const clew = V(0, deckY + sheer * 0.55 + 0.6, tipZ - (tipZ - fore.z) * 0.55);
      const g = sailGeo(
        V(0, tipY, tipZ),
        clew,
        headPt,
        headPt,
        st.belly * B * 0.3,
        belly,
        cloth,
        4,
        4,
      );
      jibParts.push(g.applyMatrix4(toStay));
    }
    const jibGeo = mergeAll(jibParts);
    this.disposables.push(jibGeo);
    this.jibs = new THREE.Mesh(jibGeo, sailMat);
    this.jibs.castShadow = true;
    const jibTurn = new THREE.Group();
    jibTurn.add(this.jibs);
    this.jibPivot.add(jibTurn);
    this.ship.add(this.jibPivot);

    // Light rigging lines: shrouds to both sides of each mast, and the forestay.
    const pts: number[] = [];
    for (const m of cls.masts) {
      const mz = m.z * st.L;
      const top = deckAt(mz) + m.h;
      for (const sx of [-1, 1]) {
        for (const dz of [-0.4, 0, 0.4])
          pts.push(0, top * 0.92, mz, sx * B * 0.5, deckY + 0.1, mz + dz);
      }
    }
    pts.push(0, fore.y + 0.7, fore.z, 0, bowY + 0.3, bowZ + L * 0.2);
    const rigGeo = new THREE.BufferGeometry();
    rigGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const rigMat = new THREE.LineBasicMaterial({
      color: st.rigging,
      transparent: true,
      opacity: 0.7,
    });
    this.disposables.push(rigGeo, rigMat);
    this.rigging = new THREE.LineSegments(rigGeo, rigMat);
    this.rigging.visible = rigging;
    this.ship.add(this.rigging);

    const hullGeoMerged = mergeAll(parts);
    this.disposables.push(hullGeoMerged);
    const hull = new THREE.Mesh(hullGeoMerged, woodMat);
    hull.castShadow = true;
    this.ship.add(hull);

    this.ship.rotation.y = Math.PI;
    this.body.add(this.ship);
    this.body.scale.setScalar(BOAT_SCALE);
    this.root.add(this.body);

    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        this.stats.meshes++;
        const g = (o as THREE.Mesh).geometry;
        this.stats.triangles += g.attributes.position!.count / 3;
      }
    });
  }

  /**
   * Square courses on yards (reference `rig: 'sq'`): `n` sails stacked up the mast, narrowing
   * aloft, bellied toward the bow. Each hangs from its yard so reefing furls it upward.
   */
  private addSquareRig(
    n: number,
    extraTop: boolean,
    base: number,
    mh: number,
    mz: number,
    B: number,
    cloth: CellColor,
    woodMat: THREE.Material,
    sailMat: THREE.Material,
  ) {
    const turn = new THREE.Group();
    turn.position.set(0, 0, mz);
    const span = (mh - 1) / n;
    const count = Math.max(2, n - (extraTop ? 0 : 1));
    for (let k = 0; k < count; k++) {
      const y0 = base + 1 + k * span;
      const y1 = y0 + span * 0.92;
      // Wider than the reference sheet (1.05 beams) so square rigs read from the game camera.
      const w = B * 1.4 * (1 - k * 0.14);
      const course = new THREE.Group();
      course.position.y = y1;
      const yardGeo = paint(
        new THREE.CylinderGeometry(0.05, 0.05, w * 1.1, 5).rotateZ(Math.PI / 2),
        STYLE_D.mast,
      );
      const sailGeoK = sailGeo(
        V(-w / 2, y0 - y1, 0),
        V(w / 2, y0 - y1, 0),
        V((-w / 2) * 0.9, 0, 0),
        V((w / 2) * 0.9, 0, 0),
        STYLE_D.belly * 0.6 + 0.12,
        V(0, 0, 1),
        cloth,
        5,
        4,
      );
      this.disposables.push(yardGeo, sailGeoK);
      course.add(new THREE.Mesh(yardGeo, woodMat));
      const sail = new THREE.Mesh(sailGeoK, sailMat);
      sail.castShadow = true;
      course.add(sail);
      this.courses.push(sail);
      turn.add(course);
    }
    if (extraTop) this.stats.topsail = true;
    this.yards.push(turn);
    this.ship.add(turn);
  }

  update(p: BoatPose): void {
    this.body.rotation.z = p.heel;
    const side = p.boomAngle < 0 ? -1 : 1;
    const flutter = p.luff * Math.sin(p.time * 26) * 0.6;
    const fill = side * Math.max(0.08, 1 - p.luff) + flutter;
    const reef = 0.06 + 0.94 * p.sail;
    for (const boom of this.booms) boom.rotation.y = p.boomAngle;
    for (const sail of this.mainsails) {
      sail.scale.set(fill, reef, 1);
      sail.visible = p.sail > 0.02;
    }
    // Yards brace round less than a boom swings; square sails always fill toward the bow.
    for (const yard of this.yards) yard.rotation.y = p.boomAngle * 0.6;
    const square = Math.max(0.08, 1 - p.luff) + flutter * 0.5;
    for (const course of this.courses) {
      course.scale.set(1, reef, square);
      course.visible = p.sail > 0.02;
    }
    const jibTurn = this.jibs.parent!;
    jibTurn.rotation.y = p.boomAngle * 0.6;
    this.jibs.scale.set(fill, Math.max(0.05, p.sail), 1);
    this.jibs.visible = p.sail > 0.05;
    // The flag points to reference -Z (aft); with `ship` turned half way round that is +Z on the
    // body, so π - windRelative streams it downwind (pointing forward when windRelative = 0).
    this.flag.rotation.y = Math.PI - p.windRelative + Math.sin(p.time * 9) * 0.12;
  }

  setLowDetail(low: boolean): void {
    this.rigging.visible = !low;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}

export const createStorybookBoat: BoatModelFactory = (shipClassId, options = {}) =>
  shipClassId === 'sloop' || !BOAT_CLASSES[shipClassId]
    ? new RefinedSloop(options)
    : new StorybookBoat(
        BOAT_CLASSES[shipClassId] ?? BOAT_CLASSES.sloop!,
        options.upgrades ?? STOCK_UPGRADES,
        options.rigging ?? true,
      );
