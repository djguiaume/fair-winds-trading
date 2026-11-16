/** How a tuning value's path maps to its meta entry (decision 0094). */

/** Objects whose keys are ids: their children are written `*` in meta paths. */
export const ID_COLLECTIONS: readonly string[] = [
  'ships',
  'graphics.closeUp.hands',
  'goods',
  'difficulty.levels',
  'weather.default.kinds',
  'weather.zones.kinds',
  'economy.towns.growthToLevel',
  'upgrades.homePortLevel',
  'seamanship.traffic.kinds',
  'waves.bands',
  'waves.previews',
  'graphics.quality',
];

/** The meta path of a value: `['ships', 'cutter', 'hold']` → `ships.*.hold`. */
export function metaPath(path: readonly string[]): string {
  const out: string[] = [];
  for (const key of path) {
    out.push(ID_COLLECTIONS.includes(out.join('.')) ? '*' : key);
  }
  return out.join('.');
}
