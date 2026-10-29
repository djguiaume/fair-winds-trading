import { TUNING } from '../../src/data/tuning';
import { coastReport } from '../../src/sim/mapCoast';
import type { MapDef } from '../../src/sim/map';
import type { Overlay } from './chart';

export type Quality = keyof typeof TUNING.terrain.groundStep;

/**
 * The drawn and the sailed coast of a sea as a `npm run chart` overlay (decision 0237): both
 * lines of every island and barrier island at a quality level, a red disc where they are further
 * apart than `terrain.json › coast › tolerance`, and a legend line with the worst gap of each
 * shape that has one. Returns the overlay and the report lines to print.
 */
export function coastOverlay(map: MapDef, quality: Quality) {
  const rows = coastReport(map, quality);
  const { tolerance } = TUNING.terrain.coast;
  const overlay: Overlay = {
    lines: rows.flatMap((r) => [
      ...r.sailed.map((points) => ({ points, style: 'coast-sailed' })),
      ...r.drawn.map((points) => ({ points, style: 'coast-drawn' })),
    ]),
    islands: rows.flatMap((r) =>
      r.beyond.map((m) => ({
        x: m.at[0],
        y: m.at[1],
        radius: 2,
        style: 'coast-bad',
        name: m.distance.toFixed(1),
      })),
    ),
  };
  const report = rows
    .filter((r) => r.worst)
    .sort((a, b) => b.worst!.distance - a.worst!.distance)
    .map(
      (r) =>
        `${r.id}: worst gap ${r.worst!.distance.toFixed(2)} (${r.worst!.side}), ${r.beyond.length} beyond ${tolerance}`,
    );
  overlay.legend = [
    {
      style: 'tint',
      text: `${quality} quality: ${rows.length} shapes, ${rows.filter((r) => r.beyond.length).length} beyond ${tolerance} units`,
    },
  ];
  return { overlay, report };
}
