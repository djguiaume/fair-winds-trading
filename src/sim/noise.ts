/**
 * Seeded, stateless noise: the same inputs always give the same number, whatever was asked
 * before, so a pass that reads it (the forests, issue #275) can redo one corner of an island and
 * get exactly what a full pass would have put there.
 */

/** A well-mixed 32-bit hash of a seed and two integers, as a number in [0, 1). */
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

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise in [0, 1) over a unit lattice, smoothly blended between lattice points. */
export function valueNoise(seed: number, x: number, y: number): number {
  const i = Math.floor(x),
    j = Math.floor(y);
  const s = smooth(x - i),
    t = smooth(y - j);
  const a = hash01(seed, i, j),
    b = hash01(seed, i + 1, j),
    c = hash01(seed, i, j + 1),
    d = hash01(seed, i + 1, j + 1);
  return a + (b - a) * s + (c - a + (a - b - c + d) * s) * t;
}

/** Fractal noise in [0, 1): `octaves` layers of value noise, each twice as fine and half as strong. */
export function fbm(seed: number, x: number, y: number, octaves: number): number {
  let sum = 0,
    weight = 1,
    total = 0,
    f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(seed + o * 1013, x * f, y * f) * weight;
    total += weight;
    weight /= 2;
    f *= 2;
  }
  return sum / total;
}

/** Sorted samples of `fbm`, per octave count: its distribution, measured once. */
const fbmSamples = new Map<number, Float32Array>();

/** The `fbm` value that a share `q` (0 to 1) of all points fall under. */
export function fbmQuantile(octaves: number, q: number): number {
  let sorted = fbmSamples.get(octaves);
  if (!sorted) {
    sorted = new Float32Array(4096);
    for (let k = 0; k < sorted.length; k++)
      sorted[k] = fbm(7, (k % 64) * 0.37 + 0.13, Math.floor(k / 64) * 0.37 + 0.29, octaves);
    sorted.sort();
    fbmSamples.set(octaves, sorted);
  }
  const k = Math.round(Math.min(1, Math.max(0, q)) * (sorted.length - 1));
  return sorted[k]!;
}
