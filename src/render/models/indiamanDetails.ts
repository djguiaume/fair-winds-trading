import * as THREE from 'three';
import type { BoatDetailContext } from './boatDetails';
import { STYLE_D as ST } from './boatStyle';
import { glowing, paint } from './geometry';
import { INDIAMAN_HULL } from '../../sim/hullShape';

/** A broad merchant flagship: full shoulders and a substantial, flat transom. */

// The mizzen rises through the quarterdeck, rather than standing forward of a
// detached stern hut. Keep the old absolute masthead; foot is above main deck.
const LOWER_ROOF = 2 * ST.H * 0.55 + ST.sheer * Math.sqrt(13 / 5) * 0.98 ** 2 + 1.1;
export const INDIAMAN_MIZZEN = {
  deck: LOWER_ROOF + 0.065,
  foot: 2.75,
  aft: 2.3,
  sheet: { z: -5.7, y: LOWER_ROOF + 0.465 },
};

/** Large readable fittings share one vertex-coloured hull mesh after merging. */
export function indiamanDetails(c: BoatDetailContext): THREE.BufferGeometry[] {
  const { length: L, beam: B, deckAt, upgrades } = c;
  const parts: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, l: number, x: number, y: number, z: number, color: string) => {
    parts.push(paint(new THREE.BoxGeometry(w, h, l).translate(x, y, z), color));
  };
  const spar = (a: THREE.Vector3, b: THREE.Vector3, r: number, color: string) => {
    const delta = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(r, r, delta.length(), 5);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()),
    );
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(paint(g, color));
  };
  const trim = upgrades.hull >= 2 ? c.band : ST.mast;
  const stern = -L * 0.5;
  // The broad raised stern is the flagship's defining silhouette. Its lower
  // vertices follow the sheer; the quarterdeck runs forward beneath the mizzen.
  // The RMG Dutch East Indiaman (SLR0365) has a substantial continuous raised
  // afterbody, with a distinct higher poop, rather than a tiny isolated cabin.
  const frontZ = -L * 0.23;
  const cabinAft = -L * 0.49;
  const lowerRoof = deckAt(cabinAft) + 1.1;
  const upperRoof = lowerRoof + 0.4;
  const cabinWidth = B * 0.72;
  const raisedCabin = (width: number, front: number, aft: number, roof: number, base?: number) => {
    const g = new THREE.BoxGeometry(width, 1, front - aft);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i) + (front + aft) / 2;
      // Slightly sloping walls avoid the old rectangular block appearance.
      const top = pos.getY(i) > 0;
      pos.setXYZ(i, pos.getX(i) * (top ? 0.96 : 1), top ? roof : (base ?? deckAt(z) - 0.02), z);
    }
    g.computeVertexNormals();
    parts.push(paint(g, c.hull));
  };
  raisedCabin(cabinWidth, frontZ, cabinAft, lowerRoof);
  box(
    B * 0.74,
    0.065,
    frontZ - cabinAft + 0.06,
    0,
    lowerRoof + 0.0325,
    (frontZ + cabinAft) / 2,
    ST.deck,
  );
  const upperFront = -L * 0.39;
  raisedCabin(B * 0.63, upperFront, cabinAft, upperRoof, lowerRoof + 0.05);
  box(
    B * 0.65,
    0.065,
    upperFront - cabinAft + 0.07,
    0,
    upperRoof + 0.0325,
    (upperFront + cabinAft) / 2,
    ST.deck,
  );
  // Five panes sit on the cabin's actual aft wall, above the hull sheer.
  const galleryY = lowerRoof - 0.43;
  const galleryZ = cabinAft - 0.027;
  box(B * 0.635, 0.64, 0.07, 0, galleryY, cabinAft - 0.005, trim);
  for (const x of [-0.21, -0.105, 0, 0.105, 0.21]) {
    box(B * 0.087, 0.41, 0.075, B * x, galleryY, galleryZ - 0.02, ST.sail);
    parts.push(
      glowing(
        paint(
          new THREE.BoxGeometry(B * 0.067, 0.3, 0.018).translate(B * x, galleryY, galleryZ - 0.065),
          '#b18a50',
        ),
      ),
    );
    box(0.025, 0.31, 0.025, B * x, galleryY, galleryZ - 0.078, ST.sail);
  }
  box(B * 0.65, 0.065, 0.16, 0, galleryY - 0.35, cabinAft - 0.025, ST.deck);
  box(B * 0.65, 0.07, 0.12, 0, galleryY + 0.35, cabinAft - 0.025, trim);
  // Open rails keep the two levels readable rather than making another solid box.
  const rail = (x1: number, z1: number, x2: number, z2: number, floor: number) => {
    spar(
      new THREE.Vector3(x1, floor + 0.34, z1),
      new THREE.Vector3(x2, floor + 0.34, z2),
      0.035,
      trim,
    );
    for (let i = 0; i <= 3; i++) {
      const t = i / 3;
      box(0.05, 0.3, 0.05, x1 + (x2 - x1) * t, floor + 0.17, z1 + (z2 - z1) * t, ST.mast);
    }
  };
  for (const side of [-1, 1]) {
    rail(side * B * 0.35, frontZ, side * B * 0.35, upperFront, lowerRoof + 0.065);
    rail(side * B * 0.3075, upperFront, side * B * 0.3075, cabinAft, upperRoof + 0.065);
  }
  rail(-B * 0.3075, cabinAft, B * 0.3075, cabinAft, upperRoof + 0.065);
  // The quarterdeck front has an entrance and an outboard stair: cargo stays
  // ahead of it and the central mizzen passage remains open.
  box(B * 0.72, 0.09, 0.08, 0, lowerRoof - 0.16, frontZ + 0.025, trim);
  // A central door and a separate broad starboard stair leave access legible.
  const doorBase = deckAt(frontZ);
  box(B * 0.145, 0.8, 0.07, -B * 0.1, doorBase + 0.4, frontZ + 0.035, ST.mast);
  box(B * 0.17, 0.065, 0.1, -B * 0.1, doorBase + 0.84, frontZ + 0.035, ST.sail);
  box(0.045, 0.045, 0.035, -B * 0.05, doorBase + 0.4, frontZ + 0.085, trim);
  const stairStart = frontZ + 0.92;
  const stairBase = deckAt(stairStart);
  for (let i = 0; i < 5; i++) {
    const top = stairBase + ((lowerRoof + 0.065 - stairBase) * (i + 1)) / 5;
    const z = stairStart - i * 0.19;
    const base = deckAt(z);
    box(B * 0.17, top - base, 0.21, B * 0.25, (top + base) / 2, z, ST.deck);
  }
  for (let i = 0; i < 2; i++)
    box(
      B * 0.2,
      (i + 1) * 0.2,
      0.19,
      0,
      lowerRoof + 0.065 + ((i + 1) * 0.2) / 2,
      upperFront + 0.28 - i * 0.18,
      ST.deck,
    );
  // Forward main hatch stays clear of cargo and the foremast.
  const hz = L * 0.17;
  box(B * 0.3, 0.14, L * 0.105, 0, deckAt(hz) + 0.1, hz, ST.mast);
  box(B * 0.27, 0.055, L * 0.095, 0, deckAt(hz) + 0.195, hz, ST.deck);
  for (const x of [-0.075, 0.075])
    box(0.055, 0.025, L * 0.095, x * B, deckAt(hz) + 0.235, hz, ST.mast);
  // Low foredeck windlass with sturdy upright cheeks.
  const wz = L * 0.374;
  for (const side of [-1, 1]) box(0.11, 0.3, 0.21, side * B * 0.16, deckAt(wz) + 0.17, wz, ST.mast);
  spar(
    new THREE.Vector3(-B * 0.23, deckAt(wz) + 0.25, wz),
    new THREE.Vector3(B * 0.23, deckAt(wz) + 0.25, wz),
    0.085,
    ST.barrel,
  );
  // Follow the hull's raked sternpost down to the immersed blade. The bottom
  // ring retreats forward, so a vertical stock at the deck transom would float
  // behind the underwater hull instead of meeting its lower hinge.
  const post = INDIAMAN_HULL.rings.map(({ t, length }) => {
    const z = stern * length;
    return new THREE.Vector3(0, deckAt(z) - c.depth * t + (t === 0 ? 0.08 : 0), z - 0.04);
  });
  for (let i = 1; i < post.length; i++) {
    spar(post[i - 1]!, post[i]!, 0.075, ST.mast);
    parts[parts.length - 1]!.userData.rudderSupport = true;
  }
  const upperHinge = post[2]!;
  const lowerHinge = post[3]!;
  // A broad, tapered stern-hung blade crosses calm water (y = 0), with its
  // submerged tip just below the aft keel and well above the central keel.
  const bladeBottom = Math.min(lowerHinge.y - 0.09, -0.64);
  const outline = new THREE.Shape();
  outline.moveTo(-upperHinge.z, upperHinge.y + 0.22);
  outline.lineTo(-upperHinge.z + 0.68, upperHinge.y + 0.14);
  outline.lineTo(-lowerHinge.z + 0.77, bladeBottom + 0.08);
  outline.lineTo(-lowerHinge.z + 0.54, bladeBottom);
  outline.lineTo(-lowerHinge.z, lowerHinge.y);
  outline.lineTo(-upperHinge.z, upperHinge.y);
  outline.closePath();
  const blade = new THREE.ExtrudeGeometry(outline, {
    depth: 0.15,
    bevelEnabled: false,
    steps: 1,
  });
  blade.rotateY(Math.PI / 2);
  blade.translate(-0.075, 0, 0);
  blade.userData.rudder = true;
  parts.push(paint(blade, upgrades.hull >= 3 ? ST.copper : ST.mast));
  return parts;
}

export { INDIAMAN_HULL } from '../../sim/hullShape';
