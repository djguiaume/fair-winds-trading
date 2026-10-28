import * as THREE from 'three';
import { type Heightfield, islandHeightfield } from '../sim/heightfield';
import type { IslandDef, MapDef, TerrainDef } from '../sim/map';
import type { TownLevel } from './models/towns';
import { shownLevel } from './models/islandParts';
import { TUNING } from '../data/tuning';
import { bakeSeabedDepth } from './seabedDepth';

/** The baked seabed depth (issue #274): 0 at the coast, 1 for deep water and off the map. */
export const seabedShader = /* glsl */ `
uniform sampler2D uDepthMap;
uniform vec4 uDepthBounds;
float seabedDepth(vec2 p) {
  vec2 uv = (p-uDepthBounds.xy)/uDepthBounds.zw;
  if (any(lessThan(uv,vec2(0.0))) || any(greaterThan(uv,vec2(1.0)))) return 1.0;
  return texture2D(uDepthMap,uv).r;
}
`;

export interface SeabedTexture {
  texture: THREE.DataTexture;
  /** Scene x and z of the first texel's corner, then the width and depth it covers. */
  bounds: THREE.Vector4;
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

  get(fields: readonly Heightfield[], terrain: readonly TerrainDef[] = []): SeabedTexture {
    const outlines = terrain.map((t) => t.outline);
    const tuning = JSON.stringify(TUNING.graphics.water.depth);
    if (
      !this.seabed ||
      this.tuning !== tuning ||
      !sameItems(this.fields, fields) ||
      !sameItems(this.terrain, outlines)
    ) {
      const next = seabedTexture(fields, terrain);
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

export function seabedTexture(
  fields: readonly Heightfield[],
  terrain: readonly TerrainDef[],
): SeabedTexture {
  const bake = bakeSeabedDepth(fields, terrain);
  // One byte per texel, filtered: a quarter of the memory of RGBA (about 0.7 MB for today's sea).
  const texture = new THREE.DataTexture(bake.depth, bake.w, bake.h, THREE.RedFormat);
  texture.unpackAlignment = 1;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const bounds = new THREE.Vector4(bake.x0, bake.z0, bake.w * bake.cell, bake.h * bake.cell);
  return { texture, bounds };
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
