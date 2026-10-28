import * as THREE from 'three';
import { DEFAULT_DAMAGE } from '../../data/ships';
import { SLOOP_HULL } from '../../sim/hullShape';
import { STYLE_D as ST } from './boatStyle';
import type { RefinedRig } from './refinedBoat';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Simple coloured triangles: no textures, extra materials or per-frame geometry rebuilds. */
export class Faces {
  private pos: number[] = [];
  private colors: number[] = [];
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: string) {
    const k = new THREE.Color(color);
    for (const p of [a, b, c]) {
      this.pos.push(p.x, p.y, p.z);
      this.colors.push(k.r, k.g, k.b);
    }
  }
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: string) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.computeVertexNormals();
    return g;
  }
}

/** Class-specific deck outline and depth sections, with shared gunwale construction. */
export function hullGeometry(
  level: number,
  rig: Pick<RefinedRig, 'length' | 'beam' | 'depth' | 'hull' | 'band' | 'hullShape' | 'damage'> & {
    /** Paints the whole gunwale, cap included: the other boats' home colour, seen from above. */
    rail?: string;
  },
  damage = 0,
) {
  const { length: L, band: BAND, hull: HULL } = rig;
  const B = rig.beam * ST.B;
  const H = rig.depth * ST.H;
  const DECK = H * 0.55;
  const deckAt = (z: number) => DECK + ST.sheer * (L / 5) ** 0.5 * (z / (L / 2)) ** 2;
  const shape = rig.hullShape ?? SLOOP_HULL;
  const outline = shape.outline.map(([x, z]) => V(x * B, deckAt(z * L), z * L));
  const rings = shape.rings.map(({ t, beam, length }) =>
    outline.map((p) => V(p.x * beam, deckAt(p.z * length) - H * t, p.z * length)),
  );
  const f = new Faces();
  const strake = (r: number) =>
    r === 0 && level >= 2 ? BAND : r === 2 && level >= 3 ? ST.copper : HULL;
  const marks = rig.damage ?? DEFAULT_DAMAGE;
  // The outline segment nearest a damage station (decision 0208), on its side of the hull.
  const segmentAt = (p: { z: number; side: number }) => {
    let best = 0;
    let gap = Infinity;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]!;
      const b = outline[(i + 1) % outline.length]!;
      if (Math.sign(a.x + b.x) !== p.side) continue;
      const d = Math.abs((a.z + b.z) / 2 - p.z * L);
      if (d < gap) [best, gap] = [i, d];
    }
    return best;
  };
  const brokenRail = damage >= 2 ? segmentAt(marks.rail) : -1;
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    f.tri(V(0, DECK, 0), outline[i]!, outline[j]!, ST.deck);
    for (let r = 0; r < rings.length - 1; r++)
      f.quad(rings[r]![i]!, rings[r + 1]![i]!, rings[r + 1]![j]!, rings[r]![j]!, strake(r));
    const keel = rings[rings.length - 1]!;
    f.tri(V(0, DECK - H, 0), keel[j]!, keel[i]!, HULL);
    // A solid raised gunwale: outer face, cap and inner face follow the same sheer as the deck.
    // A badly knocked hull has lost its middle stretch on one side (decision 0208).
    const spans =
      i === brokenRail
        ? [
            [0, 0.3],
            [0.72, 1],
          ]
        : [[0, 1]];
    for (const [from, to] of spans) {
      const a = outline[i]!.clone().lerp(outline[j]!, from!);
      const b = outline[i]!.clone().lerp(outline[j]!, to!);
      const ai = V(a.x * 0.93, a.y, a.z * 0.98);
      const bi = V(b.x * 0.93, b.y, b.z * 0.98);
      const at = a.clone().add(V(0, 0.16, 0));
      const bt = b.clone().add(V(0, 0.16, 0));
      const ait = ai.clone().add(V(0, 0.16, 0));
      const bit = bi.clone().add(V(0, 0.16, 0));
      f.quad(a, b, bt, at, rig.rail ?? HULL);
      f.quad(at, bt, bit, ait, rig.rail ?? ST.deck);
      f.quad(ai, ait, bit, bi, rig.rail ?? HULL);
      if (spans.length > 1) {
        // The broken ends: the gunwale's cut section, in bare wood.
        const end = from === 0 ? [b, bi, bit, bt] : [a, at, ait, ai];
        f.quad(end[0]!, end[1]!, end[2]!, end[3]!, ST.deck);
        f.quad(end[3]!, end[2]!, end[1]!, end[0]!, ST.deck);
      }
    }
  }
  // Scuffs: warm darker patches laid just proud of the topsides at each station, a big one on the
  // top strake (the band from hull 2) and a smaller one on the strake below (decision 0208).
  if (damage >= 1)
    for (const mark of marks.scuffs) {
      const i = segmentAt(mark);
      const j = (i + 1) % outline.length;
      const at = (r: number, u: number, v: number) => {
        const top = rings[r]![i]!.clone().lerp(rings[r]![j]!, u);
        const p = top.lerp(rings[r + 1]![i]!.clone().lerp(rings[r + 1]![j]!, u), v);
        return p.add(V(mark.side * 0.035, 0, 0));
      };
      for (const [r, u0, u1, v0, v1] of [
        [0, 0.08, 0.62, 0.04, 0.9],
        [0, 0.5, 0.86, 0.3, 0.97],
        [1, 0.3, 0.7, 0.02, 0.55],
      ] as const)
        f.quad(at(r, u0, v0), at(r, u0, v1), at(r, u1, v1), at(r, u1, v0), scuffed(strake(r)));
      // The game camera looks down on her, so the knocks show on the deck inside the rail too:
      // scraped planks, laid on the deck's own fan triangle just above it.
      const deck = (u: number, w: number) =>
        V(0, DECK, 0)
          .lerp(outline[i]!.clone().lerp(outline[j]!, u), w)
          .add(V(0, 0.015, 0));
      for (const [u0, u1, w0, w1] of [
        [0.12, 0.58, 0.62, 0.9],
        [0.46, 0.8, 0.7, 0.94],
      ] as const)
        f.quad(deck(u0, w0), deck(u0, w1), deck(u1, w1), deck(u1, w0), scuffed(ST.deck));
    }
  return f.geometry();
}

/** A colour scuffed: mixed 40 % toward warm charcoal, never grey (decision 0208; a quarter was too faint). */
function scuffed(color: string) {
  return '#' + new THREE.Color(color).lerp(SCUFF, 0.4).getHexString();
}
const SCUFF = new THREE.Color('#2e2219');
