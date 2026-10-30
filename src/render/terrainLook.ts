/**
 * Which island ground the game draws (decision 0222, issue #268): `v1`, the classic extruded
 * tiers, or `v2`, the new look's ground from the shared height field. `v2` is the default
 * (v1.2, issue #350); `?look=v1` keeps the classic look for comparison.
 */
export type TerrainLook = 'v1' | 'v2';

export const terrainLook = (search: string): TerrainLook =>
  new URLSearchParams(search).get('look') === 'v1' ? 'v1' : 'v2';
