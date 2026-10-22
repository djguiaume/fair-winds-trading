import * as THREE from 'three';
import type { BoatDetails } from './boatDetails';
import { STYLE_D as ST } from './boatStyle';
import { paint } from './geometry';

/** Low coach house and paired bow fairleads give the swift flagship a finished deck.
 * All parts join the existing hull mesh; the mizzen boom can sweep above the roof. */
export const clipperDetails: BoatDetails = ({ length, beam, deckAt, band, upgrades }) => {
  const parts: THREE.BufferGeometry[] = [];
  const trim = upgrades.hull >= 2 ? band : ST.mast;
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string) => {
    parts.push(paint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color));
  };

  // House ends ahead of the tiller's working arc and aft of the mizzen step.
  const houseZ = -length * 0.355;
  const deck = deckAt(houseZ);
  const width = beam * 0.36;
  box(width, 0.25, 0.78, 0, deck + 0.14, houseZ, ST.deck);
  box(width + 0.1, 0.065, 0.87, 0, deck + 0.298, houseZ, trim);
  box(width - 0.08, 0.035, 0.72, 0, deck + 0.348, houseZ, ST.mast);
  // A broad dark doorway and side lights remain readable at the fleet-view scale.
  box(0.25, 0.2, 0.018, 0, deck + 0.13, houseZ + 0.399, ST.mast);
  for (const side of [-1, 1]) {
    box(0.018, 0.11, 0.28, side * (width / 2 + 0.008), deck + 0.16, houseZ, '#38434b');
    box(0.025, 0.035, 0.34, side * (width / 2 + 0.012), deck + 0.085, houseZ, trim);
  }

  // Short paired bow rails flank the existing hatch and stay below the jib foot.
  // No central ornament crowds the forestay or the bowsprit attachment.
  for (const side of [-1, 1]) {
    const a = new THREE.Vector3(side * beam * 0.175, deckAt(length * 0.36) + 0.21, length * 0.36);
    const b = new THREE.Vector3(side * beam * 0.075, deckAt(length * 0.455) + 0.21, length * 0.455);
    const delta = b.clone().sub(a);
    const rail = new THREE.BoxGeometry(0.055, 0.065, delta.length());
    rail.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.normalize()),
    );
    rail.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(paint(rail, trim));
    for (const point of [a, b]) {
      const base = deckAt(point.z);
      box(0.075, point.y - base, 0.075, point.x, (base + point.y) / 2, point.z, ST.mast);
    }
  }
  return parts;
};
