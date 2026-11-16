import * as THREE from 'three';
import type { BoatCargo } from './boatDetails';
import { STYLE_D as ST } from './boatStyle';
import { paint } from './geometry';
import { V, spar, type RefinedRig } from './refinedRig';
import type { ShipUpgrades } from './types';

/*
 * The plain deck furniture the refined builder gives a class without its own deck details: the
 * forward hatch, the rudder and its tiller; and the cargo stacked for her hold level.
 */

const box = (w: number, h: number, l: number, x: number, y: number, z: number, color: string) =>
  paint(new THREE.BoxGeometry(w, h, l).translate(x, y, z), color);

/** Where the tiller turns: the rudder head, in ship-local coordinates (bow +Z). */
export function rudderHead(rig: RefinedRig, standAt: (z: number) => number) {
  const stern = -rig.length * 0.5;
  return V(0, standAt(stern) + 0.23, stern);
}

/** The tiller from the rudder head, pointing forward (+Z) and a touch to starboard. */
export function tillerGeometry(from: THREE.Vector3) {
  return spar(from, V(from.x + 0.12, from.y, from.z + 0.65));
}

/**
 * The forward hatch (it leaves a working area behind the mast for the upgraded cargo stacks), the
 * rudder and the rudder head; the tiller too unless it is drawn on its own (`withTiller` false:
 * the player's boat turns hers, boatCloseUp.ts).
 */
export function deckFittings(
  rig: RefinedRig,
  deckAt: (z: number) => number,
  standAt: (z: number) => number,
  depth: number,
  withTiller: boolean,
): THREE.BufferGeometry[] {
  const hatchZ = rig.hatchZ ?? (rig.foremast ? 2.65 : 1.3);
  const stern = -rig.length * 0.5;
  // The big hulls' rudder reaches down their deeper sternpost; the tiller works on the castle.
  const rudder = rig.castle ? depth * 0.8 : 0.72;
  const head = rudderHead(rig, standAt);
  const parts = [
    box(0.64, 0.13, 0.58, 0, deckAt(hatchZ) + 0.09, hatchZ, ST.mast),
    box(0.54, 0.05, 0.48, 0, deckAt(hatchZ) + 0.18, hatchZ, ST.deck),
    box(0.1, rudder, 0.32, 0, deckAt(stern) + 0.32 - rudder, stern - 0.1, ST.mast),
    spar(V(0, deckAt(stern) - 0.1, stern), head),
  ];
  if (withTiller) parts.push(tillerGeometry(head));
  return parts;
}

/** Her cargo for her hold level: crates and barrels, with each piece's box for the hold view. */
export function stowCargo(
  rig: RefinedRig,
  upgrades: ShipUpgrades,
  deckAt: (z: number) => number,
  layout: ReturnType<BoatCargo> | undefined,
) {
  const count = [2, 4, 7][upgrades.hold - 1]! + rig.cargoExtra;
  if (layout && layout.length !== count) throw new Error('Cargo layout must preserve hold counts');
  const parts: THREE.BufferGeometry[] = [];
  const bounds: THREE.Box3[] = [];
  let barrels = 0;
  for (let i = 0; i < count; i++) {
    const slot = i % 6;
    const x = layout?.[i]?.x ?? (slot % 2 === 0 ? -1 : 1) * (rig.cargoX ?? 0.3);
    const z =
      layout?.[i]?.z ?? (rig.cargoZ ?? 0) - Math.floor(slot / 2) * (rig.foremast ? 0.5 : 0.65);
    const layer = layout ? (layout[i]?.layer ?? 0) : Math.floor(i / 6);
    const barrel = layout?.[i]?.barrel ?? (upgrades.hold >= 2 && i % 3 === 2);
    const g = barrel
      ? new THREE.CylinderGeometry(0.21, 0.21, 0.42, 7)
      : new THREE.BoxGeometry(0.46, 0.42, 0.46);
    g.translate(x, deckAt(z) + 0.23 + layer * 0.43, z);
    g.computeBoundingBox();
    bounds.push(g.boundingBox!.clone());
    parts.push(paint(g, barrel ? ST.barrel : ST.crate));
    if (barrel) barrels++;
  }
  return { parts, bounds, barrels, crates: count - barrels };
}
