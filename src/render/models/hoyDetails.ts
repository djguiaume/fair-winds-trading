import * as THREE from 'three';
import { STYLE_D as ST } from './boatStyle';
import type { BoatDetailContext } from './boatDetails';
import { paint } from './geometry';

/** A full-bellied coastal carrier: rounded bow, broad shoulders and a short transom. */

/** Large readable fittings, merged into the existing wood mesh by the caller. */
export function hoyDetails(c: BoatDetailContext): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, l: number, x: number, y: number, z: number, color: string) => {
    out.push(paint(new THREE.BoxGeometry(w, h, l).translate(x, y, z), color));
  };
  const spar = (a: THREE.Vector3, b: THREE.Vector3, r: number, color: string) => {
    const delta = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(r, r, delta.length(), 5);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()),
    );
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    out.push(paint(g, color));
  };

  // The foredeck hatch and its chunky coaming leave both the mast at +0.6 and
  // the entire upgraded cargo footprint aft of -0.5 clear at every hold level.
  const hatchZ = c.length * 0.29;
  const hatchY = c.deckAt(hatchZ);
  const hatchW = c.beam * 0.34;
  box(hatchW + 0.18, 0.1, 1.06, 0, hatchY + 0.07, hatchZ, ST.mast);
  box(hatchW, 0.2, 0.88, 0, hatchY + 0.2, hatchZ, c.hull);
  box(hatchW + 0.08, 0.07, 0.96, 0, hatchY + 0.335, hatchZ, ST.deck);
  for (const z of [-0.27, 0.27]) {
    box(hatchW + 0.1, 0.035, 0.07, 0, hatchY + 0.388, hatchZ + z, ST.mast);
  }
  // Two broad battens communicate a working hatch without fine surface noise.
  for (const x of [-1, 1]) {
    box(0.09, 0.12, 1.15, x * (hatchW / 2 + 0.16), hatchY + 0.1, hatchZ, ST.deck);
  }

  const stern = -c.length * 0.5;
  const sternY = c.deckAt(stern);
  box(0.13, c.depth * 0.64, 0.4, 0, sternY - c.depth * 0.34, stern - 0.12, ST.mast);
  box(0.16, 0.1, 0.38, 0, sternY - 0.21, stern - 0.12, c.upgrades.hull >= 2 ? c.band : ST.mast);
  spar(
    new THREE.Vector3(0, sternY - 0.24, stern),
    new THREE.Vector3(0, sternY + 0.28, stern),
    0.065,
    ST.mast,
  );
  spar(
    new THREE.Vector3(0, sternY + 0.28, stern),
    new THREE.Vector3(0.2, sternY + 0.28, stern + 0.62),
    0.055,
    ST.deck,
  );

  // Short mooring bitts flank the bowsprit; their caps read at gameplay scale.
  const bittZ = c.length * 0.405;
  for (const side of [-1, 1]) {
    const x = side * c.beam * 0.15;
    const y = c.deckAt(bittZ);
    box(0.13, 0.27, 0.14, x, y + 0.15, bittZ, ST.mast);
    box(0.23, 0.07, 0.2, x, y + 0.32, bittZ, ST.deck);
  }
  return out;
}

export { HOY_HULL } from '../../sim/hullShape';
