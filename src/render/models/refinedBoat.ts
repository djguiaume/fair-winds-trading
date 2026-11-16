import * as THREE from 'three';
import { DEFAULT_DAMAGE } from '../../data/ships';
import { DEG } from '../../sim/math';
import { BOAT_SCALE, STYLE_D as ST } from './boatStyle';
import { BoatCloseUp, bellyFor, deckCoils, type CloseUpPlan } from './boatCloseUp';
import { BoatRigging } from './boatRigging';
import { deckFittings, rudderHead, stowCargo } from './deckFittings';
import { figureheadParts } from './figurehead';
import { pennant } from './flag';
import { buildGaffSail, gaffPlans, type GaffSail } from './gaffSails';
import { isGlowing, mergeAll, triangleCount } from './geometry';
import { buildHeadsails, type Headsail } from './headsails';
import { hullGeometry } from './hullGeometry';
import { resolveBoatLook, strakeColour } from './boatLook';
import { V, deckHeight, deckOutline, spar, type RefinedRig } from './refinedRig';
import type { ClothWear } from './sailCloth';
import { mainsailMarks } from './sailMarks';
import { boatSailMaterial, boatWoodMaterial } from './boatSurfaces';
import {
  SQUARE_BELLY,
  SQUARE_FORWARD,
  braceFor,
  buildSquareRig,
  placeSquareMasts,
  poseSquareRig,
  squareSheetEnds,
  type PlacedSquareMast,
  type SquareRig,
} from './squareRig';
import { shrouds } from './standingRigging';
import { castleGeometry } from './sternCastle';
import { STOCK_UPGRADES, type BoatModel, type BoatModelOptions, type BoatPose } from './types';

export type { HullDetailContext, HullShape, RefinedRig, SquareMast } from './refinedRig';

const CABIN_DAY = new THREE.Color('#485461');
const CABIN_NIGHT = new THREE.Color('#b7ab91');

/** Shared refined gaff-rig construction. Upgrade semantics and the BoatModel waterline frame stay unchanged. */
export class RefinedBoat implements BoatModel {
  /** The class name the model was built for ("Cutter"); its meshes are named after it. */
  readonly name: string;
  readonly cargoBounds: THREE.Box3[] = [];
  private windowMaterial?: THREE.MeshBasicMaterial;
  readonly root = new THREE.Group();
  /** Same waterline envelope at every upgrade level, for the hull-attached wake. */
  readonly wakeHull: { length: number; beam: number };
  readonly stats = {
    triangles: 0,
    meshes: 0,
    crates: 0,
    barrels: 0,
    jibs: 0,
    topsail: false,
    courses: 0,
  };
  private readonly body = new THREE.Group();
  /** The ship in her own frame (bow +Z), turned to face -Z; parts are added here. */
  private readonly ship = new THREE.Group();
  private readonly gaffSails: GaffSail[] = [];
  private readonly headsails: Headsail[];
  private readonly squareRigs: SquareRig[] = [];
  private readonly flag: THREE.Mesh;
  /** Masthead lantern (decision 0068): high on the mast, where it reads from above. */
  readonly lantern = new THREE.Object3D();
  private readonly rigging: BoatRigging;
  private readonly riggingEnabled: boolean;
  private readonly beam: number;
  private readonly tmp = new THREE.Vector3();
  private readonly jibSheetAnchor: THREE.Vector3;
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  /** A standing list at the worst damage (decision 0208), in radians. */
  private readonly list: number;
  private readonly putEnd = (p: THREE.Vector3) => this.rigging.put(p);
  /** The player's boat up close (issue #553): crew, a working tiller, trimmed sails. */
  private readonly closeUp?: BoatCloseUp;
  private lowDetail = false;

  constructor(rig: RefinedRig, options: BoatModelOptions = {}) {
    const { length: L, mastZ: MAST_Z, band: BAND } = rig;
    this.name = rig.name;
    const B = rig.beam * ST.B;
    const H = rig.depth * ST.H;
    const deckAt = deckHeight(rig);
    // Where masts, sheets and the tiller stand: on the stern castle when there is one.
    const castleFront = rig.castle ? -L / 2 + rig.castle.length : -Infinity;
    const standAt = (z: number) =>
      rig.sternLayout && z < castleFront
        ? rig.sternLayout.deck
        : deckAt(z) + (rig.castle && z < castleFront ? rig.castle.height * ST.H : 0);
    // Preserve the current rig's masthead when moving its foot onto the authored deck.
    const MAST_H =
      rig.mastHeight * ST.mastK +
      (rig.sternLayout
        ? deckAt(MAST_Z) + (rig.castle?.height ?? 0) * ST.H - rig.sternLayout.deck
        : 0);
    const outline = deckOutline(rig);
    this.beam = B;
    this.wakeHull = { length: L * BOAT_SCALE, beam: B * BOAT_SCALE };
    // Square riggers lead jib sheets to the rail just ahead of the foremast's courses.
    const foremost = rig.squareMasts?.reduce((z, m) => Math.max(z, m.z), -Infinity);
    const sheetZ = foremost === undefined ? 0 : foremost + SQUARE_FORWARD + SQUARE_BELLY + 0.4;
    this.jibSheetAnchor = V(0, deckAt(sheetZ) + 0.12, sheetZ);
    const upg = options.upgrades ?? STOCK_UPGRADES;
    const look = resolveBoatLook({ bandColor: BAND, sailBandColor: rig.sailBand }, options.look);
    const sailMarks = mainsailMarks(look, options.sailNumber, !!rig.squareMasts?.length);
    this.riggingEnabled = options.rigging ?? true;
    const wood = boatWoodMaterial();
    const canvas = boatSailMaterial();
    this.disposables.push(wood, canvas);
    const mesh = (g: THREE.BufferGeometry, material: THREE.Material, name: string) => {
      this.disposables.push(g);
      const m = new THREE.Mesh(g, material);
      m.name = name;
      m.castShadow = true;
      return m;
    };
    const part = (g: THREE.BufferGeometry, kind: 'wood' | 'canvas', name: string) =>
      mesh(g, kind === 'wood' ? wood : canvas, name);
    // Visible damage (decision 0208): 0 sound to 3 torn and listing, from the hull's condition.
    const damage = options.damage ?? 0;
    const marks = rig.damage ?? DEFAULT_DAMAGE;
    const patched: ClothWear = { patched: damage >= 2 };
    const torn: ClothWear = { ...patched, tears: damage >= 3 ? marks.tears : [] };
    this.list = damage >= 3 ? marks.listSide * marks.listDeg * DEG : 0;
    const parts = [
      hullGeometry(upg.hull, { ...rig, band: look.hullBand }, damage, strakeColour(look, upg.hull)),
    ];
    if (rig.castle && !rig.replaceDeckDetails)
      parts.push(castleGeometry(upg.hull, rig, look.hullBand));
    if (!rig.replaceDeckDetails)
      parts.push(...deckFittings(rig, deckAt, standAt, H, !options.closeUp));
    const detailContext = {
      length: L,
      beam: B,
      depth: H,
      deckAt,
      hull: rig.hull,
      band: look.hullBand,
      upgrades: upg,
    };
    const cargo = stowCargo(rig, upg, deckAt, rig.cargo?.(detailContext));
    parts.push(...cargo.parts);
    this.cargoBounds.push(...cargo.bounds);
    this.stats.crates = cargo.crates;
    this.stats.barrels = cargo.barrels;
    const mastBase = standAt(MAST_Z);
    const mastTop = V(0, mastBase + MAST_H, MAST_Z);
    parts.push(spar(V(0, mastBase, MAST_Z), mastTop, 0.075));
    const fore = rig.foremast;
    const foreBase = fore ? deckAt(fore.z) : mastBase;
    const foreHeight = fore ? fore.height * ST.mastK : MAST_H;
    const foreZ = fore?.z ?? MAST_Z;
    if (fore) parts.push(spar(V(0, foreBase, foreZ), V(0, foreBase + foreHeight, foreZ), 0.07));
    const mizzen = rig.mizzen;
    const mizzenBase = mizzen ? deckAt(mizzen.z) : 0;
    if (mizzen)
      parts.push(
        spar(
          V(0, mizzenBase, mizzen.z),
          V(0, mizzenBase + mizzen.height * ST.mastK, mizzen.z),
          0.07,
        ),
      );
    // Square masts: the mast and a fighting top above the lowest course are part of the hull mesh.
    const squareMasts = placeSquareMasts(rig.squareMasts ?? [], standAt, parts);
    const closeUp: CloseUpPlan | undefined = options.closeUp
      ? {
          id: rig.id ?? 'sloop',
          length: L,
          rudderHead: rudderHead(rig, standAt),
          standAt,
          outline,
          mastFoot: V(0, mastBase, MAST_Z),
          look,
          tiller: !rig.replaceDeckDetails,
        }
      : undefined;
    if (closeUp) parts.push(...deckCoils(closeUp));
    const bow = V(0, deckAt(L / 2) + 0.13, L / 2);
    const bowspritTip = V(0, bow.y + 0.2, L * 0.73);
    parts.push(spar(V(0, bow.y - 0.1, L * 0.35), bowspritTip, 0.05));
    if (rig.details)
      parts.push(...rig.details({ deckAt, halfBeam: B / 2, depth: H, upgrades: upg }));
    if (rig.boatDetails) parts.push(...rig.boatDetails(detailContext));
    parts.push(
      ...figureheadParts(look.figurehead, rig.figureheadMount, V(0, deckAt(L / 2), L / 2)),
    );
    let hull = mergeAll(parts.filter((g) => !isGlowing(g)));
    if (rig.hullFinish) hull = mergeAll([hull, ...rig.hullFinish(hull, deckAt)]);
    this.ship.add(mesh(hull, wood, `${rig.name}Hull`));
    const glass = parts.filter(isGlowing);
    if (glass.length) {
      this.windowMaterial = new THREE.MeshBasicMaterial({
        vertexColors: true,
        color: '#485461',
        toneMapped: false,
      });
      this.disposables.push(this.windowMaterial);
      this.ship.add(mesh(mergeAll(glass), this.windowMaterial, 'SternWindows'));
    }
    if (closeUp) {
      this.closeUp = new BoatCloseUp(closeUp, (g, name) => mesh(g, wood, name));
      this.ship.add(this.closeUp.helm, this.closeUp.crew);
    }

    // Every gaff mast has its own gooseneck, gaff lift and working sheet; their luffs stay on
    // their masts. The logo or racing number (sailMarks.ts) goes on the mainsail; square riggers
    // carry it on the main course instead.
    const mainSpot = { base: mastBase, height: MAST_H, z: MAST_Z };
    const foreSpot = fore ? { base: foreBase, height: foreHeight, z: foreZ } : undefined;
    const mizzenSpot = mizzen
      ? { base: mizzenBase, height: mizzen.height * ST.mastK, z: mizzen.z }
      : undefined;
    const gaffs = gaffPlans(rig, {
      main: mainSpot,
      ...(foreSpot ? { fore: foreSpot } : {}),
      ...(mizzenSpot ? { mizzen: mizzenSpot } : {}),
      deckAt,
      standAt,
      sails: upg.sails,
      look,
      mainDress: { ...torn, marks: squareMasts.length ? [] : sailMarks },
      dress: patched,
    });
    for (const plan of gaffs) {
      const { gaff, topsail } = buildGaffSail(plan, part);
      if (topsail) this.stats.topsail = true;
      this.ship.add(gaff.pivot);
      this.gaffSails.push(gaff);
    }

    const mainSquare = squareMasts.reduce<PlacedSquareMast | undefined>(
      (aft, m) => (aft && aft.z < m.z ? aft : m),
      undefined,
    );
    for (const m of squareMasts) {
      const { rig: square, shown } = buildSquareRig(m, {
        beam: B,
        sails: upg.sails,
        look,
        outline,
        standAt,
        dress: (k) => (k > 0 ? patched : m === mainSquare ? { ...torn, marks: sailMarks } : torn),
        mesh: part,
      });
      this.ship.add(square.turn);
      this.squareRigs.push(square);
      this.stats.courses += shown;
      if (shown === m.courses) this.stats.topsail = true;
    }

    // Square riggers set their jibs on the foremost square mast.
    const jibMast = squareMasts.reduce<{ base: number; height: number; z: number } | undefined>(
      (best, m) => (best && best.z > m.z ? best : m),
      undefined,
    ) ?? { base: foreBase, height: foreHeight, z: foreZ };
    const jibs = buildHeadsails({
      count: Math.min(rig.maxJibs ?? Infinity, rig.stockJibs + (upg.sails >= 2 ? 1 : 0)),
      stockJibs: rig.stockJibs,
      length: L,
      bow,
      mast: jibMast,
      square: squareMasts.length > 0,
      deckAt,
      sails: upg.sails,
      look,
      dress: patched,
      mesh: (g, name) => mesh(g, canvas, name),
    });
    this.headsails = jibs.sails;
    for (const jib of jibs.sails) this.ship.add(jib.axis);
    this.stats.jibs = jibs.sails.length;
    const standing = shrouds({
      main: mainSpot,
      ...(foreSpot ? { fore: foreSpot } : {}),
      ...(mizzenSpot ? { mizzen: mizzenSpot } : {}),
      square: squareMasts,
      beam: B,
      outline,
      deckAt,
      castle: !!rig.castle,
    });
    this.rigging = this.buildRigging([...jibs.stays, ...standing]);

    const flag = pennant(options.flag, BAND);
    this.disposables.push(flag.material);
    this.flag = mesh(flag.geometry, flag.material, 'Pennant');
    const tallest = squareMasts.reduce<PlacedSquareMast | undefined>(
      (best, m) => (best && best.base + best.height >= m.base + m.height ? best : m),
      undefined,
    );
    this.flag.position.copy(
      tallest
        ? V(0, tallest.base + tallest.height, tallest.z)
        : fore
          ? V(0, foreBase + foreHeight, foreZ)
          : mastTop,
    );
    this.flag.scale.setScalar(ST.flag);
    this.ship.add(this.flag);
    this.lantern.position.copy(this.flag.position).y -= 0.6;
    this.ship.add(this.lantern);
    this.ship.rotation.y = Math.PI;
    this.body.scale.setScalar(BOAT_SCALE);
    this.body.add(this.ship);
    this.root.add(this.body);
    this.finish();
  }

  /** The rope lines: `standing` fixed, then the running lines rewritten each frame. */
  private buildRigging(standing: Array<[THREE.Vector3, THREE.Vector3]>) {
    // Gaff lift and sheet per gaff, one working sheet per jib, two per square course.
    const running = 2 * this.gaffSails.length + this.headsails.length + 2 * this.stats.courses;
    const rigging = new BoatRigging(standing, running);
    rigging.lines.visible = this.riggingEnabled;
    this.ship.add(rigging.lines);
    return rigging;
  }

  /** Poses the rest position and counts the meshes and triangles. */
  private finish() {
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
    this.body.rotation.z = p.heel + this.list;
    const side = p.boomAngle < 0 ? -1 : 1;
    // Up close her sails stand flatter close-hauled and fuller off the wind.
    const belly = this.closeUp ? bellyFor(p.boomAngle) : 1;
    const fill = side * Math.max(0.08, 1 - p.luff) * belly + p.luff * Math.sin(p.time * 26) * 0.35;
    for (const gaff of this.gaffSails) {
      gaff.pivot.rotation.y = p.boomAngle;
      // Lower cloth and gaff along the mast, keeping the boom at its fixed gooseneck.
      gaff.pivot.scale.y = 0.06 + 0.94 * p.sail;
      gaff.sail.scale.x = fill;
      gaff.pivot.updateMatrix();
    }
    const brace = braceFor(p.boomAngle);
    const square = Math.max(0.08, 1 - p.luff) + p.luff * Math.sin(p.time * 26) * 0.2;
    for (const rig of this.squareRigs) poseSquareRig(rig, brace, p.sail, square);
    for (const jib of this.headsails) {
      jib.sail.rotation.y = p.boomAngle * 0.6;
      jib.sail.scale.set(fill, 1, 0.04 + 0.96 * p.sail);
      jib.sail.updateMatrix();
      jib.axis.updateMatrix();
    }
    if (this.rigging.lines.visible) this.poseRunningRigging(side, 0.06 + 0.94 * p.sail);
    this.flag.rotation.y = Math.PI - p.windRelative + Math.sin(p.time * 9) * 0.12;
    this.closeUp?.update(p);
  }

  /** Gaff lifts and mainsheets, a working sheet per jib (to leeward), the square courses' sheets. */
  private poseRunningRigging(side: number, reef: number) {
    const ropes = this.rigging;
    ropes.begin();
    for (const gaff of this.gaffSails) {
      ropes.put(gaff.mastTop);
      ropes.put(this.tmp.copy(gaff.peak).applyMatrix4(gaff.pivot.matrix));
      ropes.put(gaff.sheetAnchor);
      ropes.put(this.tmp.copy(gaff.clew).applyMatrix4(gaff.pivot.matrix));
    }
    for (const jib of this.headsails) {
      this.jibSheetAnchor.x = -side * this.beam * 0.4;
      ropes.put(this.jibSheetAnchor);
      ropes.put(
        this.tmp.copy(jib.clew).applyMatrix4(jib.sail.matrix).applyMatrix4(jib.axis.matrix),
      );
    }
    for (const rig of this.squareRigs) squareSheetEnds(rig, reef, this.tmp, this.putEnd);
    ropes.end();
  }

  setLowDetail(low: boolean) {
    this.lowDetail = low;
    this.rigging.lines.visible = this.riggingEnabled && !low;
    if (low) this.closeUp?.setNear(false);
  }
  /** The crew shows while the camera is near, never on the Low levels (the far model stays). */
  setCloseUp(near: boolean) {
    this.closeUp?.setNear(near && !this.lowDetail);
  }
  setNightLighting(night: number) {
    this.windowMaterial?.color
      .copy(CABIN_DAY)
      .lerp(CABIN_NIGHT, THREE.MathUtils.clamp(night, 0, 1));
  }
  dispose() {
    for (const d of this.disposables) d.dispose();
    this.rigging.dispose();
  }
}
