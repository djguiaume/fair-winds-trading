import * as THREE from 'three';
import { STYLE_D as ST } from './boatStyle';
import { paint } from './geometry';
import type { BoatDetailContext } from './boatDetails';

/** A low companionway makes the long aft working deck feel inhabited. */
export function schoonerDetails(c: BoatDetailContext): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, l: number, x: number, y: number, z: number, color: string) => {
    parts.push(paint(new THREE.BoxGeometry(w, h, l).translate(x, y, z), color));
  };
  // Behind the mainmast and cargo, ahead of the tiller. The roof is low enough
  // to pass under the main boom throughout its sweep, including the stern sheer.
  const z = -c.length * 0.275;
  const base = c.deckAt(z);
  const width = c.beam * 0.29;
  const trim = c.upgrades.hull >= 2 ? c.band : ST.mast;
  box(width, 0.28, 0.7, 0, base + 0.14, z, c.hull);
  box(width + 0.08, 0.065, 0.76, 0, base + 0.31, z, ST.deck);
  // A dark, framed entrance faces forward; a green sill repeats the hull trim.
  box(width * 0.52, 0.22, 0.025, 0, base + 0.13, z + 0.363, ST.rigging);
  box(width * 0.65, 0.055, 0.11, 0, base + 0.025, z + 0.39, trim);
  // Two broad runners describe a sliding hatch without fine surface clutter.
  for (const side of [-1, 1]) box(0.045, 0.035, 0.66, side * width * 0.34, base + 0.36, z, ST.mast);
  box(width * 0.7, 0.035, 0.055, 0, base + 0.36, z - 0.26, trim);
  return parts;
}
