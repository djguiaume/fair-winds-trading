/**
 * Which island ground the game draws (decision 0222, issue #268): `v1`, the classic extruded
 * tiers, or `v2`, the new look's ground from the shared height field, picked with `?look=v2`
 * while the new look is built. The classic look stays the default until every island passes
 * review.
 */
export type TerrainLook = 'v1' | 'v2';

export const terrainLook = (search: string): TerrainLook =>
  new URLSearchParams(search).get('look') === 'v2' ? 'v2' : 'v1';
