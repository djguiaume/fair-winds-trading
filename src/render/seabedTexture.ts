import * as THREE from 'three';
import { type Heightfield, islandHeightfield } from '../sim/heightfield';
import type { IslandDef, MapDef, TerrainDef } from '../sim/map';
import type { TownLevel } from './models/towns';
import { shownLevel } from './models/islandParts';
import { TUNING } from '../data/tuning';
import { type SeabedDepth, bakeSeabedDepth } from './seabedDepth';
import type { BerthLine } from './seabedExposure';
import { piersOf } from '../sim/collision';

/** The bake's uniforms, declared once per shader stage however many chunks read them. */
export function seabedUniforms() {
  return /* glsl */ `
#ifndef SEABED_MAP
#define SEABED_MAP
uniform sampler2D uDepthMap;
uniform vec4 uDepthBounds;
#endif`;
}

/** The baked seabed depth (issue #274): 0 at the coast, 1 for deep water and off the map. */
export const seabedShader = /* glsl */ `
${seabedUniforms()}
float seabedDepth(vec2 p) {
  vec2 uv = (p-uDepthBounds.xy)/uDepthBounds.zw;
  if (any(lessThan(uv,vec2(0.0))) || any(greaterThan(uv,vec2(1.0)))) return 1.0;
  return texture2D(uDepthMap,uv).r;
}
`;

export interface SeabedTexture {
  /** Depth in red; with `coast`, the exposure in green (the waves' calm, issue #281). */
  texture: THREE.DataTexture;
  /** Scene x and z of the first texel's corner, then the width and depth it covers. */
  bounds: THREE.Vector4;
  /** The bytes it was made from, for the CPU's side of the waves' calm (`sim/coastWaves.ts`). */
  bake: SeabedDepth;
}

/**
 * One view owns one bake, shared by every quality level, like the shore bake. It is baked again
 * only when a field, a terrain shape or a depth number changes: the height field cache hands out a
 * new field after an island edit (a builder stroke, a quest raising land), never an edited one.
 */
export class SeabedTextureCache {
  private fields: readonly Heightfield[] = [];
  private terrain: readonly TerrainDef['outline'][] = [];
  private tuning = '';
  private seabed?: SeabedTexture;

  /** With `piers`, the exposure too, for the Gerstner waves' calm (`?waves=v2`). */
  get({ fields, terrain = [], piers = null }: DrawnLand): SeabedTexture {
    const outlines = terrain.map((t) => t.outline);
    const tuning = JSON.stringify([TUNING.graphics.water.depth, piers && [bakedCoast(), piers]]);
    if (
      !this.seabed ||
      this.tuning !== tuning ||
      !sameItems(this.fields, fields) ||
      !sameItems(this.terrain, outlines)
    ) {
      const next = seabedTexture({ fields, terrain, piers });
      this.seabed?.texture.dispose();
      this.seabed = next;
      this.fields = [...fields];
      this.terrain = outlines;
      this.tuning = tuning;
    }
    return this.seabed;
  }

  dispose(): void {
    this.seabed?.texture.dispose();
    this.seabed = undefined;
    this.fields = [];
    this.terrain = [];
  }
}

const sameItems = <T>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((item, k) => item === b[k]);

/** The coast numbers the exposure bake reads; the calm's shares are applied live. */
const bakedCoast = () => {
  const { fetch, rays, blocks, smooth } = TUNING.waves.coast;
  return { fetch, rays, blocks, smooth };
};

/**
 * The land a bake is made from: the islands' fields, the terrain shapes and, for the waves' calm,
 * the piers (null: no exposure, the new look's colours alone).
 */
export interface DrawnLand {
  fields: readonly Heightfield[];
  terrain?: readonly TerrainDef[];
  piers?: readonly BerthLine[] | null;
}

export function seabedTexture({ fields, terrain = [], piers = null }: DrawnLand): SeabedTexture {
  const coast = !!piers;
  const tune = TUNING.graphics.water.depth;
  const bake = bakeSeabedDepth(fields, terrain, tune, piers && TUNING.waves.coast, piers ?? []);
  // One byte per texel (two with the exposure), filtered: a quarter (half) of RGBA's memory,
  // about 0.4 MB (0.8 MB) for today's sea.
  const texture = coast
    ? new THREE.DataTexture(interleave(bake.depth, bake.exposure), bake.w, bake.h, THREE.RGFormat)
    : new THREE.DataTexture(bake.depth, bake.w, bake.h, THREE.RedFormat);
  texture.unpackAlignment = 1;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const bounds = new THREE.Vector4(bake.x0, bake.z0, bake.w * bake.cell, bake.h * bake.cell);
  return { texture, bounds, bake };
}

function interleave(r: Uint8Array, g: Uint8Array) {
  const out = new Uint8Array(r.length * 2);
  for (let k = 0; k < r.length; k++) {
    out[2 * k] = r[k]!;
    out[2 * k + 1] = g[k]!;
  }
  return out;
}

/**
 * The land a view bakes: its standing islands' fields (below), its terrain and, with `coast`, the
 * piers at the towns' levels.
 */
export function drawnLand(
  map: Pick<MapDef, 'ports' | 'course'>,
  land: { islands: readonly IslandDef[]; terrain: readonly TerrainDef[] },
  levels: Readonly<Record<string, TownLevel>>,
  coast: boolean,
): DrawnLand {
  const fields = drawnFields(map, land.islands, levels);
  const piers = coast
    ? piersOf({ ...map, islands: [...land.islands] }, levels).filter((p) => !p.boat)
    : null;
  return { fields, terrain: land.terrain, piers };
}

/**
 * The islands' fields at the town levels they are drawn at: the same cached objects the island
 * models were built from, so the bake builds no field of its own.
 */
export function drawnFields(
  map: Pick<MapDef, 'ports'>,
  islands: readonly IslandDef[],
  levels: Readonly<Record<string, TownLevel>>,
): Heightfield[] {
  return islands.map((island) => {
    const port = map.ports.find((p) => p.islandId === island.id);
    return islandHeightfield(island, shownLevel(island, port ? levels[port.id] : undefined));
  });
}
