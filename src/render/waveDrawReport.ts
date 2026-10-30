import { TUNING } from '../data/tuning';
import { createSeaState, steadySeaState } from '../sim/seaState';
import { setWaveField } from '../sim/waves';
import { OCEAN_SIZE } from './ocean';
import { SeaWaves, drawnOn } from './seaWaves';

/**
 * How far each quality level's drawn sea can stand from the surface boats float on (issue #282),
 * for `npm run sea -- drawn`: per review sea state (`waves.json` › `previews`), the physical waves
 * its grid can't hold (they only shade) and its flat triangles' sag. A boat may sit up to their
 * sum above or below the water drawn under her.
 */
export interface DrawRow {
  level: string;
  preview: string;
  /** The ocean grid's cell, map units. */
  cell: number;
  /** Physical crest height left out of the grid, and the grid's sag, map units. */
  undrawn: number;
  sag: number;
}

export function drawRows(): DrawRow[] {
  const waves = new SeaWaves(() => {
    throw new Error('the report needs no world');
  }, '?waves=v2');
  const sea = createSeaState();
  const f = waves.field;
  const rows: DrawRow[] = [];
  for (const [preview, { speedKn, storm }] of Object.entries(TUNING.waves.previews)) {
    steadySeaState(0, speedKn, storm, sea);
    setWaveField(f, sea, 1, 0);
    for (const [level, quality] of Object.entries(TUNING.graphics.quality)) {
      const cell = OCEAN_SIZE / quality.oceanSegments;
      let undrawn = 0;
      for (let i = 0; i < f.count; i++)
        if (!f.cosmetic[i]) undrawn += f.amp[i]! * (1 - drawnOn(f.length[i]!, cell));
      rows.push({ level, preview, cell, undrawn, sag: waves.sag(cell, cell) });
    }
  }
  return rows;
}

export function drawLines(rows: readonly DrawRow[]): string[] {
  const fix = (n: number) => n.toFixed(2).padStart(5);
  return [
    'level     sea     cell  undrawn  sag   (map units; a boat may float up to undrawn + sag off the drawn sea)',
    ...rows.map(
      (r) =>
        `${r.level.padEnd(9)} ${r.preview.padEnd(6)} ${fix(r.cell)}  ${fix(r.undrawn)}  ${fix(r.sag)}`,
    ),
  ];
}
