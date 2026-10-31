import { TUNING } from '../data/tuning';
import { DEG } from './math';
import { seaDrag } from './seaDrag';
import { createSeaState, steadySeaState } from './seaState';
import { SHIP_CLASSES, SHIP_IDS, noGoAngle } from './ship';

/**
 * The waves' drag by ship, sea and point of sail (decision 0256), the same on every level, for
 * `npm run sea -- drag` and its tests: the share of her flat-water speed each review sea
 * (`waves.json` › `previews`) takes off. In a settled sea the waves come from the wind, so the
 * point of sail is also where she meets them.
 */
export interface DragRow {
  preview: string;
  ship: string;
  /** Close-hauled (just off the no-go zone), beam reach, broad reach, dead run. */
  close: number;
  beam: number;
  broad: number;
  run: number;
}

const sea = createSeaState();

export function dragRows(): DragRow[] {
  const rows: DragRow[] = [];
  for (const [preview, { speedKn, storm }] of Object.entries(TUNING.waves.previews)) {
    // Wind (and waves) from the north: her heading is her angle off the wind.
    steadySeaState(0, speedKn, storm, sea);
    for (const id of SHIP_IDS) {
      const ship = SHIP_CLASSES[id]!;
      const at = (twa: number) => seaDrag(ship, twa, sea);
      rows.push({
        preview,
        ship: id,
        close: at(noGoAngle(ship) + 5 * DEG),
        beam: at(90 * DEG),
        broad: at(135 * DEG),
        run: at(180 * DEG),
      });
    }
  }
  return rows;
}

export function dragLines(rows: readonly DragRow[]): string[] {
  const pc = (n: number) => `${(n * 100).toFixed(1)}%`.padStart(6);
  return [
    'sea    ship         close   beam  broad    run   (share of her flat-water speed, every level)',
    ...rows.map(
      (r) =>
        `${r.preview.padEnd(6)} ${r.ship.padEnd(11)} ${pc(r.close)} ${pc(r.beam)} ${pc(r.broad)} ${pc(r.run)}`,
    ),
  ];
}
