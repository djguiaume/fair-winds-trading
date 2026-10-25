import * as THREE from 'three';
import type { FlagDef } from '../../sim/regatta';

/*
 * A masthead flag from `flags.json` (decision 0216): a regatta pennant the captain has won, or
 * Kestrel's burgee. Flat triangles in the stock pennant's frame: the luff hangs from the masthead
 * down -Y, the fly streams out along -Z. Its bands run from the mast out, one colour each, as
 * vertex colours, so the flag stays one mesh and one draw call.
 */

/** How far into the fly a swallowtail's fork is cut, as a share of its length. */
const FORK = 0.7;

export function flagGeometry(flag: FlagDef): THREE.BufferGeometry {
  const L = flag.length;
  const H = flag.height;
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const tri = (a: number[], b: number[], d: number[], color: string) => {
    c.set(color);
    for (const p of [a, b, d]) {
      pos.push(0, p[1]!, -p[0]! * L);
      col.push(c.r, c.g, c.b);
    }
  };
  const quad = (a: number[], b: number[], d: number[], e: number[], color: string) => {
    tri(a, b, d, color);
    tri(a, d, e, color);
  };
  const bands = flag.bands.length ? flag.bands : ['#d2462f'];
  const n = bands.length;
  if (flag.shape === 'swallowtail') {
    // Bands over the solid part, the last one carried out into both tails.
    for (let i = 0; i < n; i++) {
      const f0 = (i / n) * FORK;
      const f1 = ((i + 1) / n) * FORK;
      quad([f0, 0], [f1, 0], [f1, -H], [f0, -H], bands[i]!);
    }
    const last = bands[n - 1]!;
    quad([FORK, 0], [1, 0], [1, -H * 0.25], [FORK, -H * 0.5], last);
    quad([FORK, -H * 0.5], [1, -H * 0.75], [1, -H], [FORK, -H], last);
  } else {
    // A triangle tapering to the fly's point at mid-height.
    const top = (f: number) => -(H / 2) * f;
    const bottom = (f: number) => -H + (H / 2) * f;
    for (let i = 0; i < n; i++) {
      const f0 = i / n;
      const f1 = (i + 1) / n;
      quad([f0, top(f0)], [f1, top(f1)], [f1, bottom(f1)], [f0, bottom(f0)], bands[i]!);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
