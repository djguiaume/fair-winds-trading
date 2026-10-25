import { SLOOP_HULL, type HullShape } from '../../sim/hullShape';
import * as THREE from 'three';
import { BOAT_SCALE, STYLE_D as ST } from './boatStyle';
import { isGlowing, mergeAll, paint, triangleCount, vertexColorMaterial } from './geometry';
import type { BoatCargo, BoatDetails } from './boatDetails';
import { DEFAULT_DAMAGE, type ShipDamageData } from '../../data/ships';
import { DEG } from '../../sim/math';
import { flagGeometry } from './flag';
import {
  STOCK_UPGRADES,
  type BoatModel,
  type BoatModelOptions,
  type BoatPose,
  type ShipUpgrades,
} from './types';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const CABIN_DAY = new THREE.Color('#485461');
const CABIN_NIGHT = new THREE.Color('#b7ab91');
/** Normalized hull sections, authored independently of rig dimensions and palette. */
export type { HullShape } from '../../sim/hullShape';

/** Rounded starter hull. Other classes supply their own silhouette and sections. */

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
  /** Square-rigged masts (hauler line, decision 0079): stacked courses hang from yards that
   * brace round together; the top course is added at sails 3. The jibs stay on the foremost. */
  squareMasts?: ReadonlyArray<SquareMast>;
  /** Raised stern deck of the big square riggers, in reference units. Masts, sheets and the
   * tiller standing on it start from its top. */
  castle?: { length: number; height: number };
  /** The main gaff carries the sails-3 topsail (default true). */
  mainTopsail?: boolean;
  /** The fluyt's only gaff is its aft mizzen. */
  mainName?: 'Mainsail' | 'Mizzen';
  /** Boom height above the deck at the mast (default 0.7); raised to clear tall deck cargo. */
  gooseneck?: number;
  /** Class-specific fittings (leeboards, hatch coamings…) merged into the hull mesh, so they
   * cost no extra draw call. Receives the deck sheer and the upgrade levels. */
  details?: (ctx: HullDetailContext) => THREE.BufferGeometry[];
  /** Extra geometry fitted onto the finished hull mesh (the indiaman's gun ports are cast onto
   * its sides); merged into it, so it costs no extra draw. */
  hullFinish?: (
    hull: THREE.BufferGeometry,
    deckAt: (z: number) => number,
  ) => THREE.BufferGeometry[];
  /** Class-authored deck fittings, including window panes tagged with glowing(). */
  boatDetails?: BoatDetails;
  replaceDeckDetails?: boolean;
  cargo?: BoatCargo;
  /** Where her damage shows (decision 0208), from the ship file. */
  damage?: ShipDamageData;
  /** Authored quarterdeck and rear rig heights; foot is above the original main deck. */
  sternLayout?: { deck: number; foot: number; aft: number; sheet: { z: number; y: number } };
}

export interface HullDetailContext {
  /** Deck height at a station along the hull (bow +Z before the model's final turn). */
  deckAt: (z: number) => number;
  /** Half the scaled beam at the deck. */
  halfBeam: number;
  /** Scaled hull depth, deck to keel. */
  depth: number;
  upgrades: ShipUpgrades;
}

export interface SquareMast {
  /** Mesh names: `${name}Yards` and `${name}Courses`, e.g. Fore / Main. */
  name: string;
  z: number;
  height: number;
  /** Courses at sails 3; one fewer below. */
  courses: number;
}

/** Square courses hang this far forward of their mast and belly up to this much further. */
const SQUARE_FORWARD = 0.14;
const SQUARE_BELLY = 0.3;
/** Boom angles the game draws close-hauled and dead downwind (view.ts), and the hardest brace. */
const CLOSE_BOOM = (12 * Math.PI) / 180;
const RUN_BOOM = (80 * Math.PI) / 180;
const MAX_BRACE = (40 * Math.PI) / 180;

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
export function hullGeometry(
  level: number,
  rig: Pick<RefinedRig, 'length' | 'beam' | 'depth' | 'hull' | 'band' | 'hullShape' | 'damage'>,
  damage = 0,
) {
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
  const strake = (r: number) =>
    r === 0 && level >= 2 ? BAND : r === 2 && level >= 3 ? ST.copper : HULL;
  const marks = rig.damage ?? DEFAULT_DAMAGE;
  // The outline segment nearest a damage station (decision 0208), on its side of the hull.
  const segmentAt = (p: { z: number; side: number }) => {
    let best = 0;
    let gap = Infinity;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]!;
      const b = outline[(i + 1) % outline.length]!;
      if (Math.sign(a.x + b.x) !== p.side) continue;
      const d = Math.abs((a.z + b.z) / 2 - p.z * L);
      if (d < gap) [best, gap] = [i, d];
    }
    return best;
  };
  const brokenRail = damage >= 2 ? segmentAt(marks.rail) : -1;
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    f.tri(V(0, DECK, 0), outline[i]!, outline[j]!, ST.deck);
    for (let r = 0; r < rings.length - 1; r++)
      f.quad(rings[r]![i]!, rings[r + 1]![i]!, rings[r + 1]![j]!, rings[r]![j]!, strake(r));
    f.tri(V(0, DECK - H, 0), rings[3]![j]!, rings[3]![i]!, HULL);
    // A solid raised gunwale: outer face, cap and inner face follow the same sheer as the deck.
    // A badly knocked hull has lost its middle stretch on one side (decision 0208).
    const spans =
      i === brokenRail
        ? [
            [0, 0.3],
            [0.72, 1],
          ]
        : [[0, 1]];
    for (const [from, to] of spans) {
      const a = outline[i]!.clone().lerp(outline[j]!, from!);
      const b = outline[i]!.clone().lerp(outline[j]!, to!);
      const ai = V(a.x * 0.93, a.y, a.z * 0.98);
      const bi = V(b.x * 0.93, b.y, b.z * 0.98);
      const at = a.clone().add(V(0, 0.16, 0));
      const bt = b.clone().add(V(0, 0.16, 0));
      const ait = ai.clone().add(V(0, 0.16, 0));
      const bit = bi.clone().add(V(0, 0.16, 0));
      f.quad(a, b, bt, at, HULL);
      f.quad(at, bt, bit, ait, ST.deck);
      f.quad(ai, ait, bit, bi, HULL);
      if (spans.length > 1) {
        // The broken ends: the gunwale's cut section, in bare wood.
        const end = from === 0 ? [b, bi, bit, bt] : [a, at, ait, ai];
        f.quad(end[0]!, end[1]!, end[2]!, end[3]!, ST.deck);
        f.quad(end[3]!, end[2]!, end[1]!, end[0]!, ST.deck);
      }
    }
  }
  // Scuffs: warm darker patches laid just proud of the topsides at each station, a big one on the
  // top strake (the band from hull 2) and a smaller one on the strake below (decision 0208).
  if (damage >= 1)
    for (const mark of marks.scuffs) {
      const i = segmentAt(mark);
      const j = (i + 1) % outline.length;
      const at = (r: number, u: number, v: number) => {
        const top = rings[r]![i]!.clone().lerp(rings[r]![j]!, u);
        const p = top.lerp(rings[r + 1]![i]!.clone().lerp(rings[r + 1]![j]!, u), v);
        return p.add(V(mark.side * 0.035, 0, 0));
      };
      for (const [r, u0, u1, v0, v1] of [
        [0, 0.08, 0.62, 0.04, 0.9],
        [0, 0.5, 0.86, 0.3, 0.97],
        [1, 0.3, 0.7, 0.02, 0.55],
      ] as const)
        f.quad(at(r, u0, v0), at(r, u0, v1), at(r, u1, v1), at(r, u1, v0), scuffed(strake(r)));
      // The game camera looks down on her, so the knocks show on the deck inside the rail too:
      // scraped planks, laid on the deck's own fan triangle just above it.
      const deck = (u: number, w: number) =>
        V(0, DECK, 0)
          .lerp(outline[i]!.clone().lerp(outline[j]!, u), w)
          .add(V(0, 0.015, 0));
      for (const [u0, u1, w0, w1] of [
        [0.12, 0.58, 0.62, 0.9],
        [0.46, 0.8, 0.7, 0.94],
      ] as const)
        f.quad(deck(u0, w0), deck(u0, w1), deck(u1, w1), deck(u1, w0), scuffed(ST.deck));
    }
  return f.geometry();
}

/** A colour scuffed: mixed 40 % toward warm charcoal, never grey (decision 0208; a quarter was too faint). */
function scuffed(color: string) {
  return '#' + new THREE.Color(color).lerp(SCUFF, 0.4).getHexString();
}
const SCUFF = new THREE.Color('#2e2219');
/** Where a damaged sail's patches sit, as fractions along the foot and up the luff (0208). */
const PATCH_SPOTS = [
  [0.2, 0.25],
  [0.78, 0.3],
  [0.22, 0.78],
  [0.8, 0.8],
] as const;

/** Deck outline in ship-local coordinates (+Z bow), shared by the hull and the stern castle. */
function deckOutline(rig: RefinedRig) {
  const L = rig.length;
  const B = rig.beam * ST.B;
  const DECK = rig.depth * ST.H * 0.55;
  const deckAt = (z: number) => DECK + ST.sheer * (L / 5) ** 0.5 * (z / (L / 2)) ** 2;
  return (rig.hullShape ?? SLOOP_HULL).outline.map(([x, z]) => V(x * B, deckAt(z * L), z * L));
}

/** Half the deck's width at `z`, read from the authored outline (for shrouds and sheets). */
function halfBeamAt(outline: THREE.Vector3[], z: number) {
  let best = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    if ((a.z - z) * (b.z - z) > 0 || a.z === b.z) continue;
    best = Math.max(best, Math.abs(a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z)));
  }
  return best;
}

/**
 * Raised stern deck that follows the hull's own stern outline: walls flush with the topsides,
 * a deck on top, a forward bulkhead, a rail, and stern windows. Hull 2 paints its upper strake
 * in the class colour, like the hull band.
 */
function castleGeometry(level: number, rig: RefinedRig) {
  const { length: L, castle } = rig;
  const f = new Faces();
  if (!castle) return f.geometry();
  const outline = deckOutline(rig);
  const front = -L / 2 + castle.length;
  const ch = castle.height * ST.H;
  const poly: THREE.Vector3[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    if (a.z <= front) poly.push(a);
    if ((a.z - front) * (b.z - front) < 0)
      poly.push(a.clone().lerp(b, (front - a.z) / (b.z - a.z)));
  }
  // Rotate so the polygon starts at the starboard crossing: walls run round the stern, and the
  // closing edge is the forward bulkhead.
  const start = poly.findIndex((p) => Math.abs(p.z - front) < 1e-9 && p.x > 0);
  const ring = [...poly.slice(start), ...poly.slice(0, start)];
  const up = (p: THREE.Vector3, h: number) => V(p.x, p.y + h, p.z);
  const top = V(0, ring.reduce((y, p) => y + p.y, 0) / ring.length + ch, (front - L / 2) / 2);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const bulkhead = i === ring.length - 1;
    f.quad(up(a, ch * 0.72), a, b, up(b, ch * 0.72), rig.hull);
    f.quad(
      up(a, ch),
      up(a, ch * 0.72),
      up(b, ch * 0.72),
      up(b, ch),
      level >= 2 ? rig.band : rig.hull,
    );
    f.tri(top, up(a, ch), up(b, ch), ST.deck);
    if (bulkhead) continue;
    // Low rail round the castle edge: outer face and cap.
    const ai = V(a.x * 0.92, a.y, a.z * 0.985);
    const bi = V(b.x * 0.92, b.y, b.z * 0.985);
    f.quad(up(a, ch + 0.14), up(a, ch), up(b, ch), up(b, ch + 0.14), rig.hull);
    f.quad(up(ai, ch + 0.14), up(a, ch + 0.14), up(b, ch + 0.14), up(bi, ch + 0.14), ST.deck);
  }
  // Stern windows on the transom: warm lit panes in dark frames.
  const sternX = halfBeamAt(outline, -L / 2 + 1e-3);
  const z = -L / 2 - 0.012;
  const sternY = ST.sheer * (L / 5) ** 0.5 + rig.depth * ST.H * 0.55;
  const count = 3;
  for (let k = 0; k < count; k++) {
    const cx = ((k + 0.5) / count - 0.5) * sternX * 1.5;
    const w = (sternX * 1.5) / count - 0.12;
    const y0 = sternY + ch * 0.25;
    const y1 = sternY + ch * 0.62;
    f.quad(
      V(cx - w / 2, y0, z),
      V(cx - w / 2, y1, z),
      V(cx + w / 2, y1, z),
      V(cx + w / 2, y0, z),
      '#f2c66d',
    );
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

/** Cloth edges have zero belly, so tack, luff, head and spar attachments cannot drift.
 * `nu` × `nv` panels; the sails-3 racing stripe runs across the middle two rows. */
function cloth(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  level: number,
  belly: number,
  band: string,
  nu = 6,
  nv = 6,
  wear: ClothWear = {},
) {
  const f = new Faces();
  // A patched sail (decision 0208) takes the stock canvas look, keeping a racing stripe.
  const worn = level === 1 || wear.patched;
  // Damage patches (decision 0208): four big squares of darker, warmer canvas, two panels each
  // way, clear of the middle where a torn sail has its hole.
  const patched = new Set<string>();
  if (wear.patched)
    for (const [u, v] of PATCH_SPOTS) {
      const i0 = Math.max(0, Math.min(nu - 2, Math.round(u * nu - 1)));
      const j0 = Math.max(0, Math.min(nv - 2, Math.round(v * nv - 1)));
      for (const [di, dj] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ])
        patched.add(`${i0 + di!}:${j0 + dj!}`);
    }
  const torn = new Set(
    (wear.tears ?? []).map(
      (t) => `${Math.min(nu - 1, Math.floor(t.u * nu))}:${Math.min(nv - 1, Math.floor(t.v * nv))}`,
    ),
  );
  const at = (u: number, v: number) =>
    V(
      -belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * v),
      (a.y * (1 - u) + b.y * u) * (1 - v) + (c.y * (1 - u) + d.y * u) * v,
      (a.z * (1 - u) + b.z * u) * (1 - v) + (c.z * (1 - u) + d.z * u) * v,
    );
  const stripe = nv / 2;
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      if (torn.has(`${i}:${j}`)) continue;
      const color = patched.has(`${i}:${j}`)
        ? ST.damagePatches[(i + j) % 2]!
        : worn && (i * 7 + j * 3) % 8 === 1
          ? ST.patches[(i + j) % 2]!
          : level === 3 && (j === stripe - 1 || j === stripe)
            ? band
            : worn
              ? ST.patchedSail
              : (i + j) % 3 === 0
                ? '#eee6d4'
                : ST.sail;
      f.quad(
        at(i / nu, j / nv),
        at((i + 1) / nu, j / nv),
        at((i + 1) / nu, (j + 1) / nv),
        at(i / nu, (j + 1) / nv),
        color,
      );
    }
  return f.geometry();
}

/** Damage on a sail (decision 0208): patched canvas, and holes in the panels at `tears`. */
interface ClothWear {
  patched?: boolean;
  tears?: ReadonlyArray<{ u: number; v: number }>;
}

interface GaffSail {
  pivot: THREE.Group;
  sail: THREE.Mesh;
  peak: THREE.Vector3;
  clew: THREE.Vector3;
  mastTop: THREE.Vector3;
  sheetAnchor: THREE.Vector3;
}

/** One square-rigged mast: every course hangs from its own yard; all brace round together. */
interface SquareRig {
  turn: THREE.Group;
  sails: THREE.Mesh;
  /** Per course, in the yards' frame: yard height, foot depth below it, half foot width. */
  courses: Array<{ yard: number; drop: number; half: number }>;
  /** Yard-arm ends, where the course above sheets home. */
  yardArms: number[];
  /** The lowest course sheets home to the rail here, aft of its mast (port, starboard). */
  rail: [THREE.Vector3, THREE.Vector3];
}

interface Headsail {
  axis: THREE.Group;
  sail: THREE.Mesh;
  clew: THREE.Vector3;
}

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
  private readonly ship = new THREE.Group();
  private readonly gaffSails: GaffSail[] = [];
  private readonly headsails: Headsail[] = [];
  private readonly squareRigs: SquareRig[] = [];
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
  /** A standing list at the worst damage (decision 0208), in radians. */
  private readonly list: number;

  constructor(rig: RefinedRig, options: BoatModelOptions = {}) {
    const { length: L, mastZ: MAST_Z, band: BAND } = rig;
    this.name = rig.name;
    const B = rig.beam * ST.B;
    const H = rig.depth * ST.H;
    const DECK = H * 0.55;
    const deckAt = (z: number) => DECK + ST.sheer * (L / 5) ** 0.5 * (z / (L / 2)) ** 2;
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
    // Visible damage (decision 0208): 0 sound to 3 torn and listing, from the hull's condition.
    const damage = options.damage ?? 0;
    const marks = rig.damage ?? DEFAULT_DAMAGE;
    const patched: ClothWear = { patched: damage >= 2 };
    const torn: ClothWear = { ...patched, tears: damage >= 3 ? marks.tears : [] };
    this.list = damage >= 3 ? marks.listSide * marks.listDeg * DEG : 0;
    const parts = [hullGeometry(upg.hull, rig, damage)];
    if (rig.castle && !rig.replaceDeckDetails) parts.push(castleGeometry(upg.hull, rig));
    const box = (w: number, h: number, l: number, x: number, y: number, z: number, color: string) =>
      paint(new THREE.BoxGeometry(w, h, l).translate(x, y, z), color);
    // Forward hatch leaves a working area behind the mast for the upgraded cargo stacks.
    const hatchZ = rig.hatchZ ?? (rig.foremast ? 2.65 : 1.3);
    if (!rig.replaceDeckDetails) {
      parts.push(box(0.64, 0.13, 0.58, 0, deckAt(hatchZ) + 0.09, hatchZ, ST.mast));
      parts.push(box(0.54, 0.05, 0.48, 0, deckAt(hatchZ) + 0.18, hatchZ, ST.deck));
      const stern = -L * 0.5;
      // The big hulls' rudder reaches down their deeper sternpost; the tiller works on the castle.
      const rudder = rig.castle ? H * 0.8 : 0.72;
      parts.push(box(0.1, rudder, 0.32, 0, deckAt(stern) + 0.32 - rudder, stern - 0.1, ST.mast));
      const helm = standAt(stern);
      parts.push(spar(V(0, deckAt(stern) - 0.1, stern), V(0, helm + 0.23, stern)));
      parts.push(spar(V(0, helm + 0.23, stern), V(0.12, helm + 0.23, stern + 0.65)));
    }
    const cargoCount = [2, 4, 7][upg.hold - 1]! + rig.cargoExtra;
    const detailContext = {
      length: L,
      beam: B,
      depth: H,
      deckAt,
      hull: rig.hull,
      band: BAND,
      upgrades: upg,
    };
    const cargo = rig.cargo?.(detailContext);
    if (cargo && cargo.length !== cargoCount)
      throw new Error('Cargo layout must preserve hold counts');
    for (let i = 0; i < cargoCount; i++) {
      const slot = i % 6;
      const x = cargo?.[i]?.x ?? (slot % 2 === 0 ? -1 : 1) * (rig.cargoX ?? 0.3);
      const z =
        cargo?.[i]?.z ?? (rig.cargoZ ?? 0) - Math.floor(slot / 2) * (rig.foremast ? 0.5 : 0.65);
      const layer = cargo ? (cargo[i]?.layer ?? 0) : Math.floor(i / 6);
      const barrel = cargo?.[i]?.barrel ?? (upg.hold >= 2 && i % 3 === 2);
      const g = barrel
        ? new THREE.CylinderGeometry(0.21, 0.21, 0.42, 7)
        : new THREE.BoxGeometry(0.46, 0.42, 0.46);
      g.translate(x, deckAt(z) + 0.23 + layer * 0.43, z);
      g.computeBoundingBox();
      this.cargoBounds.push(g.boundingBox!.clone());
      parts.push(paint(g, barrel ? ST.barrel : ST.crate));
      if (barrel) this.stats.barrels++;
      else this.stats.crates++;
    }
    const mastBase = standAt(MAST_Z);
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
    // Square masts: the mast and a fighting top above the lowest course are part of the hull mesh.
    const squareMasts = (rig.squareMasts ?? []).map((m) => {
      const base = standAt(m.z);
      const height = m.height * ST.mastK;
      const span = (height - 1.5) / m.courses;
      parts.push(spar(V(0, base, m.z), V(0, base + height, m.z), 0.085));
      const topY = base + 1.1 + span * 0.92 + 0.1;
      parts.push(
        paint(new THREE.CylinderGeometry(0.42, 0.3, 0.12, 6).translate(0, topY, m.z), ST.mast),
      );
      return { ...m, base, height, span };
    });
    const bow = V(0, deckAt(L / 2) + 0.13, L / 2);
    const bowspritTip = V(0, bow.y + 0.2, L * 0.73);
    parts.push(spar(V(0, bow.y - 0.1, L * 0.35), bowspritTip, 0.05));
    if (rig.details)
      parts.push(...rig.details({ deckAt, halfBeam: B / 2, depth: H, upgrades: upg }));
    if (rig.boatDetails) parts.push(...rig.boatDetails(detailContext));
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
      pivot.position.set(
        0,
        rig.sternLayout && z === MAST_Z
          ? deckAt(z) + rig.sternLayout.foot
          : base + (rig.gooseneck ?? 0.7),
        z,
      );
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
      const main = z === MAST_Z;
      const sails = [
        cloth(V(0, 0, 0), clew, throat, peak, upg.sails, 0.32, BAND, 6, 6, main ? torn : patched),
      ];
      if (topsail && upg.sails >= 3) {
        const top = V(0, height - 0.85, 0);
        sails.push(cloth(throat, peak, top, top, upg.sails, 0.13, BAND, 6, 6, patched));
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
        sheetAnchor:
          rig.sternLayout && z === MAST_Z
            ? V(0, rig.sternLayout.sheet.y, rig.sternLayout.sheet.z)
            : V(0, standAt(anchorZ) + 0.12, anchorZ),
      });
    };
    addGaff(
      rig.mainName ?? 'Mainsail',
      MAST_Z,
      mastBase,
      MAST_H,
      rig.boom,
      rig.gaff,
      rig.mainTopsail ?? true,
      rig.mizzen ? -2.2 : rig.castle ? -L * 0.47 : -L * 0.4,
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

    // Square courses: each hangs from its own yard, just forward of the mast, and bellies toward
    // the bow. All of one mast's courses are one mesh; furling is a morph toward each course's
    // own yard, so every head stays on its yard and no geometry is rebuilt per frame.
    for (const m of squareMasts) {
      const turn = new THREE.Group();
      turn.name = `${m.name}Brace`;
      turn.position.set(0, 0, m.z + SQUARE_FORWARD);
      const shown = m.courses - (upg.sails >= 3 ? 0 : 1);
      const pos: number[] = [];
      const furled: number[] = [];
      const colors: number[] = [];
      const yardParts: THREE.BufferGeometry[] = [];
      const courses: SquareRig['courses'] = [];
      const yardArms: number[] = [];
      for (let k = 0; k < shown; k++) {
        const foot = m.base + 1.1 + k * m.span;
        const yard = foot + m.span * 0.92;
        const w = B * 1.32 * (1 - 0.16 * k);
        const head = w * 0.88;
        // Authored in the cloth's own plane (luff along z), then turned square across the ship.
        const g = cloth(
          V(0, foot, -w / 2),
          V(0, foot, w / 2),
          V(0, yard, -head / 2),
          V(0, yard, head / 2),
          upg.sails,
          SQUARE_BELLY,
          BAND,
          5,
          4,
          k === 0 ? torn : patched,
        ).rotateY(Math.PI / 2);
        const p = g.getAttribute('position');
        const c = g.getAttribute('color');
        for (let i = 0; i < p.count; i++) {
          pos.push(p.getX(i), p.getY(i), p.getZ(i));
          furled.push(p.getX(i), yard + (p.getY(i) - yard) * 0.06, p.getZ(i));
          colors.push(c.getX(i), c.getY(i), c.getZ(i));
        }
        g.dispose();
        yardParts.push(spar(V(-head * 0.56, yard, 0), V(head * 0.56, yard, 0), 0.05));
        courses.push({ yard, drop: yard - foot, half: w / 2 });
        yardArms.push(head * 0.56);
      }
      const sailGeo = new THREE.BufferGeometry();
      sailGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      sailGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      sailGeo.morphAttributes.position = [new THREE.Float32BufferAttribute(furled, 3)];
      sailGeo.computeVertexNormals();
      turn.add(mesh(mergeAll(yardParts), wood, `${m.name}Yards`));
      const sails = mesh(sailGeo, canvas, `${m.name}Courses`);
      sails.updateMorphTargets();
      turn.add(sails);
      this.ship.add(turn);
      const railZ = m.z - 1.4;
      const railX = halfBeamAt(outline, railZ) * 0.9;
      const railY = standAt(railZ) + 0.2;
      this.squareRigs.push({
        turn,
        sails,
        courses,
        yardArms,
        rail: [V(-railX, railY, railZ), V(railX, railY, railZ)],
      });
      this.stats.courses += shown;
      if (shown === m.courses) this.stats.topsail = true;
    }

    // Each upgraded jib has its OWN head/tack pair and inclined stay axis. Do not merge their
    // pivots or scale along the stay: reefing rolls the free edge towards the stay instead.
    const lines: number[] = [];
    const line = (a: THREE.Vector3, b: THREE.Vector3) => lines.push(...a.toArray(), ...b.toArray());
    const nj = Math.min(rig.maxJibs ?? Infinity, rig.stockJibs + (upg.sails >= 2 ? 1 : 0));
    // Square riggers set their jibs on the foremost square mast.
    const jibMast = squareMasts.reduce<{ base: number; height: number; z: number } | undefined>(
      (best, m) => (best && best.z > m.z ? best : m),
      undefined,
    ) ?? { base: foreBase, height: foreHeight, z: foreZ };
    for (let j = 0; j < nj; j++) {
      // Multi-jib rigs: a low inner staysail and narrower outer jibs, rather than nested copies.
      // Their tack points sit exactly on the solid bowsprit, including the extra upgraded jib.
      const multiJib = rig.stockJibs >= 2;
      const tackFraction = multiJib ? 0.48 + j * 0.12 : 0.53 + j * 0.13;
      const tackY = multiJib ? bow.y - 0.1 + (0.3 * (tackFraction - 0.35)) / 0.38 : bow.y + j * 0.1;
      let tack = V(0, tackY, L * tackFraction);
      let head = V(
        0,
        jibMast.base + jibMast.height * (multiJib ? 0.68 + j * 0.14 : 0.76 + j * 0.15),
        jibMast.z,
      );
      let clew = V(
        0,
        jibMast.base + 0.8 + j * 0.1,
        jibMast.z + (multiJib ? 0.65 + j * 0.85 : 0.35 + j * 0.22),
      );
      let stayTop = head;
      if (squareMasts.length) {
        // Square riggers: each stay runs from the masthead, above the top yard, to the bowsprit,
        // and the jib is hanked on its lower part only, so the whole jib stays forward of the
        // foremast's courses and their belly (decision 0079).
        const t = 0.56 + j * 0.1;
        tack = V(0, bow.y - 0.1 + (0.3 * (t - 0.35)) / 0.38, L * t);
        stayTop = V(0, jibMast.base + jibMast.height - 0.1 - j * 0.25, jibMast.z);
        const clearZ = jibMast.z + SQUARE_FORWARD + SQUARE_BELLY + 0.25;
        head = stayTop.clone().lerp(tack, (clearZ - stayTop.z) / (tack.z - stayTop.z));
        clew = V(0, deckAt(clearZ) + 1 + j * 0.2, clearZ + 0.55 + j * 0.9);
      }
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
      const g = cloth(V(0, 0, 0), c, h, h, upg.sails, 0.22, BAND, 6, 6, patched);
      const sail = mesh(g, canvas, `Jib${j + 1}`);
      axis.add(sail);
      this.ship.add(axis);
      this.headsails.push({ axis, sail, clew: c });
      line(tack, stayTop);
    }
    this.stats.jibs = nj;
    for (const side of [-1, 1]) {
      if (rig.castle)
        line(
          V(0, mastBase + MAST_H * 0.8, MAST_Z),
          V(side * halfBeamAt(outline, MAST_Z) * 0.9, mastBase + 0.1, MAST_Z),
        );
      else
        line(V(0, mastBase + MAST_H * 0.8, MAST_Z), V(side * B * 0.43, deckAt(0.15) + 0.1, 0.15));
    }
    // Square masts: shrouds to the rail on both sides, and a stay to the next mast aft.
    for (const [i, m] of squareMasts.entries()) {
      const x = halfBeamAt(outline, m.z) * 0.92;
      for (const side of [-1, 1])
        for (const at of [0.42, 0.85])
          line(V(0, m.base + m.height * at, m.z), V(side * x, deckAt(m.z) + 0.15, m.z - 0.4));
      const aft = squareMasts[i + 1];
      line(
        V(0, m.base + m.height, m.z),
        aft ? V(0, aft.base + aft.height * 0.9, aft.z) : V(0, mastBase + MAST_H, MAST_Z),
      );
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
    const sheets = 2 * this.stats.courses;
    for (let i = 0; i < 2 * this.gaffSails.length + nj + sheets; i++) line(V(0, 0, 0), V(0, 0, 0));
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

    // A regatta pennant won flies instead of the stock one (decision 0217).
    const flagGeo = options.flag
      ? flagGeometry(options.flag)
      : new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, -0.5, 0), V(0, -0.25, -1)]);
    flagGeo.computeVertexNormals();
    const flagMat = new THREE.MeshBasicMaterial({
      color: options.flag ? 0xffffff : BAND,
      vertexColors: !!options.flag,
      side: THREE.DoubleSide,
    });
    this.disposables.push(flagMat);
    this.flag = mesh(flagGeo, flagMat, 'Pennant');
    const tallest = squareMasts.reduce<(typeof squareMasts)[number] | undefined>(
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
    const fill = side * Math.max(0.08, 1 - p.luff) + p.luff * Math.sin(p.time * 26) * 0.35;
    for (const gaff of this.gaffSails) {
      gaff.pivot.rotation.y = p.boomAngle;
      // Lower cloth and gaff along the mast, keeping the boom at its fixed gooseneck.
      gaff.pivot.scale.y = 0.06 + 0.94 * p.sail;
      gaff.sail.scale.x = fill;
      gaff.pivot.updateMatrix();
    }
    // Yards brace against the boom: square when running, hard round (up to 40°) close-hauled,
    // the leeward yard-arms aft; the brace eases through zero as the boom crosses in a tack.
    // Square sails always fill toward the bow.
    const boom = Math.abs(p.boomAngle);
    const brace =
      -Math.sign(p.boomAngle) *
      MAX_BRACE *
      (1 - Math.min(1, Math.max(0, (boom - CLOSE_BOOM) / (RUN_BOOM - CLOSE_BOOM)))) *
      Math.min(1, boom / CLOSE_BOOM);
    const square = Math.max(0.08, 1 - p.luff) + p.luff * Math.sin(p.time * 26) * 0.2;
    for (const rig of this.squareRigs) {
      rig.turn.rotation.y = brace;
      rig.turn.updateMatrix();
      rig.sails.morphTargetInfluences![0] = 1 - p.sail;
      rig.sails.scale.z = square;
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
      // Each course's clews sheet home to the yard-arms below it; the lowest course's to the rail.
      const reef = 0.06 + 0.94 * p.sail;
      for (const rig of this.squareRigs)
        rig.courses.forEach((c, k) => {
          for (const s of [-1, 1]) {
            const below = rig.courses[k - 1];
            if (below) {
              const arm = rig.yardArms[k - 1]!;
              this.putLinePoint(
                pos,
                i++,
                this.tmp.set(s * arm, below.yard, 0).applyMatrix4(rig.turn.matrix),
              );
            } else this.putLinePoint(pos, i++, rig.rail[s < 0 ? 0 : 1]);
            this.tmp.set(s * c.half, c.yard - c.drop * reef, 0).applyMatrix4(rig.turn.matrix);
            this.putLinePoint(pos, i++, this.tmp);
          }
        });
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
  setNightLighting(night: number) {
    this.windowMaterial?.color
      .copy(CABIN_DAY)
      .lerp(CABIN_NIGHT, THREE.MathUtils.clamp(night, 0, 1));
  }
  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
