import type * as THREE from 'three';
import { STYLE_D as ST } from './boatStyle';
import { Faces } from './hullGeometry';
import { V, deckOutline, halfBeamAt, type RefinedRig } from './refinedRig';

/**
 * Raised stern deck that follows the hull's own stern outline: walls flush with the topsides,
 * a deck on top, a forward bulkhead, a rail, and stern windows. Hull 2 paints its upper strake
 * in the class colour, like the hull band.
 */
export function castleGeometry(level: number, rig: RefinedRig, band: string) {
  const { length: L, castle } = rig;
  const f = new Faces();
  if (!castle) return f.geometry();
  const outline = deckOutline(rig);
  const front = -L / 2 + castle.length;
  const ch = castle.height * ST.H;
  const poly: THREE.Vector3[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    if (a.z <= front) poly.push(a);
    if ((a.z - front) * (b.z - front) < 0)
      poly.push(a.clone().lerp(b, (front - a.z) / (b.z - a.z)));
  }
  // Rotate so the polygon starts at the starboard crossing: walls run round the stern, and the
  // closing edge is the forward bulkhead.
  const start = poly.findIndex((p) => Math.abs(p.z - front) < 1e-9 && p.x > 0);
  const ring = [...poly.slice(start), ...poly.slice(0, start)];
  const up = (p: THREE.Vector3, h: number) => V(p.x, p.y + h, p.z);
  const top = V(0, ring.reduce((y, p) => y + p.y, 0) / ring.length + ch, (front - L / 2) / 2);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const bulkhead = i === ring.length - 1;
    f.quad(up(a, ch * 0.72), a, b, up(b, ch * 0.72), rig.hull);
    f.quad(up(a, ch), up(a, ch * 0.72), up(b, ch * 0.72), up(b, ch), level >= 2 ? band : rig.hull);
    f.tri(top, up(a, ch), up(b, ch), ST.deck);
    if (bulkhead) continue;
    // Low rail round the castle edge: outer face and cap.
    const ai = V(a.x * 0.92, a.y, a.z * 0.985);
    const bi = V(b.x * 0.92, b.y, b.z * 0.985);
    f.quad(up(a, ch + 0.14), up(a, ch), up(b, ch), up(b, ch + 0.14), rig.hull);
    f.quad(up(ai, ch + 0.14), up(a, ch + 0.14), up(b, ch + 0.14), up(bi, ch + 0.14), ST.deck);
  }
  // Stern windows on the transom: warm lit panes in dark frames.
  const sternX = halfBeamAt(outline, -L / 2 + 1e-3);
  const z = -L / 2 - 0.012;
  const sternY = ST.sheer * (L / 5) ** 0.5 + rig.depth * ST.H * 0.55;
  const count = 3;
  for (let k = 0; k < count; k++) {
    const cx = ((k + 0.5) / count - 0.5) * sternX * 1.5;
    const w = (sternX * 1.5) / count - 0.12;
    const y0 = sternY + ch * 0.25;
    const y1 = sternY + ch * 0.62;
    f.quad(
      V(cx - w / 2, y0, z),
      V(cx - w / 2, y1, z),
      V(cx + w / 2, y1, z),
      V(cx + w / 2, y0, z),
      '#f2c66d',
    );
  }
  return f.geometry();
}
