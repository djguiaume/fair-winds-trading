/**
 * Seeded smooth noise on the map plane (decision 0222): value noise on a unit lattice, eased
 * between corners, and its fractal sum. Plain numbers, no allocation, the same on every device,
 * so the ground's relief and colour mottling never depend on the renderer.
 */

/** A lattice corner's value in [-1, 1], from its integer coordinates and a seed. */
function corner(i: number, j: number, seed: number) {
  let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1103515245);
  n ^= n >>> 16;
  return (n & 0xffff) / 32767.5 - 1;
}

const ease = (t: number) => t * t * (3 - 2 * t);

/** Value noise in [-1, 1] at a point, one lattice cell per unit. */
export function valueNoise(x: number, y: number, seed: number): number {
  const i = Math.floor(x),
    j = Math.floor(y);
  const s = ease(x - i),
    t = ease(y - j);
  const a = corner(i, j, seed),
    b = corner(i + 1, j, seed),
    c = corner(i, j + 1, seed),
    d = corner(i + 1, j + 1, seed);
  return a + (b - a) * s + (c - a + (a - b - c + d) * s) * t;
}

/** Fractal noise: `octaves` layers, each twice the frequency and half the size; about [-1, 1]. */
export function fbm(x: number, y: number, seed: number, octaves = 3): number {
  let sum = 0,
    size = 1,
    total = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x, y, seed + o * 7919) * size;
    total += size;
    size /= 2;
    x *= 2;
    y *= 2;
  }
  return sum / total;
}

/**
 * A well-mixed hash of a seed and two integers, in [0, 1): stateless, so a pass that reads it
 * (the forests, decision 0236) can redo one corner of an island and get what a full pass would.
 */
export function hash01(seed: number, i: number, j: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ Math.imul(i | 0, 0xc2b2ae35), 0x27d4eb2f);
  h = Math.imul(h ^ Math.imul(j | 0, 0x165667b1), 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Sorted samples of `fbm`, per octave count: its distribution, measured once. */
const fbmSamples = new Map<number, Float32Array>();

/** The `fbm` value that a share `q` (0 to 1) of all points fall under. */
export function fbmQuantile(octaves: number, q: number): number {
  let sorted = fbmSamples.get(octaves);
  if (!sorted) {
    sorted = new Float32Array(4096);
    for (let k = 0; k < sorted.length; k++)
      sorted[k] = fbm((k % 64) * 0.37 + 0.13, Math.floor(k / 64) * 0.37 + 0.29, 7, octaves);
    sorted.sort();
    fbmSamples.set(octaves, sorted);
  }
  const k = Math.round(Math.min(1, Math.max(0, q)) * (sorted.length - 1));
  return sorted[k]!;
}
