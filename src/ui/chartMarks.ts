import { groundColors } from '../data/grounds';
import { ISLAND_DESIGNS } from '../data/islands';
import type { SeaMarkDef } from '../sim/map';

/**
 * How a sea mark is drawn on a chart (decisions 0130, 0152), shared by the sea chart, the map
 * editor and `npm run chart`: a light is a gold star, a cardinal mark a yellow and black diamond
 * as on real charts, a buoy or boat a small dot. `px` is map units per screen pixel.
 */
export function seaMarkShape(
  mark: SeaMarkDef,
  px: number,
): { tag: string; attrs: Record<string, string | number> } {
  if (mark.type === 'light')
    return {
      tag: 'path',
      attrs: {
        d: star(mark.x, -mark.y, 6 * px),
        fill: '#ffd76a',
        stroke: '#5a3d24',
        'stroke-width': 1.2 * px,
      },
    };
  if (mark.type.startsWith('cardinal-'))
    return {
      tag: 'path',
      attrs: {
        d: `M${mark.x} ${-mark.y - 4 * px}l${3 * px} ${4 * px}l${-3 * px} ${4 * px}l${-3 * px} ${-4 * px}z`,
        fill: '#f2c230',
        stroke: '#22252a',
        'stroke-width': 1.2 * px,
      },
    };
  // The regatta's marks (decision 0217): a yellow mark to round, an orange pin, a committee boat.
  if (mark.type.startsWith('race-'))
    return {
      tag: 'circle',
      attrs: {
        cx: mark.x,
        cy: -mark.y,
        r: (mark.type === 'race-mark' ? 4 : 3) * px,
        fill:
          mark.type === 'race-mark' ? '#f2c230' : mark.type === 'race-pin' ? '#ef7d2a' : '#f4f1e8',
        stroke: '#22252a',
        'stroke-width': 1.2 * px,
      },
    };
  return {
    tag: 'circle',
    attrs: {
      cx: mark.x,
      cy: -mark.y,
      r: 2.6 * px,
      fill:
        mark.type === 'buoy-red'
          ? '#d93a2b'
          : mark.type === 'buoy-green'
            ? '#2f9a55'
            : mark.type === 'buoy-yellow'
              ? '#f2c230'
              : mark.type === 'wreck'
                ? '#5a4636'
                : '#3f74a8',
      stroke: '#f6f1e4',
      'stroke-width': 1 * px,
    },
  };
}

/** A five-pointed star path of outer radius `r` round (cx, cy): a light on the chart (0130). */
export function star(cx: number, cy: number, r: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const k = i % 2 ? r * 0.45 : r;
    return `${(cx + Math.cos(a) * k).toFixed(2)},${(cy + Math.sin(a) * k).toFixed(2)}`;
  });
  return `M${points.join('L')}Z`;
}

/**
 * The chart's beach and land colours for an island whose style swaps its grounds (decision 0170:
 * an ice island is snow on shingle, not green on sand); empty for the usual look.
 */
export function landStyles(
  design: string | undefined,
): [Record<string, string>, Record<string, string>] {
  const style = design ? ISLAND_DESIGNS[design]?.style : undefined;
  if (!style) return [{}, {}];
  const land = groundColors('grass', style);
  const beach = groundColors('sand', style);
  return [
    beach.id === 'sand' ? {} : { style: `fill:${beach.top[0]}` },
    land.id === 'grass' ? {} : { style: `fill:${land.top[0]};stroke:${beach.top[0]}` },
  ];
}
