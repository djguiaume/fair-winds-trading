import { seaReach, seaShape } from '../../sim/seaEdge';
import type { QuestPoint } from '../../sim/questLibrary';
import { seaMarkShape } from '../../ui/chartMarks';
import { type Layers, drawChart } from '../chart';
import { type Place, stepPlaces } from './doc';
import { stormShapes } from './raceStormView';
import { $, type Tool, qb, quest, render, step } from './state';

/* The quest builder's chart: the map editor's chart with the open step's places drawn over it. */

export const NS = 'http://www.w3.org/2000/svg';
export const layers: Layers = {
  names: true,
  course: false,
  harbours: true,
  grid: false,
  flow: true,
  marks: true,
};
export const svg = () => $<SVGSVGElement>('.qb-map');

const HINTS: Record<Tool, string> = {
  select:
    'Drag a ring to move it, its gold handle to size it · drag the sea to pan, wheel or pinch to zoom',
  add: 'Click the sea to add a place to this step’s reach points (or a timed run’s via points)',
  compass: 'Click the sea to put the step’s compass point there',
  move: 'Click the sea where the step takes the boat when it begins',
  buoy: 'Click the sea to add a buoy the quest shows while it runs',
  storm: 'Click the sea to add a storm the race always has (drag it or its gold handle after)',
};
export const TOOLS: [Tool, string, string][] = [
  ['select', '✥', 'Select and drag'],
  ['add', '◎', 'Add a place to reach'],
  ['compass', '✶', 'Put the compass point'],
  ['move', '⛵', 'Where the step takes the boat'],
  ['buoy', '◍', 'Add a quest buoy'],
  ['storm', '🌀', 'Add a race storm'],
];

export function setTool(next: Tool) {
  qb.tool = next;
  for (const b of qb.root.querySelectorAll<HTMLButtonElement>('.qb-tools button'))
    b.setAttribute('aria-pressed', String(b.dataset.tool === qb.tool));
  $('.qb-hint').textContent = step()
    ? HINTS[qb.tool]
    : 'Pick a step on the left to see and move its places';
}

/** A panel's ⌖ button: back to the chart with a tool that places the field by a click. */
export function pickOnChart(tool: Tool) {
  qb.centre = 'chart';
  setTool(tool);
  render();
}

/** Frames the open step's places, or the open quest's, or the whole sea. */
export function fit() {
  const { view } = qb;
  const map = qb.host.prepared();
  const s = step();
  const q = quest();
  const places = s ? stepPlaces(s, map) : (q?.steps ?? []).flatMap((o) => stepPlaces(o, map));
  const rect = svg().getBoundingClientRect();
  const size = Math.max(1, Math.min(rect.width || 600, rect.height || 600));
  if (!places.length) {
    view.cx = 0;
    view.cy = 0;
    view.upp = ((seaReach(seaShape(map)) + 20) * 2) / size;
    return;
  }
  const xs = places.flatMap((p) => [p.x - p.within, p.x + p.within]);
  const ys = places.flatMap((p) => [p.y - p.within, p.y + p.within]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  view.cx = (x0 + x1) / 2;
  view.cy = (y0 + y1) / 2;
  view.upp = Math.max(0.15, (Math.max(x1 - x0, y1 - y0) + 140) / size);
}

export function zoom(factor: number, at?: QuestPoint) {
  const { view } = qb;
  const p = at ?? { x: view.cx, y: view.cy };
  const upp = Math.min(4, Math.max(0.08, view.upp * factor));
  const k = upp / view.upp;
  view.cx = p.x - (p.x - view.cx) * k;
  view.cy = p.y - (p.y - view.cy) * k;
  view.upp = upp;
}

let places: Place[] = [];
/** The open step's places as last drawn, which the chart's `qp:` / `qr:` hits number. */
export const drawnPlaces = () => places;

export function drawChartView() {
  const el = svg();
  const { host, view } = qb;
  drawChart(el, {
    map: host.map(),
    prepared: host.prepared(),
    shipped: host.shipped(),
    selection: null,
    layers,
    view,
  });
  const px = view.upp;
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'qb-overlay');
  el.append(g);
  const add = (tag: string, a: Record<string, string | number>, text?: string) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(a)) n.setAttribute(k, String(v));
    if (text !== undefined) n.textContent = text;
    g.append(n);
    return n;
  };
  const label = (s: string, x: number, y: number, cls: string, size = 13) =>
    add(
      'text',
      { x, y: -y, class: `qb-l ${cls}`, 'font-size': size * px, 'stroke-width': 3.5 * px },
      s,
    );
  const q = quest();
  const s = step();
  const prepared = host.prepared();
  if (q && qb.showAll)
    q.steps.forEach((o, k) => {
      if (o === s) return;
      for (const p of stepPlaces(o, prepared)) {
        if (p.kind === 'compass') add('path', { d: star(p.x, p.y, 5 * px), class: 'qb-ghost' });
        else add('circle', { cx: p.x, cy: -p.y, r: Math.max(p.within, 3 * px), class: 'qb-ghost' });
        if (p.kind !== 'chart') label(`${k + 1}.${p.no || '✶'}`, p.x, p.y - 1.5 * px, 'ghost', 11);
      }
    });
  // The quest's own sea marks (decision 0164), on every step: they show while it runs.
  for (const m of q?.marks ?? []) {
    const { tag, attrs } = seaMarkShape(m, px * 1.6);
    add(tag, attrs);
    if (m.name) label(m.name, m.x, m.y + 8 * px, 'num', 13);
  }
  // A race's own storms (decision 0225), dragged like a place.
  for (const { tag, attrs, label: text } of stormShapes(q, px)) {
    add(tag, attrs);
    if (text) label(text.text, text.x, text.y, 'tip', 12);
  }
  // Where the step takes the boat, bow pointing her heading.
  if (s?.moveTo) {
    const { x, y } = s.moveTo;
    const a = ((s.moveTo.headingDeg ?? 0) * Math.PI) / 180;
    const pt = (f: number, side: number) =>
      `${x + Math.sin(a) * f * px + Math.cos(a) * side * px},${-(y + Math.cos(a) * f * px - Math.sin(a) * side * px)}`;
    add('path', { d: `M${pt(9, 0)}L${pt(-6, 5)}L${pt(-6, -5)}Z`, class: 'qb-compass' });
    label('boat starts', x, y + 12 * px, 'tip', 12);
  }
  places = s ? stepPlaces(s, prepared) : [];
  // Lines join points in order (reach in-order, a timed run's via).
  for (const kind of ['point', 'via'] as const) {
    const run = places.filter((p) => p.kind === kind && p.ordered);
    if (run.length > 1)
      add('polyline', { points: run.map((p) => `${p.x},${-p.y}`).join(' '), class: 'qb-order' });
  }
  // A race's start and finish lines (decision 0217), from the committee boat to the pin.
  for (const line of ['start', 'finish']) {
    const ends = places.filter((p) => p.line === line);
    if (ends.length === 2)
      add('polyline', { points: ends.map((p) => `${p.x},${-p.y}`).join(' '), class: 'qb-order' });
  }
  places.forEach((p, i) => {
    if (p.kind === 'compass') {
      add('path', { d: star(p.x, p.y, 9 * px), class: 'qb-compass', 'data-hit': `qp:${i}` });
      label('compass', p.x, p.y + 12 * px, 'tip', 12);
      return;
    }
    add('circle', {
      cx: p.x,
      cy: -p.y,
      r: p.within,
      class: `qb-ring is-${p.kind}`,
      'data-hit': p.kind === 'chart' ? '' : `qp:${i}`,
    });
    if (p.kind !== 'chart') {
      add('circle', { cx: p.x, cy: -p.y, r: 5 * px, class: 'qb-handle', 'data-hit': `qp:${i}` });
      label(
        p.name ?? (p.kind === 'spot' ? (p.no === 1 ? 'load' : 'unload') : String(p.no)),
        p.x,
        p.y + p.within + 6 * px,
        'num',
        15,
      );
    } else label('chart circle', p.x, p.y + p.within + 4 * px, 'tip', 12);
    if (p.radiusPath)
      add('circle', {
        cx: p.x + p.within,
        cy: -p.y,
        r: 5 * px,
        class: 'qb-size',
        'data-hit': `qr:${i}`,
      });
  });
}

/** A four-point star, for the compass point. */
function star(x: number, y: number, r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const d = k % 2 ? r * 0.35 : r;
    pts.push(`${x + Math.sin(a) * d},${-y - Math.cos(a) * d}`);
  }
  return `M${pts.join('L')}Z`;
}
