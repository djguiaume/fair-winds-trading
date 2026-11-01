import { t } from '../../i18n';
import { seaBox, seaShape } from '../../sim/seaEdge';
import { seaSvg } from '../seaOutline';
import { deepestPoint, type ZoneLabel } from './flows';
import { type Attrs, type Paint, points } from './svg';

/** The fog's blurred edge on High quality, in pixels (decision 0156). */
const FOG_BLUR = 8;
/** How far round a sighted island its patch of chart reaches, in map units (plus the blur). */
const SIGHTED_MARGIN = 12;
/** The hatched band along the edge of what she has charted, in pixels. */
const HATCH_BAND = 14;
/** The hatching's spacing, in pixels. */
const HATCH_STEP = 5;

/**
 * Fog of war (decisions 0156, issue #444): the uncharted waters as a lighter, blank paper with a
 * hatched band along the edge of what she has charted, one layer with holes where the ring, the
 * charted areas and the sighted islands are. No blur filter unless `blur` (High quality), which
 * old tablets draw slowly. Returns an "Uncharted waters" label per fogged area, placed with the
 * zones' names so it never covers a port, a place or the boat.
 */
export function drawFog({ world, shape, px }: Paint, blur: boolean): ZoneLabel[] {
  const { map, trade } = world;
  const fog = map.fog;
  if (!fog) return [];
  // The fog covers the whole sea, a section sticking out of the round sea too (decision 0202).
  const sea = seaShape(map);
  const [bx0, by0, bx1, by1] = seaBox(sea);
  const region = { x: bx0 - 4, y: -by1 - 4, width: bx1 - bx0 + 8, height: by1 - by0 + 8 };
  const water = seaSvg(sea, 4);
  const progress = trade.progress;
  const defs = shape('defs', {});
  const mask = shape(
    'mask',
    { id: 'chart-fog-mask', maskUnits: 'userSpaceOnUse', ...region },
    defs,
  );
  // The mask's white: the water and 2 units round it.
  const whole = (parent: Element) =>
    shape(
      water.tag,
      {
        ...water.attrs,
        fill: '#fff',
        stroke: '#fff',
        'stroke-width': 4,
        'stroke-linejoin': 'round',
      },
      parent,
    );
  // A blur eats into small holes, so a sighted island's patch grows by the blur.
  const margin = SIGHTED_MARGIN + (blur ? 2 * FOG_BLUR * px : 0);
  const holes: { tag: string; attrs: Attrs }[] = [
    { tag: 'circle', attrs: { r: fog.chartedRadius } },
    ...fog.areas
      .filter((a) => progress.areas?.includes(a.id))
      .map((a) => ({ tag: 'polygon', attrs: { points: points(a.outline) } })),
    ...map.islands
      .filter((i) => progress.sighted?.includes(i.id))
      .map((i) => ({ tag: 'circle', attrs: { cx: i.x, cy: -i.y, r: i.radius + margin } })),
  ];
  let target: Element = mask;
  if (blur) {
    const filter = shape(
      'filter',
      { id: 'chart-fog-blur', ...region, filterUnits: 'userSpaceOnUse' },
      defs,
    );
    shape('feGaussianBlur', { stdDeviation: FOG_BLUR * px }, filter);
    target = shape('g', { filter: 'url(#chart-fog-blur)' }, mask);
  }
  whole(target);
  for (const h of holes) shape(h.tag, { ...h.attrs, fill: '#000' }, target);
  const step = HATCH_STEP * px;
  const hatch = shape(
    'pattern',
    {
      id: 'chart-fog-hatch',
      patternUnits: 'userSpaceOnUse',
      width: step,
      height: step,
      patternTransform: 'rotate(45)',
    },
    defs,
  );
  shape('path', { d: `M0 0V${step}`, class: 'chart-fog-hatch', 'stroke-width': px }, hatch);
  const layer = shape('g', { mask: 'url(#chart-fog-mask)', class: 'chart-fog' });
  shape(water.tag, { ...water.attrs, class: 'chart-fog-paper' }, layer);
  for (const h of holes)
    shape(
      h.tag,
      {
        ...h.attrs,
        fill: 'none',
        stroke: 'url(#chart-fog-hatch)',
        'stroke-width': 2 * HATCH_BAND * px,
      },
      layer,
    );
  return fog.areas
    .filter((a) => !progress.areas?.includes(a.id))
    .map((a) => {
      const deep = deepestPoint(a.outline);
      return { text: t('chart.uncharted'), kind: 'fog', x: deep.x, y: -deep.y, outline: a.outline };
    });
}
