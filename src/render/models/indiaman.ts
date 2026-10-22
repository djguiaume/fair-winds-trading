import * as THREE from 'three';
import { STYLE_D as ST } from './boatStyle';
import { mergeAll, paint, triangleCount } from './geometry';
import { RefinedBoat, type HullShape } from './refinedBoat';
import type { ShipModelEntry } from './shipModels';
import type { BoatModelOptions } from './types';

const L = 13;
const DEPTH = 2;

/** Full bow, long parallel midbody and a broad square transom under the castle. The sections are
 * wall-sided with only a slight tumblehome and a firm bilge, unlike the fluyt's pear shape. */
const INDIAMAN_HULL: HullShape = {
  outline: [
    [0, 0.5],
    [0.22, 0.44],
    [0.38, 0.33],
    [0.47, 0.18],
    [0.5, 0.02],
    [0.5, -0.24],
    [0.47, -0.39],
    [0.42, -0.5],
    [-0.42, -0.5],
    [-0.47, -0.39],
    [-0.5, -0.24],
    [-0.5, 0.02],
    [-0.47, 0.18],
    [-0.38, 0.33],
    [-0.22, 0.44],
  ],
  rings: [
    { t: 0, beam: 1, length: 1 },
    { t: 0.3, beam: 1.04, length: 0.99 },
    { t: 0.66, beam: 0.96, length: 0.94 },
    { t: 1, beam: 0.5, length: 0.8 },
  ],
};

/** Painted gun ports along the upper strake, both sides, in reference units (z, bow +). */
export const INDIAMAN_PORTS = [-4.3, -2.8, -1.3, 0.2, 1.7, 3.2];
const PORT = { drop: 0.3, width: 0.34, height: 0.25, color: '#1d130b' };

/** Ports sit on the hull's own surface: each is cast in from abeam onto the authored sections. */
function gunPorts(hull: THREE.BufferGeometry) {
  const probe = new THREE.Mesh(hull, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const deckAt = (z: number) =>
    DEPTH * ST.H * 0.55 + ST.sheer * (L / 5) ** 0.5 * (z / (L / 2)) ** 2;
  const parts: THREE.BufferGeometry[] = [];
  for (const z of INDIAMAN_PORTS)
    for (const side of [-1, 1]) {
      ray.set(
        new THREE.Vector3(side * 5, deckAt(z) - PORT.drop, z),
        new THREE.Vector3(-side, 0, 0),
      );
      const hit = ray.intersectObject(probe)[0];
      if (!hit?.face) continue;
      const n = hit.face.normal.clone();
      if (n.x * side < 0) n.negate();
      const g = new THREE.PlaneGeometry(PORT.width, PORT.height);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n));
      const at = hit.point.addScaledVector(n, 0.012);
      g.translate(at.x, at.y, at.z);
      parts.push(paint(g, PORT.color));
    }
  (probe.material as THREE.Material).dispose();
  return parts;
}

/** Square fore and main, gaff mizzen on a long stern castle, two jibs (three from sails 2),
 * dark hull with red band and a row of painted ports. */
export class RefinedIndiaman extends RefinedBoat {
  private readonly extra: THREE.BufferGeometry[] = [];

  constructor(options: BoatModelOptions = {}) {
    super(
      {
        name: 'Indiaman',
        length: L,
        beam: 3.8,
        depth: DEPTH,
        hullShape: INDIAMAN_HULL,
        hull: '#5c3a1c',
        band: '#8a2f2f',
        squareMasts: [
          { name: 'Fore', z: 3.8, height: 9.6, courses: 3 },
          { name: 'Main', z: 0.4, height: 10.8, courses: 3 },
        ],
        mastZ: -3.8,
        mastHeight: 7.6,
        mainName: 'Mizzen',
        mainTopsail: false,
        boom: 2,
        gaff: 1.6,
        castle: { length: 4.4, height: 0.9 },
        stockJibs: 2,
        cargoExtra: 5,
        hatchZ: -1.3,
        cargoZ: 2.75,
        cargoX: 0.6,
      },
      options,
    );
    const hull = this.root.getObjectByName('IndiamanHull') as THREE.Mesh;
    const before = triangleCount(hull.geometry);
    hull.geometry = mergeAll([hull.geometry, ...gunPorts(hull.geometry)]);
    this.extra.push(hull.geometry);
    this.stats.triangles += triangleCount(hull.geometry) - before;
  }

  override dispose() {
    super.dispose();
    for (const g of this.extra) g.dispose();
  }
}

export const createIndiaman: ShipModelEntry = {
  refined: true,
  create: (options) => new RefinedIndiaman(options),
};
