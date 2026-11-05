import { createRng, range } from '../sim/rng';
import { DEG } from '../sim/math';

/** `graphics.json` › `sky` › `clouds`: how many, where and how big (angles in degrees). */
export interface CloudShape {
  count: number;
  seed: number;
  baseDeg: readonly number[];
  widthDeg: readonly number[];
  heightDeg: readonly number[];
}

/** Clouds as triangles on the unit sky sphere, and each corner's height in its cloud (0 base … 1 top). */
export interface CloudMesh {
  positions: number[];
  shades: number[];
  indices: number[];
}

/** Corners of a lump: few, so the clouds read low-poly like the rest of the world (art bible). */
const LUMP_SIDES = 6;

/** A point on the unit sphere at a compass bearing and a height above the horizon (radians). */
function pushDirection(out: number[], bearing: number, elevation: number) {
  const flat = Math.cos(elevation);
  out.push(Math.sin(bearing) * flat, Math.sin(elevation), -Math.cos(bearing) * flat);
}

/**
 * Flat low-poly clouds round the horizon (issue #470): each a few six-sided lumps on one flat base,
 * spread evenly round the compass with a seeded jitter so the sky is the same every voyage. They sit
 * on the sky dome at infinity, so the chase camera's short band of sky (about 5°) shows their tops.
 */
export function buildClouds(shape: CloudShape, firstIndex = 0): CloudMesh {
  const mesh: CloudMesh = { positions: [], shades: [], indices: [] };
  const rng = createRng(shape.seed);
  const [baseLo = 0, baseHi = baseLo] = shape.baseDeg;
  const [widthLo = 1, widthHi = widthLo] = shape.widthDeg;
  const [heightLo = 1, heightHi = heightLo] = shape.heightDeg;
  for (let i = 0; i < shape.count; i++) {
    const bearing = ((i + rng() * 0.8) / shape.count) * Math.PI * 2;
    const base = range(rng, baseLo, baseHi);
    const width = range(rng, widthLo, widthHi);
    const height = range(rng, heightLo, heightHi);
    const lumps = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < lumps; j++) {
      // Tallest in the middle, lower toward the ends, like a cumulus seen from afar.
      const across = (j + 0.5) / lumps - 0.5;
      const top = height * (1 - Math.abs(across) * 0.9) * (0.75 + 0.25 * rng());
      const rx = (width / lumps) * (0.8 + 0.4 * rng());
      const lump = {
        u: across * width * 0.85,
        v: base + top * 0.45,
        rx,
        ry: top * 0.6,
        turn: rng() * Math.PI,
      };
      addLump(mesh, firstIndex, bearing, base, height, lump);
    }
  }
  return mesh;
}

interface Lump {
  /** Centre across the cloud and up from the horizon, degrees. */
  u: number;
  v: number;
  /** Half width and half height, degrees. */
  rx: number;
  ry: number;
  /** Turn of its corners, so the lumps don't all line up. */
  turn: number;
}

/** One lump as a fan round its centre; corners below the cloud's base sit on it (a flat bottom). */
function addLump(
  mesh: CloudMesh,
  firstIndex: number,
  bearing: number,
  base: number,
  height: number,
  lump: Lump,
) {
  const start = firstIndex + mesh.shades.length;
  const corner = (u: number, v: number) => {
    const onBase = Math.max(v, base);
    pushDirection(mesh.positions, bearing + u * DEG, onBase * DEG);
    mesh.shades.push(Math.min(1, (onBase - base) / height));
  };
  corner(lump.u, lump.v);
  for (let k = 0; k < LUMP_SIDES; k++) {
    const a = lump.turn + (k / LUMP_SIDES) * Math.PI * 2;
    corner(lump.u + Math.cos(a) * lump.rx, lump.v + Math.sin(a) * lump.ry);
  }
  for (let k = 0; k < LUMP_SIDES; k++) {
    mesh.indices.push(start, start + 1 + k, start + 1 + ((k + 1) % LUMP_SIDES));
  }
}
