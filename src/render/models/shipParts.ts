import * as THREE from 'three';
import { STYLE_D as ST } from './boatStyle';
import { paint } from './geometry';
import type { HullDetailContext, RefinedRig } from './refinedBoat';
import { clipperDetails } from './clipperDetails';
import { FLUYT_MIZZEN, fluytCargo, fluytDetails } from './fluytDetails';
import { hoyDetails } from './hoyDetails';
import { INDIAMAN_MIZZEN, indiamanDetails } from './indiamanDetails';
import { schoonerDetails } from './schoonerDetails';

/**
 * The code library of ship parts (decision 0109). A ship file names the parts it uses in
 * `model.parts`; each adds hand-built geometry the plain numbers of a rig cannot describe. A new
 * kind of part (a lateen rig, a paddle wheel) is written here once, then any ship can use it.
 */
export type ShipPart = Partial<
  Pick<
    RefinedRig,
    'details' | 'boatDetails' | 'replaceDeckDetails' | 'cargo' | 'sternLayout' | 'hullFinish'
  >
>;

const LEEBOARD_Z = 0.35;

/** Pear-shaped leeboard against each side, hung from the gunwale abreast the mast, as on
 * Dutch and Thames coasters. Merged into the hull mesh, so they cost no extra draw. */
function leeboards({ deckAt, halfBeam, depth }: HullDetailContext) {
  const top = deckAt(LEEBOARD_Z) + 0.16;
  const drop = depth * 0.78;
  const shape = new THREE.Shape();
  shape.moveTo(0.22, 0);
  shape.lineTo(-0.22, 0);
  shape.quadraticCurveTo(-0.7, -drop * 0.55, -0.62, -drop);
  shape.quadraticCurveTo(0, -drop * 1.12, 0.48, -drop * 0.9);
  shape.quadraticCurveTo(0.5, -drop * 0.45, 0.22, 0);
  const out: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.07,
      bevelEnabled: false,
      curveSegments: 3,
    });
    // Shape x runs along the hull, y down the side. Half hauled up, the foot swings aft and
    // tucks in to follow the flat sides, clear of the water at sea.
    g.rotateY(-Math.PI / 2).translate(0.035, 0, 0);
    g.rotateX(0.32).rotateZ(-side * 0.1);
    g.translate(side * (halfBeam + 0.08), top, LEEBOARD_Z);
    out.push(paint(g, ST.mast));
    // Pivot bolt head and the pendant block on the rail.
    out.push(
      paint(
        new THREE.BoxGeometry(0.14, 0.14, 0.14).translate(
          side * (halfBeam + 0.08),
          top - 0.08,
          LEEBOARD_Z,
        ),
        ST.barrel,
      ),
    );
  }
  return out;
}

/** Painted gun ports along the upper strake, both sides, in reference units (z, bow +). */
export const INDIAMAN_PORTS = [-4.3, -2.8, -1.3, 0.2, 1.7, 3.2];
const PORT = { drop: 0.3, width: 0.34, height: 0.25, color: '#1d130b' };

/** Ports sit on the hull's own surface: each is cast in from abeam onto the authored sections. */
function gunPorts(hull: THREE.BufferGeometry, deckAt: (z: number) => number) {
  const probe = new THREE.Mesh(hull, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
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

/** Every part a ship file can name. */
export const SHIP_PARTS: Record<string, ShipPart> = {
  /** Schooner deck house, fairleads and fittings. */
  'schooner-deck': { boatDetails: schoonerDetails },
  /** Clipper deck house, skylights and fittings. */
  'clipper-deck': { boatDetails: clipperDetails },
  /** Hoy hatch coamings and deck fittings, in place of the default hatch and tiller. */
  'hoy-deck': { boatDetails: hoyDetails, replaceDeckDetails: true },
  /** Leeboards on both sides, hung abreast the mast. */
  leeboards: { details: leeboards },
  /** Fluyt raised stern with windows, its mizzen platform and side cargo stowage. */
  'fluyt-stern': {
    boatDetails: fluytDetails,
    cargo: fluytCargo,
    sternLayout: FLUYT_MIZZEN,
    replaceDeckDetails: true,
  },
  /** Indiaman quarterdeck, stern gallery and mizzen platform. */
  'indiaman-stern': {
    boatDetails: indiamanDetails,
    sternLayout: INDIAMAN_MIZZEN,
    replaceDeckDetails: true,
  },
  /** A row of painted gun ports cast onto the hull sides (INDIAMAN_PORTS). */
  'gun-ports': { hullFinish: gunPorts },
};
