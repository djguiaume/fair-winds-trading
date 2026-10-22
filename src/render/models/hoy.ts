import { HULL_DIMENSIONS, HOY_HULL } from '../../sim/hullShape';
import * as THREE from 'three';
import { STYLE_D as ST } from './boatStyle';
import { paint } from './geometry';
import { RefinedBoat, type HullDetailContext } from './refinedBoat';
import type { ShipModelEntry } from './shipModels';
import type { BoatModelOptions } from './types';

/** Apple-cheeked bow, nearly parallel sides and a broad rounded stern on a flat, wide bottom:
 * a coastal carrier built to sit on a mudflat, unlike the swift line's fine V sections. */

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

/** Tier 1 hauler (0035): one tall gaff mast set forward, long boom raised over two layers of
 * deck cargo, one jib (two from sails 2), mustard band and leeboards. */
export class RefinedHoy extends RefinedBoat {
  constructor(options: BoatModelOptions = {}) {
    super(
      {
        name: 'Hoy',
        length: HULL_DIMENSIONS.hoy!.length,
        beam: HULL_DIMENSIONS.hoy!.beam,
        depth: 1.3,
        hullShape: HOY_HULL,
        hull: '#8f6a3a',
        band: '#c9a23a',
        mastZ: 0.9,
        mastHeight: 5.6,
        boom: 3.4,
        gaff: 1.7,
        gooseneck: 1.1,
        stockJibs: 1,
        cargoExtra: 2,
        hatchZ: 1.95,
        cargoZ: -0.2,
        cargoX: 0.46,
        details: leeboards,
      },
      options,
    );
  }
}

export const createHoy: ShipModelEntry = {
  refined: true,
  create: (options) => new RefinedHoy(options),
};
