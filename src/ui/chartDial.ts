import { t } from '../i18n';
import { DEG } from '../sim/math';
import { svgEl } from './hud/parts';
import './chartDial.css';

/** The rose's rings and points, in SVG units. */
const RING = 56;
const INNER = 50;
const WEDGE = 47;
const POINTS: readonly [count: number, length: number, width: number, from: number][] = [
  [8, 22, 3, 22.5], // the eight by-points, behind
  [4, 32, 5, 45], // the four half-cardinals
  [4, 48, 7, 0], // the four cardinals, in front
];

/**
 * The chart's engraved compass rose (decision 0040, issue #444): north up like the chart, sixteen
 * points in ink and paper inside a ticked ring, and on it the wind arrow, the hatched no-go wedge
 * each side of it, her boat in sage and the course dot. `SeaChart` turns the parts; the sea HUD's
 * own compass turns with the boat instead (issue #441), so the chart keeps this one to itself.
 * Its one id (the hatching) is the chart's own.
 */
export class ChartDial {
  readonly svg: SVGSVGElement;
  private readonly nogo: SVGGElement;
  private readonly wedges: SVGPathElement[];
  private readonly wind: SVGGElement;
  private readonly windScale: SVGGElement;
  private readonly boat: SVGGElement;
  private readonly course: SVGGElement;

  constructor() {
    const svg = svgEl('svg', { viewBox: '-62 -74 124 136', 'aria-hidden': 'true' });
    this.svg = svg;
    const defs = svgEl('defs', {}, svg);
    const hatch = svgEl(
      'pattern',
      {
        id: 'chart-nogo-hatch',
        width: 4,
        height: 4,
        patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(45)',
      },
      defs,
    );
    svgEl('path', { d: 'M0 0V4', class: 'hatch' }, hatch);
    svgEl('circle', { r: RING, class: 'face' }, svg);
    svgEl('circle', { r: INNER, class: 'ring' }, svg);
    svgEl('path', { d: ticks(), class: 'ticks' }, svg);
    svgEl('text', { y: -RING - 6, class: 'north', 'font-size': 15 }, svg).textContent =
      t('compass.N');
    for (const [count, length, width, from] of POINTS)
      svgEl('g', {}, svg).innerHTML = star(count, length, width, from);
    this.nogo = svgEl('g', {}, svg);
    this.wedges = [
      svgEl('path', { class: 'nogo' }, this.nogo),
      svgEl('path', { class: 'nogo-hatch', fill: 'url(#chart-nogo-hatch)' }, this.nogo),
    ];
    this.wind = svgEl('g', {}, svg);
    this.windScale = svgEl('g', {}, this.wind);
    svgEl('path', { d: ARROW, class: 'wind' }, this.windScale);
    this.boat = svgEl('g', {}, svg);
    svgEl('path', { d: BOAT, class: 'boat' }, this.boat);
    this.course = svgEl('g', {}, svg);
    svgEl('circle', { cy: -(RING + INNER) / 2, r: 4, class: 'wp' }, this.course);
  }

  /**
   * Radians throughout: `windFrom` where it blows from, `noGo` each side of it, her `heading`,
   * `course` the bearing to where she is bound or null; `force` 0 to 4 thickens the arrow.
   */
  update(windFrom: number, force: number, noGo: number, heading: number, course: number | null) {
    const turn = (g: SVGGElement, rad: number) =>
      g.setAttribute('transform', `rotate(${rad / DEG})`);
    turn(this.nogo, windFrom);
    turn(this.wind, windFrom);
    this.windScale.setAttribute('transform', `scale(${0.8 + force * 0.12} 1)`);
    const d = noGoWedge(noGo);
    for (const path of this.wedges) path.setAttribute('d', d);
    turn(this.boat, heading);
    this.course.style.display = course === null ? 'none' : '';
    if (course !== null) turn(this.course, course);
  }
}

/** The wind arrow, coming in over the ring from where it blows towards the middle. */
const ARROW = 'M0 -22L-8 -34L-2.5 -31V-64H2.5V-31L8 -34Z';
const BOAT = 'M0 -9C3 -6 4 -2 4 2V6C4 8 2 9 0 9S-4 8 -4 6V2C-4 -2 -3 -6 0 -9Z';

/** The no-go wedge, `noGo` radians each side of straight up. */
function noGoWedge(noGo: number): string {
  const x = WEDGE * Math.sin(noGo),
    y = -WEDGE * Math.cos(noGo);
  return `M0 0L${(-x).toFixed(2)} ${y.toFixed(2)}A${WEDGE} ${WEDGE} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`;
}

/** The ring's ticks every 10°, the cardinal ones longer. */
function ticks(): string {
  let d = '';
  for (let b = 0; b < 360; b += 10) {
    const inner = b % 90 === 0 ? INNER - 4 : INNER;
    const s = Math.sin(b * DEG),
      c = -Math.cos(b * DEG);
    d += `M${(s * inner).toFixed(1)} ${(c * inner).toFixed(1)}L${(s * RING).toFixed(1)} ${(c * RING).toFixed(1)}`;
  }
  return d;
}

/** `count` points of the rose, each an ink half and a paper half, the first at `from` degrees. */
function star(count: number, length: number, width: number, from: number): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    const deg = from + (i * 360) / count;
    out +=
      `<g transform="rotate(${deg})"><path class="point-dark" d="M0 0L0 ${-length}L${width} ${-width}Z"/>` +
      `<path class="point-light" d="M0 0L0 ${-length}L${-width} ${-width}Z"/></g>`;
  }
  return out;
}
