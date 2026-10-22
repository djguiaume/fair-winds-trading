import * as THREE from 'three';
import { BOAT_SCALE, STYLE_D as ST } from './boatStyle';
import { mergeAll, paint, triangleCount, vertexColorMaterial } from './geometry';
import { STOCK_UPGRADES, type BoatModel, type BoatModelOptions, type BoatPose } from './types';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** Normalized hull sections, authored independently of rig dimensions and palette. */
export interface HullShape {
  outline: ReadonlyArray<readonly [number, number]>;
  rings: ReadonlyArray<{ t: number; beam: number; length: number }>;
}

/** Rounded starter hull. Other classes supply their own silhouette and sections. */
const SLOOP_HULL: HullShape = {
  outline: [
    [0, 0.5],
    [0.23, 0.4],
    [0.4, 0.23],
    [0.5, 0],
    [0.48, -0.25],
    [0.34, -0.44],
    [0.16, -0.5],
    [-0.16, -0.5],
    [-0.34, -0.44],
    [-0.48, -0.25],
    [-0.5, 0],
    [-0.4, 0.23],
    [-0.23, 0.4],
  ],
  rings: [
    { t: 0, beam: 1, length: 1 },
    { t: 0.25, beam: 1.01, length: 0.99 },
    { t: 0.65, beam: 0.8, length: 0.93 },
    { t: 1, beam: 0.18, length: 0.78 },
  ],
};

/** Dimensions and hull sections are authored per class. */
export interface RefinedRig {
  name: string;
  length: number;
  beam: number;
  depth: number;
  hullShape?: HullShape;
  mastZ: number;
  mastHeight: number;
  band: string;
  hull: string;
  stockJibs: number;
  cargoExtra: number;
  boom: number;
  gaff: number;
  /** Optional shorter forward mast; only the aft main carries the upgraded topsail. */
  foremast?: { z: number; height: number; boom: number; gaff: number };
  /** Third fore-and-aft mast for the swift-line clipper, with its own upgraded topsail. */
  mizzen?: { z: number; height: number; boom: number; gaff: number };
  hatchZ?: number;
  cargoZ?: number;
  cargoX?: number;
  maxJibs?: number;
}

/** Simple coloured triangles: no textures, extra materials or per-frame geometry rebuilds. */
class Faces {
  private pos: number[] = [];
  private colors: number[] = [];
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: string) {
    const k = new THREE.Color(color);
    for (const p of [a, b, c]) {
      this.pos.push(p.x, p.y, p.z);
      this.colors.push(k.r, k.g, k.b);
    }
  }
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: string) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.computeVertexNormals();
    return g;
  }
}

/** Class-specific deck outline and depth sections, with shared gunwale construction. */
function hullGeometry(level: number, rig: RefinedRig) {
  const { length: L, band: BAND, hull: HULL } = rig;
  const B = rig.beam * ST.B;
  const H = rig.depth * ST.H;
  const DECK = H * 0.55;
  const deckAt = (z: number) => DECK + ST.sheer * (L / 5) ** 0.5 * (z / (L / 2)) ** 2;
  const shape = rig.hullShape ?? SLOOP_HULL;
  const outline = shape.outline.map(([x, z]) => V(x * B, deckAt(z * L), z * L));
  const rings = shape.rings.map(({ t, beam, length }) =>
    outline.map((p) => V(p.x * beam, deckAt(p.z * length) - H * t, p.z * length)),
  );
  const f = new Faces();
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    f.tri(V(0, DECK, 0), outline[i]!, outline[j]!, ST.deck);
    for (let r = 0; r < rings.length - 1; r++) {
      const color = r === 0 && level >= 2 ? BAND : r === 2 && level >= 3 ? ST.copper : HULL;
      f.quad(rings[r]![i]!, rings[r + 1]![i]!, rings[r + 1]![j]!, rings[r]![j]!, color);
    }
    f.tri(V(0, DECK - H, 0), rings[3]![j]!, rings[3]![i]!, HULL);
    // A solid raised gunwale: outer face, cap and inner face follow the same sheer as the deck.
    const a = outline[i]!;
    const b = outline[j]!;
    const ai = V(a.x * 0.93, a.y, a.z * 0.98);
    const bi = V(b.x * 0.93, b.y, b.z * 0.98);
    const at = a.clone().add(V(0, 0.16, 0));
    const bt = b.clone().add(V(0, 0.16, 0));
    const ait = ai.clone().add(V(0, 0.16, 0));
    const bit = bi.clone().add(V(0, 0.16, 0));
    f.quad(a, b, bt, at, HULL);
    f.quad(at, bt, bit, ait, ST.deck);
    f.quad(ai, ait, bit, bi, HULL);
  }
  return f.geometry();
}

/** A spar between two actual attachment points. */
function spar(a: THREE.Vector3, b: THREE.Vector3, radius = 0.045) {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(radius, radius, d.length(), 5);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return paint(g, ST.mast);
}

/** Cloth edges have zero belly, so tack, luff, head and spar attachments cannot drift. */
function cloth(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  level: number,
  belly: number,
  band: string,
) {
  const f = new Faces();
  const n = 6;
  const at = (u: number, v: number) =>
    V(
      -belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * v),
      (a.y * (1 - u) + b.y * u) * (1 - v) + (c.y * (1 - u) + d.y * u) * v,
      (a.z * (1 - u) + b.z * u) * (1 - v) + (c.z * (1 - u) + d.z * u) * v,
    );
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const color =
        level === 1 && (i * 7 + j * 3) % 8 === 1
          ? ST.patches[(i + j) % 2]!
          : level === 3 && (j === 2 || j === 3)
            ? band
            : level === 1
              ? ST.patchedSail
              : (i + j) % 3 === 0
                ? '#eee6d4'
                : ST.sail;
      f.quad(
        at(i / n, j / n),
        at((i + 1) / n, j / n),
        at((i + 1) / n, (j + 1) / n),
        at(i / n, (j + 1) / n),
        color,
      );
    }
  return f.geometry();
}

interface GaffSail {
  pivot: THREE.Group;
  sail: THREE.Mesh;
  peak: THREE.Vector3;
  clew: THREE.Vector3;
  mastTop: THREE.Vector3;
  sheetAnchor: THREE.Vector3;
}

interface Headsail {
  axis: THREE.Group;
  sail: THREE.Mesh;
  clew: THREE.Vector3;
}

/** Shared refined gaff-rig construction. Upgrade semantics and the BoatModel waterline frame stay unchanged. */
export class RefinedBoat implements BoatModel {
  readonly root = new THREE.Group();
  /** Same waterline envelope at every upgrade level, for the hull-attached wake. */
  readonly wakeHull: { length: number; beam: number };
  readonly stats = { triangles: 0, meshes: 0, crates: 0, barrels: 0, jibs: 0, topsail: false };
  private readonly body = new THREE.Group();
  private readonly ship = new THREE.Group();
  private readonly gaffSails: GaffSail[] = [];
  private readonly headsails: Headsail[] = [];
  private readonly flag: THREE.Mesh;
  /** Masthead lantern (decision 0068): high on the mast, where it reads from above. */
  readonly lantern = new THREE.Object3D();
  private readonly rigging: THREE.LineSegments;
  private readonly riggingEnabled: boolean;
  private readonly runningOffset: number;
  private readonly beam: number;
  private readonly tmp = new THREE.Vector3();
  private readonly jibSheetAnchor: THREE.Vector3;
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  constructor(rig: RefinedRig, options: BoatModelOptions = {}) {
    const { length: L, mastZ: MAST_Z, band: BAND } = rig;
    const B = rig.beam * ST.B;
    const H = rig.depth * ST.H;
    const MAST_H = rig.mastHeight * ST.mastK;
    const DECK = H * 0.55;
    const deckAt = (z: number) => DECK + ST.sheer * (L / 5) ** 0.5 * (z / (L / 2)) ** 2;
    this.beam = B;
    this.wakeHull = { length: L * BOAT_SCALE, beam: B * BOAT_SCALE };
    this.jibSheetAnchor = V(0, deckAt(0) + 0.12, 0);
    const upg = options.upgrades ?? STOCK_UPGRADES;
    this.riggingEnabled = options.rigging ?? true;
    const wood = vertexColorMaterial();
    const canvas = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      flatShading: true,
      emissive: '#ffffff',
      emissiveIntensity: 0.22,
    });
    this.disposables.push(wood, canvas);
    const mesh = (g: THREE.BufferGeometry, material: THREE.Material, name: string) => {
      this.disposables.push(g);
      const m = new THREE.Mesh(g, material);
      m.name = name;
      m.castShadow = true;
      return m;
    };
    const parts = [hullGeometry(upg.hull, rig)];
    const box = (w: number, h: number, l: number, x: number, y: number, z: number, color: string) =>
      paint(new THREE.BoxGeometry(w, h, l).translate(x, y, z), color);
    // Forward hatch leaves a working area behind the mast for the upgraded cargo stacks.
    const hatchZ = rig.hatchZ ?? (rig.foremast ? 2.65 : 1.3);
    parts.push(box(0.64, 0.13, 0.58, 0, deckAt(hatchZ) + 0.09, hatchZ, ST.mast));
    parts.push(box(0.54, 0.05, 0.48, 0, deckAt(hatchZ) + 0.18, hatchZ, ST.deck));
    const stern = -L * 0.5;
    parts.push(box(0.1, 0.72, 0.32, 0, deckAt(stern) - 0.4, stern - 0.1, ST.mast));
    parts.push(spar(V(0, deckAt(stern) - 0.1, stern), V(0, deckAt(stern) + 0.23, stern)));
    parts.push(
      spar(V(0, deckAt(stern) + 0.23, stern), V(0.12, deckAt(stern) + 0.23, stern + 0.65)),
    );
    const cargoCount = [2, 4, 7][upg.hold - 1]! + rig.cargoExtra;
    for (let i = 0; i < cargoCount; i++) {
      const slot = i % 6;
      const x = (slot % 2 === 0 ? -1 : 1) * (rig.cargoX ?? 0.3);
      const z = (rig.cargoZ ?? 0) - Math.floor(slot / 2) * (rig.foremast ? 0.5 : 0.65);
      const layer = Math.floor(i / 6);
      const barrel = upg.hold >= 2 && i % 3 === 2;
      const g = barrel
        ? new THREE.CylinderGeometry(0.21, 0.21, 0.42, 7)
        : new THREE.BoxGeometry(0.46, 0.42, 0.46);
      g.translate(x, deckAt(z) + 0.23 + layer * 0.43, z);
      parts.push(paint(g, barrel ? ST.barrel : ST.crate));
      if (barrel) this.stats.barrels++;
      else this.stats.crates++;
    }
    const mastBase = deckAt(MAST_Z);
    const mastTop = V(0, mastBase + MAST_H, MAST_Z);
    parts.push(spar(V(0, mastBase, MAST_Z), mastTop, 0.075));
    const fore = rig.foremast;
    const foreBase = fore ? deckAt(fore.z) : mastBase;
    const foreHeight = fore ? fore.height * ST.mastK : MAST_H;
    const foreZ = fore?.z ?? MAST_Z;
    if (fore) parts.push(spar(V(0, foreBase, foreZ), V(0, foreBase + foreHeight, foreZ), 0.07));
    const mizzen = rig.mizzen;
    if (mizzen)
      parts.push(
        spar(
          V(0, deckAt(mizzen.z), mizzen.z),
          V(0, deckAt(mizzen.z) + mizzen.height * ST.mastK, mizzen.z),
          0.07,
        ),
      );
    const bow = V(0, deckAt(L / 2) + 0.13, L / 2);
    const bowspritTip = V(0, bow.y + 0.2, L * 0.73);
    parts.push(spar(V(0, bow.y - 0.1, L * 0.35), bowspritTip, 0.05));
    this.ship.add(mesh(mergeAll(parts), wood, `${rig.name}Hull`));

    // Both masts use their own gooseneck, gaff lift and working sheet. Their luffs remain
    // on the corresponding mast, and the shorter foresail clears the taller aft mainmast.
    const addGaff = (
      name: string,
      z: number,
      base: number,
      height: number,
      boom: number,
      gaff: number,
      topsail: boolean,
      anchorZ: number,
    ) => {
      const pivot = new THREE.Group();
      pivot.name = `${name}Pivot`;
      pivot.position.set(0, base + 0.7, z);
      const throat = V(0, height * 0.47, 0);
      const peak = V(0, height * 0.69, -gaff);
      const clew = V(0, 0, -boom);
      pivot.add(
        mesh(
          mergeAll([spar(V(0, 0, 0), clew), spar(throat, peak)]),
          wood,
          name === 'Mainsail'
            ? 'BoomAndGaff'
            : name === 'Mizzen'
              ? 'MizzenBoomAndGaff'
              : 'ForeBoomAndGaff',
        ),
      );
      const sails = [cloth(V(0, 0, 0), clew, throat, peak, upg.sails, 0.32, BAND)];
      if (topsail && upg.sails >= 3) {
        const top = V(0, height - 0.85, 0);
        sails.push(cloth(throat, peak, top, top, upg.sails, 0.13, BAND));
        this.stats.topsail = true;
      }
      const sail = mesh(mergeAll(sails), canvas, name);
      pivot.add(sail);
      this.ship.add(pivot);
      this.gaffSails.push({
        pivot,
        sail,
        peak,
        clew,
        mastTop: V(0, base + height, z),
        sheetAnchor: V(0, deckAt(anchorZ) + 0.12, anchorZ),
      });
    };
    addGaff(
      'Mainsail',
      MAST_Z,
      mastBase,
      MAST_H,
      rig.boom,
      rig.gaff,
      true,
      rig.mizzen ? -2.2 : -L * 0.4,
    );
    if (fore)
      addGaff(
        'Foresail',
        foreZ,
        foreBase,
        foreHeight,
        fore.boom,
        fore.gaff,
        false,
        rig.mizzen ? 0.5 : -0.9,
      );
    if (mizzen)
      addGaff(
        'Mizzen',
        mizzen.z,
        deckAt(mizzen.z),
        mizzen.height * ST.mastK,
        mizzen.boom,
        mizzen.gaff,
        true,
        -L * 0.46,
      );

    // Each upgraded jib has its OWN head/tack pair and inclined stay axis. Do not merge their
    // pivots or scale along the stay: reefing rolls the free edge towards the stay instead.
    const lines: number[] = [];
    const line = (a: THREE.Vector3, b: THREE.Vector3) => lines.push(...a.toArray(), ...b.toArray());
    const nj = Math.min(rig.maxJibs ?? Infinity, rig.stockJibs + (upg.sails >= 2 ? 1 : 0));
    for (let j = 0; j < nj; j++) {
      // Multi-jib rigs: a low inner staysail and narrower outer jibs, rather than nested copies.
      // Their tack points sit exactly on the solid bowsprit, including the extra upgraded jib.
      const multiJib = rig.stockJibs >= 2;
      const tackFraction = multiJib ? 0.48 + j * 0.12 : 0.53 + j * 0.13;
      const tackY = multiJib ? bow.y - 0.1 + (0.3 * (tackFraction - 0.35)) / 0.38 : bow.y + j * 0.1;
      const tack = V(0, tackY, L * tackFraction);
      const head = V(
        0,
        foreBase + foreHeight * (multiJib ? 0.68 + j * 0.14 : 0.76 + j * 0.15),
        foreZ,
      );
      const clew = V(
        0,
        foreBase + 0.8 + j * 0.1,
        foreZ + (multiJib ? 0.65 + j * 0.85 : 0.35 + j * 0.22),
      );
      const axis = new THREE.Group();
      axis.name = `JibStay${j + 1}`;
      axis.position.copy(tack);
      axis.quaternion.setFromUnitVectors(V(0, 1, 0), head.clone().sub(tack).normalize());
      const inverse = axis.quaternion.clone().invert();
      const local = (v: THREE.Vector3) => v.clone().sub(tack).applyQuaternion(inverse);
      const h = local(head);
      // Exact zeroes on the luff prevent even float conversion error at attachment vertices.
      h.set(0, h.y, 0);
      const c = local(clew);
      const g = cloth(V(0, 0, 0), c, h, h, upg.sails, 0.22, BAND);
      const sail = mesh(g, canvas, `Jib${j + 1}`);
      axis.add(sail);
      this.ship.add(axis);
      this.headsails.push({ axis, sail, clew: c });
      line(tack, head);
    }
    this.stats.jibs = nj;
    for (const side of [-1, 1]) {
      line(V(0, mastBase + MAST_H * 0.8, MAST_Z), V(side * B * 0.43, deckAt(0.15) + 0.1, 0.15));
    }
    if (fore) {
      for (const side of [-1, 1]) {
        line(
          V(0, foreBase + foreHeight * 0.8, foreZ),
          V(side * B * 0.43, deckAt(foreZ) + 0.1, foreZ),
        );
      }
      line(mastTop, V(0, foreBase + foreHeight, foreZ));
    }
    if (mizzen) {
      const top = V(0, deckAt(mizzen.z) + mizzen.height * ST.mastK, mizzen.z);
      for (const side of [-1, 1]) line(top, V(side * B * 0.38, deckAt(mizzen.z) + 0.1, mizzen.z));
      line(mastTop, top);
    }
    this.runningOffset = lines.length / 3;
    // Gaff lift, mainsheet, and one working sheet per jib. Updated in ship-local coordinates.
    for (let i = 0; i < 2 * this.gaffSails.length + nj; i++) line(V(0, 0, 0), V(0, 0, 0));
    const ropes = new THREE.BufferGeometry();
    ropes.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(lines, 3).setUsage(THREE.DynamicDrawUsage),
    );
    const rope = new THREE.LineBasicMaterial({
      color: ST.rigging,
      transparent: true,
      opacity: 0.7,
    });
    this.disposables.push(ropes, rope);
    this.rigging = new THREE.LineSegments(ropes, rope);
    this.rigging.name = 'Rigging';
    this.rigging.visible = this.riggingEnabled;
    this.rigging.frustumCulled = false; // tiny mutable line buffer; the endpoints move during tacks
    this.ship.add(this.rigging);

    const flagGeo = new THREE.BufferGeometry().setFromPoints([
      V(0, 0, 0),
      V(0, -0.5, 0),
      V(0, -0.25, -1),
    ]);
    flagGeo.computeVertexNormals();
    const flagMat = new THREE.MeshBasicMaterial({ color: BAND, side: THREE.DoubleSide });
    this.disposables.push(flagMat);
    this.flag = mesh(flagGeo, flagMat, 'Pennant');
    this.flag.position.copy(fore ? V(0, foreBase + foreHeight, foreZ) : mastTop);
    this.flag.scale.setScalar(ST.flag);
    this.ship.add(this.flag);
    this.lantern.position.copy(this.flag.position).y -= 0.6;
    this.ship.add(this.lantern);
    this.ship.rotation.y = Math.PI;
    this.body.scale.setScalar(BOAT_SCALE);
    this.body.add(this.ship);
    this.root.add(this.body);
    this.update({ sail: 1, boomAngle: 0, luff: 0, heel: 0, windRelative: 0, time: 0 });
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        this.stats.meshes++;
        this.stats.triangles += triangleCount(m.geometry);
      }
    });
  }

  update(p: BoatPose) {
    this.body.rotation.z = p.heel;
    const side = p.boomAngle < 0 ? -1 : 1;
    const fill = side * Math.max(0.08, 1 - p.luff) + p.luff * Math.sin(p.time * 26) * 0.35;
    for (const gaff of this.gaffSails) {
      gaff.pivot.rotation.y = p.boomAngle;
      // Lower cloth and gaff along the mast, keeping the boom at its fixed gooseneck.
      gaff.pivot.scale.y = 0.06 + 0.94 * p.sail;
      gaff.sail.scale.x = fill;
      gaff.pivot.updateMatrix();
    }
    for (const jib of this.headsails) {
      jib.sail.rotation.y = p.boomAngle * 0.6;
      jib.sail.scale.set(fill, 1, 0.04 + 0.96 * p.sail);
      jib.sail.updateMatrix();
      jib.axis.updateMatrix();
    }
    if (this.rigging.visible) {
      const pos = this.rigging.geometry.getAttribute('position') as THREE.BufferAttribute;
      let i = this.runningOffset;

      for (const gaff of this.gaffSails) {
        this.putLinePoint(pos, i++, gaff.mastTop);
        this.putLinePoint(pos, i++, this.tmp.copy(gaff.peak).applyMatrix4(gaff.pivot.matrix));
        this.putLinePoint(pos, i++, gaff.sheetAnchor);
        this.putLinePoint(pos, i++, this.tmp.copy(gaff.clew).applyMatrix4(gaff.pivot.matrix));
      }
      for (const jib of this.headsails) {
        this.jibSheetAnchor.x = -side * this.beam * 0.4;
        this.putLinePoint(pos, i++, this.jibSheetAnchor);
        this.putLinePoint(
          pos,
          i++,
          this.tmp.copy(jib.clew).applyMatrix4(jib.sail.matrix).applyMatrix4(jib.axis.matrix),
        );
      }
      pos.needsUpdate = true;
    }
    this.flag.rotation.y = Math.PI - p.windRelative + Math.sin(p.time * 9) * 0.12;
  }

  private putLinePoint(pos: THREE.BufferAttribute, i: number, p: THREE.Vector3) {
    pos.setXYZ(i, p.x, p.y, p.z);
  }

  setLowDetail(low: boolean) {
    this.rigging.visible = this.riggingEnabled && !low;
  }
  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}