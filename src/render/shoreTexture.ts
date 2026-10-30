import * as THREE from 'three';
import type { IslandDef, TerrainDef } from '../sim/map';
import { islandPoint } from '../sim/islandLayout';
import { designOf } from '../data/islands';
import { insideOutline } from '../sim/flowShapes';

/** Baked shoreline distance: constant shader cost as authored coast complexity grows. */
export const shoreShader = /* glsl */ `
uniform sampler2D uShoreMap;
uniform vec4 uShoreBounds;
float shoreDistance(vec2 p) {
  vec2 uv = (p-uShoreBounds.xy)/uShoreBounds.zw;
  if (any(lessThan(uv,vec2(0.0))) || any(greaterThan(uv,vec2(1.0)))) return 64.0;
  return texture2D(uShoreMap,uv).r*64.0;
}
`;

/** Read current file contents: islandCoasts' simulation cache does not track live file edits. */
function currentCoasts(island: IslandDef) {
  return designOf(island)?.coasts.map((coast) =>
    coast.map(([x, z]): [number, number] => {
      const p = islandPoint(island, x, z);
      return [p.x, p.y];
    }),
  );
}

/** Shoreline bake sharpness: map units per texel (512 texels spanned today's map at about 1.4). */
const SHORE_UNITS_PER_TEXEL = 1.4;
/** Texel cap per side: 2048 x 2048 at one byte is 4 MB, the most an old tablet should hold. */
const SHORE_MAX_TEXELS = 2048;

export type ShoreTexture = ReturnType<typeof shoreTexture>;

/** One map/view owns one bake; quality changes borrow it. No per-frame work or global GPU cache. */
export class ShoreTextureCache {
  private key?: string;
  private shore?: ShoreTexture;

  get(islands: readonly IslandDef[], terrain: readonly TerrainDef[] = []): ShoreTexture {
    // Compare effective shoreline contents, not array identity or fixed island ids. This is only
    // called when rebuilding water (quality change/editor refresh), never from the frame loop.
    const key = JSON.stringify([
      islands.map((i) => currentCoasts(i) ?? [i.x, i.y, i.radius]),
      terrain.map((t) => t.outline),
    ]);
    if (!this.shore || this.key !== key) {
      const next = shoreTexture(islands, terrain);
      this.shore?.texture.dispose();
      this.shore = next;
      this.key = key;
    }
    return this.shore;
  }

  dispose(): void {
    this.shore?.texture.dispose();
    this.shore = undefined;
    this.key = undefined;
  }
}

export function shoreTexture(islands: readonly IslandDef[], terrain: readonly TerrainDef[]) {
  const edges: [number, number, number, number][] = [];
  const circles: IslandDef[] = [];
  const add = (outline: [number, number][]) =>
    outline.forEach((a, i) => {
      const b = outline[(i + 1) % outline.length]!;
      edges.push([a[0], -a[1], b[0], -b[1]]);
    });
  for (const island of islands) {
    const coasts = currentCoasts(island);
    if (coasts) coasts.forEach(add);
    else circles.push(island);
  }
  // Shallows are water: their sandy floor is drawn by the island models, with no surf (0152).
  // Berg fields are open water too (decision 0170): the bergs drift, the shape has no shore.
  terrain.filter((t) => t.kind !== 'shallows' && t.kind !== 'bergs').forEach((t) => add(t.outline));
  const points = edges.flatMap(([x, z, u, v]) => [
    [x, z],
    [u, v],
  ]);
  circles.forEach((i) =>
    points.push([i.x - i.radius, -i.y - i.radius], [i.x + i.radius, -i.y + i.radius]),
  );
  if (!points.length) points.push([-1, -1], [1, 1]);
  let x0 = Infinity,
    z0 = Infinity,
    x1 = -Infinity,
    z1 = -Infinity;
  for (const [x, z] of points) {
    x0 = Math.min(x0, x!);
    z0 = Math.min(z0, z!);
    x1 = Math.max(x1, x!);
    z1 = Math.max(z1, z!);
  }
  x0 -= 24;
  z0 -= 24;
  const w = x1 + 24 - x0;
  const h = z1 + 24 - z0;
  // Same sharpness on any map size, within a memory budget (decision 0115).
  const nx = Math.min(SHORE_MAX_TEXELS, Math.max(64, Math.ceil(w / SHORE_UNITS_PER_TEXEL)));
  const nz = Math.min(SHORE_MAX_TEXELS, Math.max(64, Math.ceil(h / SHORE_UNITS_PER_TEXEL)));
  const distances = new Float32Array(nx * nz).fill(64);
  // Rasterize only a 20-unit band around each segment/circle, not every edge per texel.
  const band = (
    xmin: number,
    zmin: number,
    xmax: number,
    zmax: number,
    distance: (x: number, z: number) => number,
  ) => {
    const xa = Math.max(0, Math.floor(((xmin - 20 - x0) / w) * nx)),
      xb = Math.min(nx - 1, Math.ceil(((xmax + 20 - x0) / w) * nx));
    const za = Math.max(0, Math.floor(((zmin - 20 - z0) / h) * nz)),
      zb = Math.min(nz - 1, Math.ceil(((zmax + 20 - z0) / h) * nz));
    for (let j = za; j <= zb; j++)
      for (let i = xa; i <= xb; i++) {
        const k = j * nx + i;
        distances[k] = Math.min(
          distances[k]!,
          distance(x0 + ((i + 0.5) / nx) * w, z0 + ((j + 0.5) / nz) * h),
        );
      }
  };
  for (const [x, z, u, v] of edges)
    band(Math.min(x, u), Math.min(z, v), Math.max(x, u), Math.max(z, v), (px, pz) => {
      const dx = u - x,
        dz = v - z;
      const t = Math.max(
        0,
        Math.min(1, ((px - x) * dx + (pz - z) * dz) / (dx * dx + dz * dz || 1)),
      );
      return Math.hypot(px - x - t * dx, pz - z - t * dz);
    });
  for (const c of circles)
    band(c.x - c.radius, -c.y - c.radius, c.x + c.radius, -c.y + c.radius, (x, z) =>
      Math.abs(Math.hypot(x - c.x, z + c.y) - c.radius),
    );
  // Pack ice is shore all through: the waves calm under it, so a coarse ocean never pokes up
  // between its floes (issue #277). Its rim keeps its open water.
  for (const t of terrain) {
    if (t.kind !== 'ice') continue;
    const xs = t.outline.map((p) => p[0]),
      zs = t.outline.map((p) => -p[1]);
    band(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), (x, z) =>
      insideOutline(x, -z, t.outline) ? 0 : 64,
    );
  }
  // One byte per texel (the shader reads red only): a quarter of the memory of RGBA.
  const bytes = new Uint8Array(nx * nz);
  distances.forEach((d, i) => (bytes[i] = Math.round((d / 64) * 255)));
  const texture = new THREE.DataTexture(bytes, nx, nz, THREE.RedFormat);
  texture.unpackAlignment = 1;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, bounds: new THREE.Vector4(x0, z0, w, h) };
}
