import type { IslandDef, TerrainDef } from '../sim/map';
import type { QualityProfile } from './quality';
import type { ShoreTexture } from './shoreTexture';
import type { SeabedTexture } from './seabedTexture';
import type { SeaWaves } from './seaWaves';
import { OCEAN_SIZE, Ocean, type WaterLook } from './ocean';

/**
 * The ocean of a quality level. The shader depends on the water look, not the grid resolution:
 * it shares the material of another level's ocean that draws the same water and waves, so
 * switching between High and Medium never releases or relinks the same program.
 */
export function oceanFor(
  profile: QualityProfile,
  others: readonly Ocean[],
  land: { islands: readonly IslandDef[]; terrain: readonly TerrainDef[] },
  shore: ShoreTexture,
  seabed?: SeabedTexture,
  waves?: Pick<SeaWaves, 'gerstner'>,
): Ocean {
  const look = waterLookOf(profile, seabed, waves);
  const material = others.find(
    ({ mesh }) =>
      'FANCY' in mesh.material.defines === look.fancy &&
      'REFLECT' in mesh.material.defines === look.reflect &&
      'MIRROR' in mesh.material.defines === look.mirror &&
      'PLAIN' in mesh.material.defines === look.plain &&
      'GERSTNER' in mesh.material.defines === look.gerstner &&
      'GUSTS' in mesh.material.defines === look.gusts,
  )?.mesh.material;
  const { oceanSegments } = profile;
  return new Ocean(land.islands, oceanSegments, look, OCEAN_SIZE, land.terrain, shore, material);
}

/** The water a quality level draws, over `seabed`'s depth, with `waves`' Gerstner sea or not. */
export function waterLookOf(
  profile: QualityProfile,
  seabed?: SeabedTexture,
  waves?: Pick<SeaWaves, 'gerstner'>,
) {
  const gerstner = !!waves?.gerstner;
  return {
    fancy: profile.fancyWater,
    reflect: profile.waterReflection,
    mirror: profile.mirror,
    plain: profile.plain,
    ultra: profile.ultra,
    seabed,
    gerstner,
    gusts: gerstner && profile.fancyWater && profile.gusts,
    coast: gerstner ? seabed : undefined,
  } satisfies WaterLook;
}
