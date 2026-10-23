import * as THREE from 'three';
import { STYLE_D as ST } from './boatStyle';
import { glowing, paint } from './geometry';
import type { BoatDetailContext } from './boatDetails';
import { HULL_DIMENSIONS, FLUYT_HULL } from '../../sim/hullShape';

/** Keep the merchant's raised stern; the mizzen is fitted above it, not vice versa. */
export const FLUYT_STERN = { front: -0.23, back: -0.465, height: 1.02, rail: 0.29 };
const fluytLength = HULL_DIMENSIONS.fluyt!.length;
// Absolute walkable roof surface, in the same local coordinates as the mast.
export const FLUYT_MIZZEN = {
  deck:
    1.8 * ST.H * 0.55 +
    ST.sheer * Math.sqrt(fluytLength / 5) * (FLUYT_STERN.back * 2) ** 2 +
    FLUYT_STERN.height +
    0.0775,
  foot: 2.05,
  aft: 2.05,
  sheet: { z: -4.9, y: 3.17 },
};

/** Single-layer side stowage leaves the mainmast, hatch and central passage clear. */
export function fluytCargo(
  c: BoatDetailContext,
): { x: number; z: number; layer?: number; barrel?: boolean }[] {
  const slots = [
    [-0.9, -0.85],
    [0.9, -0.85],
    [-0.9, -1.45],
    [0.9, -1.45],
    [-0.9, 0.85],
    [0.9, 0.85],
    [-0.9, 1.45],
    [0.9, 1.45],
    [-0.9, 2.05],
    [0.9, 2.05],
    [0.9, -2.05],
  ];
  return slots.slice(0, [6, 8, 11][c.upgrades.hold - 1]).map(([x, z], i) => ({
    x: x!,
    z: z!,
    layer: 0,
    barrel: c.upgrades.hold >= 2 && i % 3 === 2,
  }));
}

/** Long raised quarterdeck carries the mizzen and tapers into the narrow merchant stern. */
export function fluytDetails(c: BoatDetailContext): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const { length: L, beam: B, deckAt } = c;
  const box = (w: number, h: number, l: number, x: number, y: number, z: number, color: string) => {
    parts.push(paint(new THREE.BoxGeometry(w, h, l).translate(x, y, z), color));
  };
  const frontZ = L * FLUYT_STERN.front;
  const backZ = L * FLUYT_STERN.back;
  const cabinZ = (frontZ + backZ) / 2;
  const cabinLength = frontZ - backZ;
  const roofY = deckAt(backZ) + FLUYT_STERN.height;
  const cabin = new THREE.BoxGeometry(1, 1, cabinLength);
  const positions = cabin.attributes.position!;
  for (let i = 0; i < positions.count; i++) {
    const top = positions.getY(i) > 0;
    const z = cabinZ + positions.getZ(i);
    const towardFront = (z - backZ) / cabinLength;
    const width = B * (0.31 + towardFront * 0.33) * (top ? 0.9 : 1);
    positions.setXYZ(i, positions.getX(i) * width, top ? roofY : deckAt(z) + 0.025, z);
  }
  parts.push(paint(cabin, c.hull));
  // Tapered roof is a walkable quarterdeck, with the same narrow stern footprint.
  const roof = new THREE.BoxGeometry(1, 0.085, cabinLength + 0.07);
  const roofPositions = roof.attributes.position!;
  for (let i = 0; i < roofPositions.count; i++) {
    const z = cabinZ + roofPositions.getZ(i);
    const t = THREE.MathUtils.clamp((z - backZ) / cabinLength, 0, 1);
    roofPositions.setX(i, roofPositions.getX(i) * (B * (0.31 + t * 0.33) * 0.9 + 0.08));
    roofPositions.setY(i, roofPositions.getY(i) + roofY + 0.035);
    roofPositions.setZ(i, z);
  }
  parts.push(paint(roof, ST.deck));
  const windowY = roofY - 0.38;
  // Two modest framed rear panes and one per side share the nighttime glass pass.
  for (const side of [-1, 1]) {
    const x = side * B * 0.065;
    box(0.29, 0.34, 0.045, x, windowY, backZ - 0.017, ST.mast);
    parts.push(
      glowing(
        paint(
          new THREE.BoxGeometry(0.19, 0.24, 0.014).translate(x, windowY, backZ - 0.046),
          '#b18a50',
        ),
      ),
    );
    const sideX = side * B * 0.475 * 0.465;
    box(0.07, 0.34, 0.36, sideX, windowY, cabinZ, ST.mast);
    parts.push(
      glowing(
        paint(
          new THREE.BoxGeometry(0.018, 0.23, 0.25).translate(sideX + side * 0.045, windowY, cabinZ),
          '#b18a50',
        ),
      ),
    );
    // Four short posts and a continuous low rail on each tapered edge.
    for (const t of [0, 0.33, 0.67, 1]) {
      const z = backZ + t * cabinLength;
      const railX = side * (B * (0.31 + t * 0.33) * 0.45 - 0.015);
      box(0.065, 0.29, 0.065, railX, roofY + 0.22, z, ST.mast);
    }
    const rail = new THREE.BoxGeometry(0.075, 0.075, Math.hypot(cabinLength, B * 0.33 * 0.45));
    rail.rotateY(Math.atan2(side * B * 0.33 * 0.45, cabinLength));
    parts.push(
      paint(rail.translate(side * (B * 0.475 * 0.45 - 0.015), roofY + 0.37, cabinZ), ST.mast),
    );
  }
  box(B * 0.279, 0.075, 0.075, 0, roofY + 0.37, backZ, ST.mast);
  box(
    B * 0.29,
    0.09,
    0.055,
    0,
    roofY - 0.66,
    backZ - 0.025,
    c.upgrades.hull >= 2 ? c.band : ST.mast,
  );
  // A forward door and port-side steps connect the clear central working deck.
  box(0.38, 0.67, 0.055, 0.12, deckAt(frontZ) + 0.36, frontZ + 0.018, ST.mast);
  box(0.27, 0.55, 0.025, 0.12, deckAt(frontZ) + 0.35, frontZ + 0.055, ST.barrel);
  for (let i = 0; i < 5; i++) {
    const t = (i + 1) / 5;
    const z = frontZ + 0.53 * (1 - t);
    const y = deckAt(frontZ) + (roofY + 0.075 - deckAt(frontZ)) * t;
    box(0.4, 0.09, 0.18, -B * 0.17, y, z, ST.deck);
  }
  // The hatch lies ahead of the foremast, away from the original central cargo stacks.
  const hatchZ = L * 0.365;
  box(B * 0.28, 0.17, 0.68, 0, deckAt(hatchZ) + 0.1, hatchZ, ST.mast);
  box(B * 0.25, 0.055, 0.6, 0, deckAt(hatchZ) + 0.21, hatchZ, ST.deck);
  for (const x of [-0.19, 0.19])
    box(0.055, 0.018, 0.55, x, deckAt(hatchZ) + 0.247, hatchZ, ST.mast);
  // A short foredeck windlass supplies a readable working fitting at fleet-view distance.
  const windlassZ = L * 0.22;
  const windlassY = deckAt(windlassZ) + 0.25;
  for (const side of [-1, 1])
    box(0.12, 0.3, 0.2, side * B * 0.125, windlassY - 0.07, windlassZ, ST.mast);
  parts.push(
    paint(
      new THREE.CylinderGeometry(0.115, 0.115, B * 0.36, 6)
        .rotateZ(Math.PI / 2)
        .translate(0, windlassY + 0.07, windlassZ),
      ST.barrel,
    ),
  );
  // The rudder follows the raked sternpost down to the underwater hull.
  // Its blade reaches 30% of hull depth below water, still above the central keel.
  const sternZ = -L / 2;
  const sternProfile = FLUYT_HULL.rings.map(({ t, length }) => {
    const z = sternZ * length;
    return new THREE.Vector3(0, deckAt(z) - c.depth * t, z - 0.025);
  });
  const stockTop = sternProfile[0]!.clone().add(new THREE.Vector3(0, 0.14, 0));
  const stockPoints = [stockTop, ...sternProfile];
  for (let i = 1; i < stockPoints.length; i++) {
    const start = stockPoints[i - 1]!;
    const end = stockPoints[i]!;
    const direction = end.clone().sub(start);
    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    const support = paint(
      new THREE.CylinderGeometry(0.075, 0.075, direction.length(), 5)
        .applyQuaternion(
          new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.normalize(),
          ),
        )
        .translate(midpoint.x, midpoint.y, midpoint.z),
      ST.mast,
    );
    support.userData.rudderSupport = true;
    parts.push(support);
  }
  const bottomY = -c.depth * 0.3;
  const leading = sternProfile.slice(1).map((point) => ({ z: point.z - 0.025, y: point.y }));
  leading.push({ z: leading[leading.length - 1]!.z, y: bottomY });
  const bladeShape = new THREE.Shape();
  leading.forEach(({ z, y }, index) => {
    if (index === 0) bladeShape.moveTo(z, y);
    else bladeShape.lineTo(z, y);
  });
  for (const { z, y } of [...leading].reverse()) bladeShape.lineTo(z - L * 0.048, y);
  bladeShape.closePath();
  const blade = paint(
    new THREE.ExtrudeGeometry(bladeShape, { depth: 0.12, bevelEnabled: false })
      .rotateY(-Math.PI / 2)
      .translate(0.06, 0, 0),
    ST.mast,
  );
  blade.userData.rudder = true;
  parts.push(blade);
  box(0.1, 0.1, 0.65, 0, stockTop.y, stockTop.z + 0.275, ST.mast);
  return parts;
}

export { FLUYT_HULL } from '../../sim/hullShape';
