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
