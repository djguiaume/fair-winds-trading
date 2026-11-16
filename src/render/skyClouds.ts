import { createRng, range, type Rng } from '../sim/rng';
import { DEG } from '../sim/math';

/** `graphics.json` › `sky` › `clouds`: how many, where and how big (angles in degrees). */
export interface CloudShape {
  count: number;
  seed: number;
  baseDeg: readonly number[];
  widthDeg: readonly number[];
  heightDeg: readonly number[];
}

/**
 * Clouds as triangles on the unit sky sphere. Per corner: its height in its cloud (`shades`, 0 base
 * … 1 top) and three more numbers (`parts`): how far in from the cloud's soft edge (0 rim … 1
 * centre), the cloud's rank (0..1: the weather shows the clouds whose rank is under its amount), and
 * its layer (0 the low cumulus, 1 the high streaks).
 */
export interface CloudMesh {
  positions: number[];
  shades: number[];
  parts: number[];
  indices: number[];
}

export const emptyCloudMesh = (): CloudMesh => ({
  positions: [],
  shades: [],
  parts: [],
  indices: [],
});

/** Corners of a lump: few, so the clouds read low-poly like the rest of the world (art bible). */
const LUMP_SIDES = 8;
/** Ranks follow the golden ratio round the clouds, so a thin sky spreads its clouds round the compass. */
const GOLDEN = 0.618034;

/** A point on the unit sphere at a compass bearing and a height above the horizon (radians). */
export function pushDirection(out: number[], bearing: number, elevation: number) {
  const flat = Math.cos(elevation);
  out.push(Math.sin(bearing) * flat, Math.sin(elevation), -Math.cos(bearing) * flat);
}

/** The rank of the `i`th cloud of a layer, from its seed's first draw. */
export const cloudRank = (i: number, offset: number) => (offset + i * GOLDEN) % 1;

/**
 * Low cumulus round the horizon (issues #470, #552): each a row of eight-sided lumps on one flat
 * base, with one or two towering lumps over the middle of the taller ones, spread round the compass
 * with a seeded jitter so the sky is the same every voyage. They sit on the sky dome at infinity, so
 * the chase camera's band of sky shows them; the shader softens their rims and lights them.
 */
export function buildClouds(shape: CloudShape, firstIndex = 0, mesh = emptyCloudMesh()): CloudMesh {
  const rng = createRng(shape.seed);
  const offset = rng();
  const [baseLo = 0, baseHi = baseLo] = shape.baseDeg;
  const [widthLo = 1, widthHi = widthLo] = shape.widthDeg;
  const [heightLo = 1, heightHi = heightLo] = shape.heightDeg;
  for (let i = 0; i < shape.count; i++) {
    const cloud: Cloud = {
      bearing: ((i + rng() * 0.8) / shape.count) * Math.PI * 2,
      base: range(rng, baseLo, baseHi),
      width: range(rng, widthLo, widthHi),
      height: range(rng, heightLo, heightHi),
      rank: cloudRank(i, offset),
    };
    addCumulus(mesh, firstIndex, cloud, rng);
  }
  return mesh;
}

interface Cloud {
  /** Compass bearing (radians); base and size in degrees. */
  bearing: number;
  base: number;
  width: number;
  height: number;
  rank: number;
}

function addCumulus(mesh: CloudMesh, firstIndex: number, cloud: Cloud, rng: Rng) {
  const { width, height } = cloud;
  const lumps = 4 + Math.floor(rng() * 3);
  for (let j = 0; j < lumps; j++) {
    // Tallest in the middle, lower toward the ends, like a cumulus seen from afar.
    const across = (j + 0.5) / lumps - 0.5;
    const top = height * 0.75 * (1 - Math.abs(across) * 0.9) * (0.75 + 0.25 * rng());
    addLump(mesh, firstIndex, cloud, {
      u: across * width * 0.85,
      v: cloud.base + top * 0.45,
      rx: (width / lumps) * (1.1 + 0.4 * rng()),
      ry: top * 0.6,
      turn: rng() * Math.PI,
    });
  }
  // The taller clouds tower: a lump or two of their own over the middle.
  const towers = height > 3 ? 1 + Math.floor(rng() * 2) : 0;
  for (let k = 0; k < towers; k++) {
    const top = height * (0.85 + 0.15 * rng());
    addLump(mesh, firstIndex, cloud, {
      u: (rng() - 0.5) * width * 0.3,
      v: cloud.base + top * 0.6,
      rx: width * (0.12 + 0.06 * rng()),
      ry: top * 0.4,
      turn: rng() * Math.PI,
    });
  }
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

/**
 * One lump as a fan round its centre; corners below the cloud's base sit on it (a flat bottom).
 * The centre is the lump's core (edge 1), the corners its rim (edge 0).
 */
function addLump(mesh: CloudMesh, firstIndex: number, cloud: Cloud, lump: Lump) {
  const start = firstIndex + mesh.shades.length;
  const corner = (u: number, v: number, edge: number) => {
    const onBase = Math.max(v, cloud.base);
    pushDirection(mesh.positions, cloud.bearing + u * DEG, onBase * DEG);
    mesh.shades.push(Math.min(1, (onBase - cloud.base) / cloud.height));
    mesh.parts.push(edge, cloud.rank, 0);
  };
  corner(lump.u, lump.v, 1);
  for (let k = 0; k < LUMP_SIDES; k++) {
    const a = lump.turn + (k / LUMP_SIDES) * Math.PI * 2;
    corner(lump.u + Math.cos(a) * lump.rx, lump.v + Math.sin(a) * lump.ry, 0);
  }
  for (let k = 0; k < LUMP_SIDES; k++) {
    mesh.indices.push(start, start + 1 + k, start + 1 + ((k + 1) % LUMP_SIDES));
  }
}
