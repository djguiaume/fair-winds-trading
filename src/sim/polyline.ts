type Pt = [number, number];

/** Signed area of a ring (positive when counter-clockwise). */
export function ringArea(ring: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i]!;
    const [bx, by] = ring[(i + 1) % ring.length]!;
    sum += ax * by - bx * ay;
  }
  return sum / 2;
}

/** Douglas-Peucker on an open run of points, keeping its two ends. */
function simplifyRun(run: Pt[], epsilon: number): Pt[] {
  const first = run[0]!;
  const last = run.at(-1)!;
  let far = -1;
  let farDistance = epsilon;
  for (let i = 1; i < run.length - 1; i++) {
    const d = segmentDistance(run[i]!, first, last);
    if (d > farDistance) {
      far = i;
      farDistance = d;
    }
  }
  if (far < 0) return [first, last];
  return [
    ...simplifyRun(run.slice(0, far + 1), epsilon).slice(0, -1),
    ...simplifyRun(run.slice(far), epsilon),
  ];
}

function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq))
    : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}

/**
 * A closed ring (no repeated end point) with fewer points: Douglas-Peucker from the point
 * farthest from the first, so the result does not depend on where the ring happens to start.
 */
export function simplifyRing(ring: Pt[], epsilon: number): Pt[] {
  if (ring.length <= 3) return ring;
  let apart = 0;
  let apartDistance = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i]![0] - ring[0]![0], ring[i]![1] - ring[0]![1]);
    if (d > apartDistance) {
      apart = i;
      apartDistance = d;
    }
  }
  const half = simplifyRun(ring.slice(0, apart + 1), epsilon);
  const rest = simplifyRun([...ring.slice(apart), ring[0]!], epsilon);
  return [...half.slice(0, -1), ...rest.slice(0, -1)];
}

/** Is `p` inside the ring (even-odd)? */
export function ringContains(ring: Pt[], p: Pt): boolean {
  let inside = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

const side = (a: Pt, b: Pt, c: Pt) =>
  Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));

/** Do the segments ab and cd cross (touching ends count)? */
function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const abc = side(a, b, c),
    abd = side(a, b, d),
    cda = side(c, d, a),
    cdb = side(c, d, b);
  return abc !== abd && cda !== cdb;
}

/** True when any two edges of the rings, within one ring or across rings, cross or touch. */
export function ringsCross(rings: Pt[][]): boolean {
  const edges = rings.flatMap((ring, r) =>
    ring.map((a, i) => ({ r, i, n: ring.length, a, b: ring[(i + 1) % ring.length]! })),
  );
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const e = edges[i]!,
        f = edges[j]!;
      const neighbours = e.r === f.r && (f.i === e.i + 1 || (e.i === 0 && f.i === e.n - 1));
      if (!neighbours && segmentsCross(e.a, e.b, f.a, f.b)) return true;
    }
  return false;
}
