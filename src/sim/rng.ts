/**
 * Seeded pseudo-random generator (mulberry32). All game randomness goes through this so a map,
 * a wind pattern or a whole archipelago can be reproduced from a seed (decision 0008).
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform float in [min, max). */
export function range(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng();
}
