// `npm run chart` (decision 0153): a labelled map of a sea, PNG and SVG, drawn by the map
// editor's own chart code (src/editor/chart.ts) from the real map and island files, plus an
// optional overlay file of proposed places, routes and labels. This is the "map and schema"
// Guillaume sees with every map or layout change.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Window } from 'happy-dom';
import { type Layers, drawChart } from '../../src/editor/chart';
import { zoneKindName, zoneTint } from '../../src/editor/flowChart';
import { type SeaDef, SEAS, grownMap } from '../../src/data/grownMap';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../../src/data/maps';
import { stressMap } from '../../src/data/stressMap';
import type { MapDef } from '../../src/sim/map';
import { harbourApproach, sailRoute } from '../../src/sim/mapChecks';
import { seaMarkShape } from '../../src/ui/chartMarks';

type Args = Record<string, string | boolean | undefined> & { _: string[] };
type Pt = [number, number];

const NS = 'http://www.w3.org/2000/svg';
const ROOT = resolve(import.meta.dirname, '../..');

/** The overlay file: what a layout proposes, drawn over the real sea in map units (y north). */
export interface Overlay {
  title?: string;
  /** Proposed or changed areas: a new island, a reef, a fog bank, a biome tint. */
  areas?: { outline: Pt[]; style?: string; label?: string }[];
  /** Proposed islands as discs, before they have an island file. */
  islands?: { x: number; y: number; radius: number; name?: string; style?: string }[];
  /** Routes, blocked ways, currents to be: a line through the points, `arrow` at the end. */
  lines?: { points: Pt[]; style?: string; label?: string; arrow?: boolean }[];
  /** Free labels; `note` is a smaller second line. */
  labels?: { at: Pt; text: string; note?: string; style?: string }[];
  /** Extra legend lines; the legend lists what is on the map by itself. */
  legend?: { style: string; text: string }[];
}

/** Overlay styles: the class each one draws with, and its legend wording. */
export const OVERLAY_STYLES: Record<string, string> = {
  proposed: 'proposed land',
  land: 'land',
  reef: 'reef',
  bank: 'sandbank',
  shallows: 'shallows',
  zone: 'wind zone',
  fog: 'fog',
  ice: 'ice',
  warm: 'warm water',
  tint: 'area',
  route: 'route',
  short: 'shortcut',
  long: 'long way',
  block: 'blocked',
  current: 'current',
};

export interface ChartOptions {
  map: MapDef;
  prepared: MapDef;
  /** Map shown as dashed ghosts where shapes moved (the editor's "where it was"). */
  shipped?: MapDef;
  layers?: Partial<Layers>;
  /** Map rectangle [west, south, east, north]; the whole sea when left out. */
  view?: [number, number, number, number];
  /** Image width in pixels. */
  width?: number;
  /** Text and line size against the image: 1.5 draws them half as big again (default). */
  scale?: number;
  overlay?: Overlay;
  /** Sailed routes between ports (`start` for the start point), in the map's base wind. */
  routes?: [string, string][];
  title?: string;
  /** False leaves out the side panel with the title and legend. */
  legend?: boolean;
}

/** Width of the title and legend panel, in SVG pixels. */
const PANEL = 270;

const DEFAULT_LAYERS: Layers = {
  names: true,
  course: false,
  harbours: false,
  grid: false,
  flow: true,
  marks: true,
};

/** The chart styles: the editor's own (editor.css "Chart" section, variables filled in). */
function editorStyles(): string {
  const css = readFileSync(join(ROOT, 'src/editor/editor.css'), 'utf8');
  const vars = new Map<string, string>();
  const root = /:root\s*{([^}]*)}/.exec(css)?.[1] ?? '';
  for (const m of root.matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars.set(m[1]!, m[2]!.trim());
  const start = css.indexOf('/* --- Chart');
  const end = css.indexOf('/* ---', start + 10);
  return css.slice(start, end).replace(/var\((--[\w-]+)\)/g, (_, v: string) => vars.get(v) ?? '');
}

/** The game's fonts, inlined so the SVG looks the same anywhere. */
function fontFaces(): string {
  return [
    ['Barlow Condensed', 700, 'barlow-condensed-700'],
    ['Barlow', 500, 'barlow-500'],
    ['Barlow', 700, 'barlow-700'],
  ]
    .map(([family, weight, file]) => {
      const data = readFileSync(join(ROOT, `src/ui/fonts/${file}.woff2`)).toString('base64');
      return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${data}) format('woff2');}`;
    })
    .join('');
}

const STYLES = `
svg.fw-chart { background: #1b7f8c; }
.o-proposed { fill: #a7e07a; fill-opacity: .85; stroke: #fff; stroke-width: 2px; stroke-dasharray: 6 4; vector-effect: non-scaling-stroke; }
.o-land { fill: #7cc04f; stroke: #f2cf7e; stroke-width: 3px; vector-effect: non-scaling-stroke; }
.o-reef { fill: #e86a52; fill-opacity: .4; stroke: #e86a52; stroke-width: 1.5px; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
.o-bank { fill: #f7e3ad; fill-opacity: .6; stroke: #f7e3ad; vector-effect: non-scaling-stroke; }
.o-shallows { fill: #b9ecdf; fill-opacity: .7; stroke: #3fb3a3; stroke-width: 1.4px; stroke-dasharray: 2 3; vector-effect: non-scaling-stroke; }
.o-zone { fill: #f2cf7e; fill-opacity: .2; stroke: #f2cf7e; stroke-width: 2px; stroke-dasharray: 8 5; vector-effect: non-scaling-stroke; }
.o-fog { fill: #dfe7ec; fill-opacity: .4; stroke: #fff; stroke-width: 1.5px; stroke-dasharray: 2 4; vector-effect: non-scaling-stroke; }
.o-ice { fill: #eef8ff; fill-opacity: .8; stroke: #2c5b72; stroke-width: 2px; vector-effect: non-scaling-stroke; }
.o-warm { fill: #ff8a4a; fill-opacity: .2; stroke: #ff8a4a; stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
.o-tint { fill: #fff; fill-opacity: .12; stroke: #fff; stroke-width: 1.5px; stroke-dasharray: 6 6; vector-effect: non-scaling-stroke; }
.o-line { fill: none; stroke-width: 3px; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.o-route { stroke: #fff; stroke-dasharray: 10 6; }
.o-short { stroke: #6fe3c6; stroke-dasharray: 10 6; }
.o-long { stroke: #ffb35c; stroke-dasharray: 10 6; }
.o-block { stroke: #d7263d; stroke-width: 5px; stroke-dasharray: 10 6; }
.o-current { stroke: #13607e; stroke-width: 8px; stroke-opacity: .8; }
.o-sailed { fill: none; stroke: #fff; stroke-width: 2.5px; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.o-label { fill: #fff; stroke: #06141c; stroke-linejoin: round; paint-order: stroke; text-anchor: middle; font-family: 'Barlow', sans-serif; font-weight: 700; }
.o-label.port { fill: #ffe39a; font-family: 'Barlow Condensed', sans-serif; }
.o-label.big { font-family: 'Barlow Condensed', sans-serif; letter-spacing: .08em; fill-opacity: .9; }
.o-label.zone { fill: #fff7d6; }
.o-label.note { fill: #e6f4f6; font-weight: 500; font-style: italic; }
.fw-chart .fw-title { fill: #ffe39a; font: 700 26px 'Barlow Condensed', sans-serif; paint-order: stroke; stroke: #06141c; stroke-width: 5px; }
.fw-legend rect.box { fill: #0d2433e8; stroke: #e8c46a; stroke-width: 1.5px; }
.fw-legend text { fill: #eef3f4; font: 500 14px 'Barlow', sans-serif; }
`;

/** Label sizes in screen pixels, by style. */
const LABEL_SIZE: Record<string, number> = { port: 24, name: 17, zone: 16, note: 13, big: 40 };

function findPoint(map: MapDef, id: string): { x: number; y: number } {
  if (id === 'start') return map.start;
  const port =
    map.ports.find((p) => p.id === id) ??
    map.ports.find((p) => p.name.toLowerCase() === id.toLowerCase());
  if (!port) throw new Error(`no port "${id}" (use a port id, a port name or start)`);
  return harbourApproach(map, port);
}

/** Draws the chart; returns the SVG text and what it drew. */
export function renderChart(opts: ChartOptions) {
  const { map, prepared, overlay = {} } = opts;
  const layers = { ...DEFAULT_LAYERS, ...opts.layers };
  const r = map.boundsRadius;
  const [x0, y0, x1, y1] = opts.view ?? [-r - 10, -r - 10, r + 10, r + 10];
  // The SVG is laid out at width / scale pixels; the PNG is shot at `scale` device pixels each.
  const scale = opts.scale ?? 1.5;
  const width = Math.round((opts.width ?? 1600) / scale);
  const height = Math.round((width * (y1 - y0)) / (x1 - x0));
  const upp = (x1 - x0) / width;

  const doc = new Window().document as unknown as Document;
  const make = (tag: string, attrs: Record<string, string | number>, parent?: Element) => {
    const node = doc.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    parent?.append(node);
    return node;
  };
  const title = opts.title ?? overlay.title;
  const side = opts.legend === false ? 0 : PANEL;
  const outer = make('svg', { xmlns: NS, class: 'fw-chart' });
  make('style', {}, outer).textContent = fontFaces() + editorStyles() + STYLES;
  const chart = make('svg', { x: 0, y: 0, width, height }, outer) as SVGSVGElement;
  drawChart(chart, {
    map,
    prepared,
    shipped: opts.shipped ?? map,
    selection: null,
    layers,
    view: { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, upp },
    size: { width, height },
  });
  // The editor shows a hit disc over each island and the start boat; a still chart drops both.
  for (const node of [...chart.querySelectorAll('[data-hit]')]) {
    if (node.getAttribute('data-hit') === 'start') node.remove();
    else node.removeAttribute('data-hit');
  }
  for (const node of [...chart.querySelectorAll('.c-label')])
    if (node.textContent === 'start') node.remove();

  const g = make('g', { class: 'fw-overlay' }, chart);
  const pts = (outline: Pt[]) => outline.map(([x, y]) => `${x},${-y}`).join(' ');
  const label = (at: Pt, text: string, style = 'name', dy = 0) => {
    const size = LABEL_SIZE[style] ?? 16;
    make(
      'text',
      {
        x: at[0],
        y: -at[1] + dy * upp,
        class: `o-label ${style}`,
        'font-size': size * upp,
        'stroke-width': (size > 30 ? 6 : 4) * upp,
      },
      g,
    ).textContent = text;
    return size;
  };

  // Sailed routes: the route checks' own planner, in the base wind.
  const sailed: { from: string; to: string; seconds: number | null }[] = [];
  for (const [from, to] of opts.routes ?? []) {
    const route = sailRoute(
      prepared,
      findPoint(prepared, from),
      findPoint(prepared, to),
      prepared.wind.fromDeg,
    );
    sailed.push({ from, to, seconds: route ? Math.round(route.seconds) : null });
    if (route)
      make(
        'polyline',
        { points: route.points.map((p) => `${p.x},${-p.y}`).join(' '), class: 'o-sailed' },
        g,
      );
  }

  const used = new Set<string>();
  for (const a of overlay.areas ?? []) {
    const style = a.style ?? 'proposed';
    used.add(style);
    make('polygon', { points: pts(a.outline), class: `o-${style}` }, g);
  }
  for (const i of overlay.islands ?? []) {
    const style = i.style ?? 'proposed';
    used.add(style);
    make('circle', { cx: i.x, cy: -i.y, r: i.radius, class: `o-${style}` }, g);
  }
  const defs = make('defs', {}, g);
  for (const l of overlay.lines ?? []) {
    const style = l.style ?? 'route';
    used.add(style);
    const attrs: Record<string, string> = { points: pts(l.points), class: `o-line o-${style}` };
    if (l.arrow) {
      const id = `arrow-${style}`;
      if (!defs.querySelector(`#${id}`)) {
        const marker = make(
          'marker',
          {
            id,
            viewBox: '0 0 10 10',
            refX: 5,
            refY: 5,
            markerWidth: 4,
            markerHeight: 4,
            orient: 'auto-start-reverse',
          },
          defs,
        );
        make(
          'path',
          { d: 'M0,0 L10,5 L0,10 Z', class: `o-${style}`, fill: 'currentColor' },
          marker,
        );
      }
      attrs['marker-end'] = `url(#${id})`;
    }
    make('polyline', attrs, g);
  }
  // Names last, so they sit over every shape.
  for (const a of overlay.areas ?? []) if (a.label) label(centre(a.outline), a.label, 'name');
  for (const i of overlay.islands ?? [])
    if (i.name) label([i.x, i.y + i.radius], i.name, 'name', -8);
  for (const l of overlay.lines ?? [])
    if (l.label) label(l.points[Math.floor(l.points.length / 2)]!, l.label, 'note', -6);
  for (const l of overlay.labels ?? []) {
    const size = label(l.at, l.text, l.style ?? 'name');
    if (l.note) label(l.at, l.note, 'note', size * 0.95);
  }

  // Title and legend in a panel beside the map, in screen pixels, so they never hide the sea.
  let full = height;
  if (side) {
    const lg = make('g', { class: 'fw-legend', transform: `translate(${width} 0)` }, outer);
    const box = make('rect', { class: 'box', x: 0, y: 0, width: side, height }, lg);
    let y = 14;
    for (const line of wrap(title ?? '', 22)) {
      make('text', { x: 14, y: y + 22, class: 'fw-title' }, lg).textContent = line;
      y += 28;
    }
    if (title) y += 8;
    const entries = legendEntries(inView(map, [x0, y0, x1, y1]), layers, used, sailed, overlay);
    const lh = 22;
    entries.forEach((e, k) => {
      const at = y + k * lh;
      const sw = make('g', { transform: `translate(14 ${at + 3})` }, lg);
      // Swatches sit on sea colour, so tints read as they do on the map.
      make('rect', { width: 24, height: 14, fill: '#2aa6b4' }, sw);
      e.swatch(sw, make);
      for (const [n, line] of wrap(e.text, 30).entries())
        make('text', { x: 46, y: at + 15 + n * 16 }, lg).textContent = line;
      y += (wrap(e.text, 30).length - 1) * 16;
    });
    full = Math.max(height, y + entries.length * lh + 14);
    box.setAttribute('height', String(full));
  }
  outer.setAttribute('width', String(width + side));
  outer.setAttribute('height', String(full));
  outer.setAttribute('viewBox', `0 0 ${width + side} ${full}`);
  if (!side && title) make('text', { x: 16, y: 34, class: 'fw-title' }, outer).textContent = title;

  return {
    svg: outer.outerHTML,
    width: width + side,
    height: full,
    scale,
    view: [x0, y0, x1, y1] as [number, number, number, number],
    routes: sailed,
    counted: {
      islands: map.islands.length,
      ports: map.ports.length,
      marks: layers.marks ? (map.marks?.length ?? 0) : 0,
      zones: layers.flow ? (map.windZones?.length ?? 0) : 0,
      currents: layers.flow ? (map.currents?.length ?? 0) : 0,
    },
  };
}

/** The map's shapes and marks that show in the view, so the legend lists only those. */
function inView(map: MapDef, [x0, y0, x1, y1]: [number, number, number, number]): MapDef {
  const near = (p: readonly number[]) => p[0]! >= x0 && p[0]! <= x1 && p[1]! >= y0 && p[1]! <= y1;
  const any = (outline?: readonly (readonly number[])[]) => !!outline?.some(near);
  return {
    ...map,
    terrain: map.terrain?.filter((t) => any(t.outline)),
    windZones: map.windZones?.filter((z) => any(z.outline)),
    currents: map.currents?.filter((c) => any(c.outline) || any(c.path)),
    marks: map.marks?.filter((m) => near([m.x, m.y])),
  };
}

/** Splits text into lines of at most `n` characters, at spaces. */
function wrap(text: string, n: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(' ').filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + word.length < n)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

function centre(outline: Pt[]): Pt {
  const xs = outline.map((p) => p[0]),
    ys = outline.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

type Make = (tag: string, attrs: Record<string, string | number>, parent?: Element) => Element;
interface Entry {
  text: string;
  swatch: (g: Element, make: Make) => void;
}

/** One legend line per kind of thing on the map, then the overlay's styles and lines. */
function legendEntries(
  map: MapDef,
  layers: Layers,
  used: Set<string>,
  sailed: { from: string; to: string; seconds: number | null }[],
  overlay: Overlay,
): Entry[] {
  const box =
    (cls: string, extra: Record<string, string> = {}) =>
    (g: Element, make: Make) =>
      make('rect', { width: 24, height: 14, class: cls, ...extra }, g);
  const stroke = (cls: string) => (g: Element, make: Make) =>
    make('line', { x1: 0, y1: 7, x2: 24, y2: 7, class: cls }, g);
  const out: Entry[] = [{ text: 'island', swatch: box('c-land') }];
  const kinds = new Set((map.terrain ?? []).map((t) => t.kind));
  if (kinds.has('reef')) out.push({ text: 'reef', swatch: box('c-reef') });
  if (kinds.has('sandbank')) out.push({ text: 'sandbank', swatch: box('c-bank') });
  if (kinds.has('shallows'))
    out.push({ text: 'shallows: shallow keels only', swatch: box('c-shallows') });
  if (layers.flow) {
    for (const kind of new Set((map.windZones ?? []).map((z) => z.kind)))
      out.push({
        text: `wind zone: ${zoneKindName(kind)}`,
        swatch: box('', { fill: zoneTint(kind), 'fill-opacity': '0.45' }),
      });
    if (map.currents?.length) out.push({ text: 'current', swatch: box('c-current') });
  }
  if (layers.marks) {
    const types = new Set((map.marks ?? []).map((m) => m.type));
    const mark = (type: string, text: string) =>
      out.push({
        text,
        swatch: (g, make) => {
          const { tag, attrs } = seaMarkShape(
            { type: type as never, x: 12, y: -7 },
            type === 'light' ? 1.1 : 1.6,
          );
          make(tag, attrs, g);
        },
      });
    if (types.has('light')) mark('light', 'light');
    if ([...types].some((t) => t.startsWith('cardinal-'))) mark('cardinal-north', 'cardinal mark');
    if (types.has('buoy-red') || types.has('buoy-green')) mark('buoy-red', 'channel buoy');
  }
  for (const style of used)
    if (!['route', 'short', 'long', 'block', 'current'].includes(style))
      out.push({ text: OVERLAY_STYLES[style] ?? style, swatch: box(`o-${style}`) });
  const lineText = new Map<string, string>();
  for (const l of overlay.lines ?? []) {
    const style = l.style ?? 'route';
    if (!lineText.has(style)) lineText.set(style, OVERLAY_STYLES[style] ?? style);
  }
  for (const [style, text] of lineText) out.push({ text, swatch: stroke(`o-line o-${style}`) });
  for (const s of sailed)
    out.push({
      text: `${s.from} → ${s.to}: ${s.seconds === null ? 'no way through' : `${s.seconds} s sailed`}`,
      swatch: stroke('o-sailed'),
    });
  for (const e of overlay.legend ?? [])
    out.push({
      text: e.text,
      swatch: ['route', 'short', 'long', 'block', 'current'].includes(e.style)
        ? stroke(`o-line o-${e.style}`)
        : box(`o-${e.style}`),
    });
  return out;
}

/** The named seas, an editor export (a whole map) or one sea file merged round the ring. */
export function loadSea(name: string): { map: MapDef; prepared: MapDef; label: string } {
  if (name === 'ring') return { map: PHASE1_SOURCE, prepared: PHASE1_MAP, label: 'ring' };
  if (name === 'stress') {
    const map = stressMap(PHASE1_SOURCE);
    return { map, prepared: prepareMap(map), label: 'stress' };
  }
  if (name === 'phase4') {
    const map = grownMap(PHASE1_SOURCE);
    return { map, prepared: prepareMap(map), label: 'phase4' };
  }
  const data = JSON.parse(readFileSync(name, 'utf8')) as MapDef | SeaDef;
  const label = name.replace(/^.*\//, '').replace(/\.json$/, '');
  if ('boundsRadius' in data) return { map: data, prepared: prepareMap(data), label };
  // A sea file (src/data/seas/*.json): it replaces the shipped sea with the same id.
  const map = grownMap(PHASE1_SOURCE, [...SEAS.filter((s) => s.id !== data.id), data]);
  return { map, prepared: prepareMap(map), label };
}

/** `--around id|x,y --radius r`, or `--view west,south,east,north`. */
function parseView(args: Args, map: MapDef): [number, number, number, number] | undefined {
  const nums = (v: unknown) => (typeof v === 'string' ? v.split(',').map(Number) : []);
  if (typeof args.view === 'string') {
    const v = nums(args.view);
    if (v.length !== 4 || v.some(Number.isNaN))
      throw new Error('--view wants west,south,east,north');
    return v as [number, number, number, number];
  }
  if (args.around) {
    const a = String(args.around);
    let c: { x: number; y: number };
    if (/^-?[\d.]+,-?[\d.]+$/.test(a)) {
      const [x, y] = nums(a);
      c = { x: x!, y: y! };
    } else {
      const island =
        map.islands.find((i) => i.id === a || i.name?.toLowerCase() === a.toLowerCase()) ??
        map.islands.find((i) => i.id === map.ports.find((p) => p.id === a)?.islandId);
      if (!island) throw new Error(`no island or port "${a}"`);
      c = island;
    }
    const r = Number(args.radius ?? 200);
    return [c.x - r, c.y - r, c.x + r, c.y + r];
  }
  return undefined;
}

export async function writePng(
  svgFile: string,
  pngFile: string,
  width: number,
  height: number,
  scale = 1,
) {
  const { chromium } = await import('playwright');
  const launch = async () => {
    try {
      return await chromium.launch();
    } catch {
      return await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    }
  };
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
    await page.goto(`file://${resolve(svgFile)}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: pngFile });
  } finally {
    await browser.close();
  }
}

export async function run(args: Args): Promise<number> {
  if (args.help) {
    console.log(`npm run chart [-- options]   a labelled map, PNG + SVG, from the real map and island files
  --sea ring|stress|phase4|file.json  the sea (default ring); a file is an editor export, or a
                                      sea file (src/data/seas/*.json shape) merged round the ring
  --overlay file.json                 proposed areas, islands, lines and labels (see docs/tools/chart.md)
  --around id|x,y [--radius 200]      centre on an island, a port or a point (map units)
  --view west,south,east,north        the map rectangle to draw (default the whole sea)
  --route a,b[;c,d]                   sail these legs with the route checks' planner (port ids
                                      or names, or start) and draw them with their time
  --layers names,flow,marks           what to draw: names, flow, marks, harbours, course, grid
  --ghosts                            dashed outlines where shapes sat on the shipped ring
  --title "…"                         title above the legend
  --legend none                       no side panel (title and legend)
  --width 1600                        PNG width in pixels
  --scale 1.5                         text and line size (the SVG is width / scale wide)
  --out path                          writes path.svg and path.png (default output/chart/<sea>)
  --svg                               SVG only, no Chromium
  --json                              what was written, as JSON`);
    return 0;
  }
  const { map, prepared, label } = loadSea(String(args.sea ?? 'ring'));
  const overlay =
    typeof args.overlay === 'string'
      ? (JSON.parse(readFileSync(args.overlay, 'utf8')) as Overlay)
      : undefined;
  const layers =
    typeof args.layers === 'string'
      ? Object.fromEntries(
          (Object.keys(DEFAULT_LAYERS) as (keyof Layers)[]).map((k) => [
            k,
            (args.layers as string).split(',').includes(k),
          ]),
        )
      : undefined;
  const routes =
    typeof args.route === 'string'
      ? args.route.split(';').map((leg) => leg.split(',') as [string, string])
      : undefined;
  const result = renderChart({
    map,
    prepared,
    shipped: args.ghosts ? PHASE1_SOURCE : undefined,
    layers,
    view: parseView(args, map),
    width: args.width ? Number(args.width) : undefined,
    scale: args.scale ? Number(args.scale) : undefined,
    overlay,
    routes,
    title: typeof args.title === 'string' ? args.title : undefined,
    legend: args.legend !== 'none',
  });
  const base = String(args.out ?? join('output/chart', label)).replace(/\.(svg|png)$/, '');
  mkdirSync(dirname(resolve(base)), { recursive: true });
  writeFileSync(`${base}.svg`, result.svg);
  const files = [`${base}.svg`];
  if (!args.svg) {
    await writePng(`${base}.svg`, `${base}.png`, result.width, result.height, result.scale);
    files.push(`${base}.png`);
  }
  if (args.json) {
    const { svg: _svg, ...rest } = result;
    void _svg;
    console.log(JSON.stringify({ files, ...rest }, null, 1));
    return 0;
  }
  const c = result.counted;
  console.log(
    `wrote ${files.join(', ')} (${Math.round(result.width * result.scale)}×${Math.round(result.height * result.scale)}; ${c.islands} islands, ${c.ports} ports, ${c.marks} marks, ${c.zones} zones, ${c.currents} currents)`,
  );
  for (const s of result.routes)
    console.log(
      `  ${s.from} → ${s.to}: ${s.seconds === null ? 'no way through' : `${s.seconds} s`}`,
    );
  return result.routes.some((s) => s.seconds === null) ? 1 : 0;
}
