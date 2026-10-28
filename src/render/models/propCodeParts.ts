import * as THREE from 'three';
import trafficBoats from '../../data/traffic-boats.json';
import { hullGeometry } from './hullGeometry';

type Scope = Record<string, number>;

/**
 * Shapes written in code, by name (the ship parts pattern, decision 0109). Each returns an
 * unpainted geometry; the recipe part colours and places it.
 */
export const CODE_PARTS: Record<string, (scope: Scope) => THREE.BufferGeometry> = {
  /** The planked hull on a working slipway: a lofted, open curved shell. */
  'slip-hull': () => {
    const vertices: number[] = [];
    const point = (section: number, arc: number) => {
      const t = section / 8,
        a = -Math.PI / 2 + (arc / 6) * Math.PI;
      const width = 0.12 + Math.pow(Math.sin(t * Math.PI), 0.65) * 1.05;
      return [Math.sin(a) * width, 1.25 - Math.cos(a) * width, -2.3 + t * 4.6];
    };
    for (let section = 0; section < 8; section++)
      for (let arc = 0; arc < 6; arc++) {
        const a = point(section, arc),
          b = point(section + 1, arc),
          c = point(section + 1, arc + 1),
          d = point(section, arc + 1);
        vertices.push(...a, ...b, ...c, ...a, ...c, ...d, ...c, ...b, ...a, ...d, ...c, ...a);
      }
    const hull = new THREE.BufferGeometry();
    hull.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    hull.computeVertexNormals();
    return hull;
  },
  /**
   * A fore-and-aft sail (decision 0215's other boats): flat, in the boat's centre plane, its luff
   * up the mast from the origin and its foot aft along −Z. `foot` and `luff` long, the head
   * `head` long, peaked up `peak` at the leech: a gaff or lug sail, or a jib-headed one at 0.
   * `cells` panels each way, filled out to one side by `belly`, like the player's cloth.
   */
  sail: (s) => {
    const foot = s.foot ?? 2;
    const luff = s.luff ?? 2;
    const head = s.head ?? 0;
    const peak = s.peak ?? 0;
    const belly = s.belly ?? 0;
    const cells = s.cells ?? 1;
    // Bottom edge tack to clew, top edge luff head to leech peak, bellied out to one side.
    const at = (u: number, v: number) => [
      belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * v),
      v * (luff + peak * u),
      -u * (foot * (1 - v) + Math.max(head, 0.01) * v),
    ];
    const v: number[] = [];
    for (let j = 0; j < cells; j++)
      for (let i = 0; i < cells; i++) {
        const a = at(i / cells, j / cells);
        const b = at((i + 1) / cells, j / cells);
        const c = at((i + 1) / cells, (j + 1) / cells);
        const d = at(i / cells, (j + 1) / cells);
        v.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    const sail = new THREE.BufferGeometry();
    sail.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    sail.computeVertexNormals();
    return sail;
  },
};

/** Boat hulls by id: length, beam, depth and the sections `hullGeometry` lofts. */
const HULLS = trafficBoats.hulls as Record<
  string,
  Omit<Parameters<typeof hullGeometry>[1], 'hull' | 'band' | 'rail'>
>;

/** A lofted boat hull (a recipe's `hull` part): topsides in `hull`, the strake and rail in `band`. */
export function boatHull(id: string, hull: string, band: string): THREE.BufferGeometry {
  const shape = HULLS[id];
  if (!shape) throw new Error(`Unknown boat hull "${id}"`);
  return hullGeometry(2, { ...shape, hull, band, rail: band });
}
