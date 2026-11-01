import { TUNING } from '../../data/tuning';
import { t, zoneLabel } from '../../i18n';
import { coastDistance } from '../../sim/coast';
import { laneShape } from '../../sim/currents';
import { knobs } from '../../sim/difficulty';
import { areaCrests, laneCrests, laneEdges, smoothOutline } from '../../sim/flowShapes';
import { zoneHazy } from '../../sim/windZones';
import { type Paint, points } from './svg';

/** A charted area's name, placed with the other labels (decision 0152). */
export interface ZoneLabel {
  text: string;
  kind: string;
  /** Chart coordinates (y down) of the spot deepest inside the area. */
  x: number;
  y: number;
  /** The area's edge in map coordinates: the name only shows where it fits inside. */
  outline: [number, number][];
}

/** The spot deepest inside an outline, on a coarse grid: where its name fits best. */
export function deepestPoint(outline: [number, number][]) {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const [x, y] of outline) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  let best = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, depth: 0 };
  const steps = 24;
  for (let i = 0; i <= steps; i++)
    for (let j = 0; j <= steps; j++) {
      const x = x0 + ((x1 - x0) * i) / steps,
        y = y0 + ((y1 - y0) * j) / steps;
      const d = -coastDistance(x, y, outline).distance;
      if (d > best.depth) best = { x, y, depth: d };
    }
  return best;
}

/**
 * Charted currents (decision 0140): a pale wash with its crests in ink and its speed, once she
 * has sailed in it. Drawn once per chart render, static.
 */
export function drawCurrents({ world, shape, unit }: Paint) {
  const { map, trade } = world;
  const charted = trade.progress.charted ?? [];
  const currents = (map.currents ?? []).filter((c) => charted.includes(c.id));
  if (!currents.length || !world.currentsOn) return;
  const defs = shape('defs', {});
  const blur = shape(
    'filter',
    { id: 'chart-soft', x: '-20%', y: '-20%', width: '140%', height: '140%' },
    defs,
  );
  shape('feGaussianBlur', { stdDeviation: TUNING.weather.currents.edgeFadeUnits / 2 }, blur);
  const scale = knobs(trade.difficulty).currents;
  for (const c of currents) {
    const lane = laneShape(c);
    const band = lane
      ? (({ left, right }) => [...left, ...right.reverse()])(laneEdges(lane.points))
      : c.outline && smoothOutline(c.outline);
    if (!band) continue;
    shape('polygon', { points: points(band), class: 'chart-current', filter: 'url(#chart-soft)' });
    const crests = lane
      ? laneCrests(lane.points, 0, TUNING.weather.currents.endFadeUnits)
      : areaCrests(band, c.towardDeg ?? 0, 0);
    const g = shape('g', { class: 'chart-crests', 'stroke-width': 1.4 * unit });
    for (const k of crests)
      shape(
        'path',
        {
          d: `M${k.a[0]},${-k.a[1]} Q${k.c[0]},${-k.c[1]} ${k.b[0]},${-k.b[1]}`,
          'stroke-opacity': (0.7 * k.alpha).toFixed(2),
        },
        g,
      );
    const mid = lane ? lane.points[Math.floor(lane.points.length / 2)]! : band[0]!;
    const label = shape('text', {
      x: mid[0],
      y: -mid[1] - 10 * unit,
      class: 'chart-current-label',
      'font-size': 12 * unit,
    });
    label.textContent = t('chart.current', {
      name: c.name ?? '',
      n: (c.speedKn * scale).toFixed(1),
    });
  }
}

/**
 * Charted wind zones (decision 0152): once she has sailed well inside a named zone, its edge as
 * a faint dashed ink line in its kind's colour, under the land. Returns the labels ("The Glass ·
 * doldrums"), each at the spot deepest inside its zone, to place over everything else.
 */
export function drawZones({ world, shape, unit }: Paint): ZoneLabel[] {
  const { map, trade } = world;
  const charted = trade.progress.zones ?? [];
  // With Settings › Wind zones off, fog banks still show while their haze is on (0169).
  const zones = (map.windZones ?? []).filter(
    (z) => z.name && charted.includes(z.id) && (world.windZones || zoneHazy(z, world.hazeOff)),
  );
  return zones.map((z) => {
    const outline = smoothOutline(z.outline);
    const kind = z.kind.replace(/[^a-z-]/g, '');
    shape('polygon', {
      points: points(outline),
      class: `chart-zone chart-zone-${kind}`,
      'stroke-width': 1.4 * unit,
      'stroke-dasharray': `${6 * unit} ${4 * unit}`,
    });
    const deep = deepestPoint(outline);
    return { text: zoneLabel(z.name!, z.kind), kind, x: deep.x, y: -deep.y, outline };
  });
}
