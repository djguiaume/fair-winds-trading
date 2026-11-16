import type * as THREE from 'three';
import { V, halfBeamAt, type MastSpot } from './refinedRig';
import type { PlacedSquareMast } from './squareRig';

/** Where a ship's masts stand, for her shrouds and the stays between her mastheads. */
export interface MastLayout {
  main: MastSpot;
  fore?: MastSpot;
  mizzen?: MastSpot;
  square: readonly PlacedSquareMast[];
  /** Scaled beam, deck outline and deck height; a castle leads the main shrouds to its rail. */
  beam: number;
  outline: THREE.Vector3[];
  deckAt: (z: number) => number;
  castle: boolean;
}

const top = (m: MastSpot) => V(0, m.base + m.height, m.z);

/** Each shroud and mast-to-mast stay as its two ends, in ship-local coordinates (bow +Z). */
export function shrouds(ship: MastLayout): Array<[THREE.Vector3, THREE.Vector3]> {
  const { main, fore, mizzen, beam: B, outline, deckAt } = ship;
  const out: Array<[THREE.Vector3, THREE.Vector3]> = [];
  const line = (a: THREE.Vector3, b: THREE.Vector3) => out.push([a, b]);
  for (const side of [-1, 1]) {
    const head = V(0, main.base + main.height * 0.8, main.z);
    if (ship.castle)
      line(head, V(side * halfBeamAt(outline, main.z) * 0.9, main.base + 0.1, main.z));
    else line(head, V(side * B * 0.43, deckAt(0.15) + 0.1, 0.15));
  }
  // Square masts: shrouds to the rail on both sides, and a stay to the next mast aft.
  for (const [i, m] of ship.square.entries()) {
    const x = halfBeamAt(outline, m.z) * 0.92;
    for (const side of [-1, 1])
      for (const at of [0.42, 0.85])
        line(V(0, m.base + m.height * at, m.z), V(side * x, deckAt(m.z) + 0.15, m.z - 0.4));
    const aft = ship.square[i + 1];
    line(top(m), aft ? V(0, aft.base + aft.height * 0.9, aft.z) : top(main));
  }
  if (fore) {
    for (const side of [-1, 1])
      line(
        V(0, fore.base + fore.height * 0.8, fore.z),
        V(side * B * 0.43, deckAt(fore.z) + 0.1, fore.z),
      );
    line(top(main), top(fore));
  }
  if (mizzen) {
    for (const side of [-1, 1])
      line(top(mizzen), V(side * B * 0.38, deckAt(mizzen.z) + 0.1, mizzen.z));
    line(top(main), top(mizzen));
  }
  return out;
}
