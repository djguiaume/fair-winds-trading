import * as THREE from 'three';
import type { BoatLook } from './boatLook';
import { cloth, type ClothDress } from './sailCloth';
import { V } from './refinedRig';
import { SQUARE_BELLY, SQUARE_FORWARD } from './squareRig';

/** One jib: its stay axis, its cloth and its clew in the axis' frame. */
export interface Headsail {
  axis: THREE.Group;
  sail: THREE.Mesh;
  clew: THREE.Vector3;
}

/** Where the jibs are set and how they are dressed. */
export interface HeadsailPlan {
  /** Jibs to set, and how many the class carries as stock (2+ = a multi-jib rig). */
  count: number;
  stockJibs: number;
  length: number;
  /** The stemhead, where the bowsprit starts. */
  bow: THREE.Vector3;
  /** The mast the stays run to: its foot height, height and station. */
  mast: { base: number; height: number; z: number };
  /** Square riggers hank their jibs forward of the foremast's courses (decision 0079). */
  square: boolean;
  deckAt: (z: number) => number;
  sails: number;
  look: BoatLook;
  dress: ClothDress;
  mesh: (g: THREE.BufferGeometry, name: string) => THREE.Mesh;
}

/**
 * The jibs. Each upgraded jib has its OWN head/tack pair and inclined stay axis. Do not merge
 * their pivots or scale along the stay: reefing rolls the free edge towards the stay instead.
 * Returns the sails and each stay's ends (tack, top) for the standing rigging.
 */
export function buildHeadsails(plan: HeadsailPlan) {
  const { bow, mast, length: L } = plan;
  const sails: Headsail[] = [];
  const stays: Array<[THREE.Vector3, THREE.Vector3]> = [];
  for (let j = 0; j < plan.count; j++) {
    // Multi-jib rigs: a low inner staysail and narrower outer jibs, rather than nested copies.
    // Their tack points sit exactly on the solid bowsprit, including the extra upgraded jib.
    const multiJib = plan.stockJibs >= 2;
    const tackFraction = multiJib ? 0.48 + j * 0.12 : 0.53 + j * 0.13;
    const tackY = multiJib ? bow.y - 0.1 + (0.3 * (tackFraction - 0.35)) / 0.38 : bow.y + j * 0.1;
    let tack = V(0, tackY, L * tackFraction);
    let head = V(
      0,
      mast.base + mast.height * (multiJib ? 0.68 + j * 0.14 : 0.76 + j * 0.15),
      mast.z,
    );
    let clew = V(
      0,
      mast.base + 0.8 + j * 0.1,
      mast.z + (multiJib ? 0.65 + j * 0.85 : 0.35 + j * 0.22),
    );
    let stayTop = head;
    if (plan.square) {
      // Square riggers: each stay runs from the masthead, above the top yard, to the bowsprit,
      // and the jib is hanked on its lower part only, so the whole jib stays forward of the
      // foremast's courses and their belly (decision 0079).
      const t = 0.56 + j * 0.1;
      tack = V(0, bow.y - 0.1 + (0.3 * (t - 0.35)) / 0.38, L * t);
      stayTop = V(0, mast.base + mast.height - 0.1 - j * 0.25, mast.z);
      const clearZ = mast.z + SQUARE_FORWARD + SQUARE_BELLY + 0.25;
      head = stayTop.clone().lerp(tack, (clearZ - stayTop.z) / (tack.z - stayTop.z));
      clew = V(0, plan.deckAt(clearZ) + 1 + j * 0.2, clearZ + 0.55 + j * 0.9);
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
    const g = cloth(V(0, 0, 0), c, h, h, plan.sails, 0.22, plan.look, 6, 6, plan.dress);
    const sail = plan.mesh(g, `Jib${j + 1}`);
    axis.add(sail);
    sails.push({ axis, sail, clew: c });
    stays.push([tack, stayTop]);
  }
  return { sails, stays };
}
