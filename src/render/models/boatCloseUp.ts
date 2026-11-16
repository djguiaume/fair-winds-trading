import * as THREE from 'three';
import { TUNING } from '../../data/tuning';
import { DEG, clamp } from '../../sim/math';
import type { BoatLook } from './boatLook';
import { STYLE_D as ST } from './boatStyle';
import { mergeAll, paint } from './geometry';
import { buildProp } from './propRecipe';
import { V, halfBeamAt, spar } from './refinedRig';
import type { BoatPose } from './types';

/*
 * The player's boat seen up close (issue #553, decision 0326): a helmsman at a tiller that turns
 * with the helm, a hand or two on the bigger ships, coiled lines on deck, and sails that belly
 * more off the wind than close-hauled. The far and Low model stays as it was: the crew hides
 * unless the camera is near, and the hull carries only two small coils more.
 * Numbers in `graphics.json › closeUp`.
 */

/** Where the close-up parts stand on one ship, in her own frame (bow +Z). */
export interface CloseUpPlan {
  /** The class id, for its number of hands. */
  id: string;
  length: number;
  /** The rudder head, where the tiller turns. */
  rudderHead: THREE.Vector3;
  /** The deck she stands on at a station, and her outline (for her width there). */
  standAt: (z: number) => number;
  outline: THREE.Vector3[];
  /** The mast foot, where the halyards are coiled. */
  mastFoot: THREE.Vector3;
  look: BoatLook;
  /** Her own tiller turns; false for classes whose deck details carry a fixed helm. */
  tiller: boolean;
}

const TILLER = 0.65;
/** Where the helmsman stands beside the tiller's end, and the hands along the weather rail. */
const HELM_AT = 0.55;
const RAIL_SHARE = 0.62;

/** How many hands besides the helmsman this class carries up close. */
export function handsAboard(id: string): number {
  const c = TUNING.graphics.closeUp;
  const hands = (c.hands as Record<string, number>)[id] ?? 0;
  return Math.max(0, Math.round(hands + c.extraHands));
}

/**
 * How full the sails stand for a boom swung `boomAngle` radians: flatter close-hauled (boom
 * near 12°), fuller running (near 80°), as a sailor trims them.
 */
export function bellyFor(boomAngle: number): number {
  const c = TUNING.graphics.closeUp;
  const t = clamp((Math.abs(boomAngle) - 12 * DEG) / (68 * DEG), 0, 1);
  return c.bellyCloseHauled + (c.bellyRunning - c.bellyCloseHauled) * t;
}

/** The coiled lines the hull carries on the player's boat: at the mast foot and by the helm. */
export function deckCoils(plan: CloseUpPlan): THREE.BufferGeometry[] {
  if (!TUNING.graphics.closeUp.coils) return [];
  const coil = (x: number, y: number, z: number) =>
    paint(
      new THREE.TorusGeometry(0.12, 0.035, 3, 8).rotateX(Math.PI / 2).translate(x, y + 0.03, z),
      ST.rigging,
    );
  const { mastFoot, rudderHead } = plan;
  const helmZ = rudderHead.z + 0.25;
  return [coil(0.22, mastFoot.y, mastFoot.z - 0.3), coil(-0.3, plan.standAt(helmZ), helmZ)];
}

/**
 * The moving close-up parts: the tiller on its rudder head, and the crew, one mesh that crosses
 * to the weather side in a tack and leans out against the heel. Both are added to the ship by
 * the caller and posed each frame without allocating.
 */
export class BoatCloseUp {
  /** Turns about the rudder head with the helm. */
  readonly helm = new THREE.Group();
  /** Every crew member, one mesh; crosses the deck and leans out as one. */
  readonly crew = new THREE.Group();
  private readonly crewX: number;
  private side = 1;
  private lastTime = 0;
  /** Near until told otherwise (the model sheet); the game sets it every frame. */
  private near = true;

  constructor(plan: CloseUpPlan, mesh: (g: THREE.BufferGeometry, name: string) => THREE.Mesh) {
    this.helm.name = 'Helm';
    this.helm.position.copy(plan.rudderHead);
    if (plan.tiller) this.helm.add(mesh(spar(V(0, 0, 0), V(0, 0, TILLER)), 'Tiller'));
    // The crew group turns about the deck line, so leaning out pivots them at their feet.
    const deck = plan.rudderHead.y - 0.23;
    const helmZ = plan.rudderHead.z + HELM_AT;
    const places = [helmZ];
    const hands = handsAboard(plan.id);
    for (let k = 0; k < hands; k++) places.push(plan.rudderHead.z + plan.length * (0.3 + 0.16 * k));
    this.crewX = halfBeamAt(plan.outline, helmZ) * RAIL_SHARE;
    const people = places.map((z) =>
      sailor(plan.look).map((g) => g.translate(0, plan.standAt(z) - deck, z)),
    );
    this.crew.name = 'Crew';
    this.crew.position.y = deck;
    this.crew.add(mesh(mergeAll(people.flat()), 'Sailors'));
  }

  /** Shows the crew while the camera is near (the far view keeps today's empty deck). */
  setNear(near: boolean) {
    this.near = near;
    this.crew.visible = near;
  }

  update(p: BoatPose) {
    const c = TUNING.graphics.closeUp;
    // The tiller goes to the side opposite the turn: to port to turn her to starboard.
    this.helm.rotation.y = (p.rudder ?? 0) * c.tillerDeg * DEG;
    this.helm.updateMatrix();
    // The weather side is opposite the boom; the crew walks across while she tacks.
    const weather = p.boomAngle < 0 ? -1 : 1;
    const dt = clamp(p.time - this.lastTime, 0, 0.1);
    this.lastTime = p.time;
    if (!this.near) {
      this.side = weather;
      return;
    }
    const step = dt / Math.max(0.05, c.crossSeconds / 2);
    this.side += clamp(weather - this.side, -step, step);
    const lean = Math.min(c.hikeMaxDeg * DEG, Math.abs(p.heel) * c.hikeShare);
    this.crew.position.x = this.side * this.crewX;
    this.crew.rotation.z = -this.side * lean;
  }
}

/** One sailor in the boat's colours (decision 0263): a coat in her band, a cap in her sail band. */
function sailor(look: BoatLook): THREE.BufferGeometry[] {
  const parts = buildProp('boat-sailor', {
    R: 1,
    style: 'fish',
    variant: 0,
    shape: 0.5,
    size: 1,
    colors: { coats: [look.hullBand], cap: look.sailBand },
  });
  const size = TUNING.graphics.closeUp.crewSize;
  for (const g of parts) g.scale(size, size, size);
  return parts;
}
