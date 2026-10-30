import { TUNING } from '../data/tuning';
import { piersOf } from '../sim/collision';
import { type CoastGrid, bandCalm, coastSample, createBandCalm } from '../sim/coastWaves';
import type { MapDef } from '../sim/map';
import { bakeSeabedDepth } from './seabedDepth';
import { drawnLand } from './seabedTexture';

/**
 * How calm the coast keeps the waves at chosen spots (issue #281), for `npm run sea -- calm`:
 * the bake the game makes for a sea as it stands at the start, read the way boats read it.
 */
export interface CalmRow {
  id: string;
  x: number;
  y: number;
  /** The bake there, 0..1. */
  depth: number;
  exposure: number;
  /** The swell's and the chop's share of the open sea's waves. */
  swell: number;
  chop: number;
}

/** The game's bake of `map`'s land, with the exposure. */
export function mapCoastGrid(map: MapDef): CoastGrid {
  const { fields, terrain, piers } = drawnLand(
    map,
    { ...map, terrain: map.terrain ?? [] },
    {},
    true,
  );
  const coast = TUNING.waves.coast;
  return bakeSeabedDepth(fields, terrain ?? [], TUNING.graphics.water.depth, coast, piers ?? []);
}

/** Every port's berth: the head of its first pier, where a boat docks. */
export function berthSpots(map: MapDef) {
  const piers = piersOf(map).filter((p) => !p.boat);
  return map.ports.flatMap((port) => {
    const pier = piers.find((p) => p.islandId === port.islandId);
    return pier ? [{ id: port.id, x: pier.x1, y: pier.y1 }] : [];
  });
}

export function calmRows(grid: CoastGrid, spots: { id: string; x: number; y: number }[]) {
  const calm = createBandCalm();
  return spots.map(({ id, x, y }): CalmRow => {
    const { depth, exposure } = coastSample(grid, x, -y);
    bandCalm(depth, exposure, calm);
    return { id, x, y, depth, exposure, swell: calm[0]!, chop: calm[1]! };
  });
}

export function calmLines(rows: CalmRow[]) {
  const pct = (v: number) => `${Math.round(v * 100)}%`.padStart(4);
  return rows.map(
    (r) =>
      `${r.id.padEnd(16)} swell ${pct(r.swell)}  chop ${pct(r.chop)}  ` +
      `(depth ${r.depth.toFixed(2)}, open ${r.exposure.toFixed(2)})  at ${Math.round(r.x)},${Math.round(r.y)}`,
  );
}
