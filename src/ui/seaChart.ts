import { islandCoasts, islandLake } from '../sim/islandLayout';
import type { World } from '../sim/world';
import type { SeaMarkDef } from '../sim/map';
import { WIND_FORCES, windForce } from '../sim/windStrength';
import { GOODS, type GoodId, isMadeGood } from '../sim/goods';
import { madeGoods, questsDone } from '../sim/settlement';
import { questShown } from '../data/islands';
import { type PortQuote, quoteAcross } from '../sim/market';
import { DEG, distance } from '../sim/math';
import { discoveredPorts } from '../sim/shipyards';
import { ownedIslands } from '../sim/home';
import { chartedAt, islandCharted } from '../sim/fog';
import { noGoAngle } from '../sim/ship';
import { laneShape } from '../sim/currents';
import { knobs } from '../sim/difficulty';
import { coastDistance } from '../sim/coast';
import { areaCrests, laneCrests, laneEdges, smoothOutline } from '../sim/flowShapes';
import { TUNING } from '../data/tuning';
import { goodName, t, zoneKindName } from '../i18n';
import { icon, COIN } from './icons';
import { drawHazard } from './hazardMarker';
import { seaMarkShape } from './chartMarks';
import { portraitSvg } from './portraits';
import type { JournalEntry, QuestPin, QuestTarget, StepMarker } from './questView';

const NS = 'http://www.w3.org/2000/svg';

type Box = { x0: number; y0: number; x1: number; y1: number };
const box = (cx: number, cy: number, w: number, h: number): Box => ({
  x0: cx - w / 2,
  y0: cy - h / 2,
  x1: cx + w / 2,
  y1: cy + h / 2,
});
/** Chart scale (map units per pixel) beyond which secondary names are left out. */
const MAX_UNITS_PER_PIXEL_FOR_NAMES = 3;
/** Fog of war's rim (decision 0156): stroke half-widths in pixels and mask greys, outer first. */
const FOG_RIM: [number, string][] = [
  [10, 'rgb(170,170,170)'],
  [5, 'rgb(85,85,85)'],
];
/** Fog of war's blurred edge on High quality, in pixels (decision 0156). */
const FOG_BLUR = 8;
/** How far round a sighted island its patch of chart reaches, in map units (plus the blur). */
const SIGHTED_MARGIN = 12;

/** Overlapping area of two boxes, used to choose the clearest side for a label. */
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
  Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** A charted wind zone's name, placed with the other labels (decision 0152). */
interface ZoneLabel {
  text: string;
  kind: string;
  /** Chart coordinates (y down) of the spot deepest inside the zone. */
  x: number;
  y: number;
  /** The zone's edge in map coordinates: the name only shows where it fits inside. */
  outline: [number, number][];
}

/** The spot deepest inside an outline, on a coarse grid: where its name fits best. */
function deepestPoint(outline: [number, number][]) {
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

/** What the chart shows of the quests (decision 0124); see `questView.ts`. */
export interface ChartQuests {
  pins(): QuestPin[];
  target(): QuestTarget | null;
  /** The tracked step's places at sea (decision 0130); left out, none. */
  markers?(): StepMarker[];
  journal(): JournalEntry[];
  track(quest: string): void;
  /** Offer an ignored quest again (decision 0141). */
  takeUp?(quest: string): void;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** An event-driven DOM/SVG chart; no second WebGL scene or animation loop. */
export class SeaChart {
  /** Blur fog of war's edge (High quality only, decision 0156). */
  fogBlur = false;
  onChange: () => void = () => {};
  /** People's faces on their ports, the tracked step's place and the journal; none: no quests. */
  quests: ChartQuests | null = null;
  onDestinationChange: () => void = () => {};
  /** The running quests' own sea marks (decision 0164), drawn while they run. */
  questMarks: () => readonly SeaMarkDef[] = () => [];
  private previousFocus: HTMLElement | null = null;
  /** Good whose prices show under the port names; null shows names only. */
  private good: GoodId | null = null;
  /** Until the player picks a good, the chart follows the cargo in the hold. */
  private goodPicked = false;
  private zoom = 1;
  private center = { x: 0, y: 0 };
  private panel: string | null = null;
  private dragged = false;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private drag: { id: number; x: number; y: number; cx: number; cy: number; unit: number } | null =
    null;
  // No animation loop: redraw only on open, edits, zoom or a viewport resize.
  private readonly resizeObserver: ResizeObserver | null;

  constructor(
    private readonly dialog: HTMLDialogElement,
    private readonly world: World,
    private readonly harbours: Record<string, { x: number; y: number }>,
  ) {
    try {
      // Chart markers were removed (decision 0058); drop what older versions stored.
      localStorage.removeItem(`fwt.chart.v1.${world.map.name}`);
    } catch {
      /* Chart storage is optional and never touches voyage saves. */
    }
    this.setupTools();
    const viewport = dialog.querySelector('.chart-viewport');
    this.resizeObserver =
      typeof ResizeObserver !== 'undefined' && viewport
        ? new ResizeObserver(() => {
            if (this.isOpen) this.draw();
          })
        : null;
    if (viewport) this.resizeObserver?.observe(viewport);
    this.get('close-chart').addEventListener('click', () => this.close());
    this.get('chart-clear-target').addEventListener('click', () => {
      world.destination = null;
      this.onDestinationChange();
      this.draw();
      this.status(t('chart.statusCleared'));
    });
    dialog.addEventListener('close', () => {
      this.onChange();
      this.previousFocus?.focus({ preventScroll: true });
    });
  }

  private setPanel(name: string | null) {
    this.panel = name;
    for (const id of ['legend', 'market', 'journal']) {
      const panel = this.dialog.querySelector<HTMLElement>(`#chart-${id}-panel`);
      if (panel) panel.hidden = name !== id;
      this.dialog
        .querySelector(`#chart-${id}-toggle`)
        ?.setAttribute('aria-expanded', String(name === id));
    }
  }
  private setupTools() {
    this.dialog.querySelector('#chart-journal-list')?.addEventListener('click', (e) => {
      const row = (e.target as Element).closest<HTMLElement>('[data-track], [data-take-up]');
      if (!row || !this.quests) return;
      if (row.dataset.track) this.quests.track(row.dataset.track);
      else this.quests.takeUp?.(row.dataset.takeUp!);
      this.draw();
    });
    for (const id of ['legend', 'market', 'journal']) {
      this.dialog.querySelector(`#chart-${id}-toggle`)?.addEventListener('click', () => {
        this.setPanel(this.panel === id ? null : id);
      });
    }
    const closePanel = () => {
      const previous = this.panel;
      this.setPanel(null);
      this.dialog.querySelector<HTMLButtonElement>(`#chart-${previous}-toggle`)?.focus();
    };
    for (const button of this.dialog.querySelectorAll('[data-chart-close]'))
      button.addEventListener('click', closePanel);
    this.dialog.addEventListener('cancel', (event) => {
      if (this.panel) {
        event.preventDefault();
        closePanel();
      }
    });
    this.dialog.querySelector('#chart-zoom-in')?.addEventListener('click', () => this.zoomBy(1.5));
    this.dialog
      .querySelector('#chart-zoom-out')
      ?.addEventListener('click', () => this.zoomBy(1 / 1.5));
    this.dialog.querySelector('#chart-fit')?.addEventListener('click', () => this.fit());
    const svg = this.get('chart-map');
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', (event) => {
      if (event.target !== svg) return;
      const step = 60 * this.unitsPerPixel();
      if (event.key === 'ArrowLeft') this.center.x -= step;
      else if (event.key === 'ArrowRight') this.center.x += step;
      else if (event.key === 'ArrowUp') this.center.y -= step;
      else if (event.key === 'ArrowDown') this.center.y += step;
      else return;
      event.preventDefault();
      this.updateViewBox();
      this.settleLabels();
    });
    // A drag must never select a port on pointer release.
    svg.addEventListener(
      'click',
      (event) => {
        if (this.dragged) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );
    svg.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      this.dragged = false;
      this.drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        cx: this.center.x,
        cy: this.center.y,
        unit: this.unitsPerPixel(),
      };
    });
    svg.addEventListener('pointermove', (event) => {
      const d = this.drag;
      if (!d || event.pointerId !== d.id) return;
      const dx = event.clientX - d.x,
        dy = event.clientY - d.y;
      if (!this.dragged && Math.hypot(dx, dy) < 6) return;
      this.dragged = true;
      svg.setPointerCapture(event.pointerId);
      this.center = { x: d.cx - dx * d.unit, y: d.cy - dy * d.unit };
      this.updateViewBox();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      svg.addEventListener(type, () => {
        if (this.drag && this.dragged) this.settleLabels();
        this.drag = null;
      });
    // Reuse the Sea HUD instrument geometry; the chart snapshot has no pulses or help dialog.
    const source = document.querySelector('#wind-compass svg');
    const dial = this.dialog.querySelector('#chart-dial');
    if (source && dial) {
      const copy = source.cloneNode(true) as SVGSVGElement;
      for (const element of copy.querySelectorAll('[id]')) element.removeAttribute('id');
      dial.replaceChildren(copy);
    }
  }
  /**
   * Closest zoom: the same detail as 3x on the Windward Ring (sea radius 440) on any sea, so a
   * bigger map zooms in further rather than drawing its islands smaller (decision 0115).
   */
  private get maxZoom() {
    return Math.max(3, (3 * (this.world.map.boundsRadius + 24)) / (440 + 24));
  }
  /**
   * Charted currents (decision 0140): the same darker water with its crests as at sea, and its
   * speed, once she has sailed in it. Drawn once per chart render, static.
   */
  private drawCurrents(
    shape: (tag: string, attrs: Record<string, string | number>, parent?: Element) => Element,
    unit: number,
  ) {
    const { map, trade } = this.world;
    const charted = trade.progress.charted ?? [];
    const currents = (map.currents ?? []).filter((c) => charted.includes(c.id));
    if (!currents.length || !this.world.currentsOn) return;
    const defs = shape('defs', {});
    const blur = shape(
      'filter',
      { id: 'chart-soft', x: '-20%', y: '-20%', width: '140%', height: '140%' },
      defs,
    );
    shape('feGaussianBlur', { stdDeviation: TUNING.weather.currents.edgeFadeUnits / 2 }, blur);
    const pts = (ps: readonly (readonly number[])[]) => ps.map(([x, y]) => `${x},${-y!}`).join(' ');
    const scale = knobs(trade.difficulty).currents;
    for (const c of currents) {
      const lane = laneShape(c);
      const band = lane
        ? (({ left, right }) => [...left, ...right.reverse()])(laneEdges(lane.points))
        : c.outline && smoothOutline(c.outline);
      if (!band) continue;
      shape('polygon', { points: pts(band), class: 'chart-current', filter: 'url(#chart-soft)' });
      const crests = lane
        ? laneCrests(lane.points, 0, TUNING.weather.currents.endFadeUnits)
        : areaCrests(band, c.towardDeg ?? 0, 0);
      const g = shape('g', { class: 'chart-crests', 'stroke-width': 1.6 * unit });
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
        'font-size': 11 * unit,
      });
      label.textContent = t('chart.current', {
        name: c.name ?? '',
        n: (c.speedKn * scale).toFixed(1),
      });
    }
  }

  /**
   * Fog of war (decision 0156): the uncharted waters as blank parchment with a faint pencil grid
   * (Guillaume's pick, look A), one layer with holes where the ring, the charted areas and the
   * sighted islands are. The holes' edges are two grey strokes in the mask, a soft rim without a
   * blur filter, which old tablets draw slowly. Returns an "Uncharted waters" label per fogged
   * area, placed with the zones' names so it never covers a port, a place or the boat.
   */
  private drawFog(
    shape: (tag: string, attrs: Record<string, string | number>, parent?: Element) => Element,
    px: number,
  ): ZoneLabel[] {
    const { map, trade } = this.world;
    const fog = map.fog;
    if (!fog) return [];
    const R = map.boundsRadius;
    const progress = trade.progress;
    const defs = shape('defs', {});
    const mask = shape(
      'mask',
      {
        id: 'chart-fog-mask',
        maskUnits: 'userSpaceOnUse',
        x: -R,
        y: -R,
        width: 2 * R,
        height: 2 * R,
      },
      defs,
    );
    shape('circle', { r: R + 2, fill: '#fff' }, mask);
    const polygon = (outline: [number, number][]) => ({
      tag: 'polygon',
      attrs: { points: outline.map(([x, y]) => `${x},${-y}`).join(' ') },
    });
    // A blur eats into small holes, so a sighted island's patch grows by the blur.
    const margin = SIGHTED_MARGIN + (this.fogBlur ? 2 * FOG_BLUR * px : 0);
    const holes: { tag: string; attrs: Record<string, number | string> }[] = [
      { tag: 'circle', attrs: { r: fog.chartedRadius } },
      ...fog.areas.filter((a) => progress.areas?.includes(a.id)).map((a) => polygon(a.outline)),
      ...map.islands
        .filter((i) => progress.sighted?.includes(i.id))
        .map((i) => ({ tag: 'circle', attrs: { cx: i.x, cy: -i.y, r: i.radius + margin } })),
    ];
    // The rim: on High quality a blur; else mask greys, lighter (less fog) nearer the hole.
    let target: Element = mask;
    if (this.fogBlur) {
      const filter = shape(
        'filter',
        {
          id: 'chart-fog-blur',
          x: -R,
          y: -R,
          width: 2 * R,
          height: 2 * R,
          filterUnits: 'userSpaceOnUse',
        },
        defs,
      );
      shape('feGaussianBlur', { stdDeviation: FOG_BLUR * px }, filter);
      target = shape('g', { filter: 'url(#chart-fog-blur)' }, mask);
      shape('circle', { r: R + 2, fill: '#fff' }, target);
    } else
      for (const [width, grey] of FOG_RIM)
        for (const h of holes)
          shape(
            h.tag,
            {
              ...h.attrs,
              fill: 'none',
              stroke: grey,
              'stroke-width': width * px * 2,
              'stroke-linejoin': 'round',
            },
            mask,
          );
    for (const h of holes) shape(h.tag, { ...h.attrs, fill: '#000' }, target);
    const tile = 60 * px;
    const pattern = shape(
      'pattern',
      { id: 'chart-fog-pattern', patternUnits: 'userSpaceOnUse', width: tile, height: tile },
      defs,
    );
    shape('rect', { width: tile, height: tile, class: 'chart-fog-paper' }, pattern);
    shape(
      'path',
      { d: `M0 0H${tile}M0 0V${tile}`, class: 'chart-fog-grid', 'stroke-width': px },
      pattern,
    );
    shape('circle', { r: R, fill: 'url(#chart-fog-pattern)', mask: 'url(#chart-fog-mask)' });
    return fog.areas
      .filter((a) => !progress.areas?.includes(a.id))
      .map((a) => {
        const deep = deepestPoint(a.outline);
        return {
          text: t('chart.uncharted'),
          kind: 'fog',
          x: deep.x,
          y: -deep.y,
          outline: a.outline,
        };
      });
  }

  /**
   * Charted wind zones (decision 0152): once she has sailed well inside a named zone, its edge as
   * a faint dashed line in its kind's colour, under the land. Returns the labels ("The Glass ·
   * doldrums"), each at the spot deepest inside its zone, to place over everything else.
   */
  private drawZones(
    shape: (tag: string, attrs: Record<string, string | number>, parent?: Element) => Element,
    unit: number,
  ): ZoneLabel[] {
    const { map, trade } = this.world;
    const charted = trade.progress.zones ?? [];
    const zones = (map.windZones ?? []).filter((z) => z.name && charted.includes(z.id));
    if (!zones.length || !this.world.windZones) return [];
    return zones.map((z) => {
      const outline = smoothOutline(z.outline);
      const kind = z.kind.replace(/[^a-z-]/g, '');
      shape('polygon', {
        points: outline.map(([x, y]) => `${x},${-y}`).join(' '),
        class: `chart-zone chart-zone-${kind}`,
        'stroke-width': 1.4 * unit,
        'stroke-dasharray': `${6 * unit} ${4 * unit}`,
      });
      const deep = deepestPoint(outline);
      return {
        text: t('chart.zone', { name: z.name!, kind: zoneKindName(z.kind) }),
        kind,
        x: deep.x,
        y: -deep.y,
        outline,
      };
    });
  }

  private unitsPerPixel() {
    const rect = this.get('chart-map').getBoundingClientRect();
    return (
      ((this.world.map.boundsRadius + 24) * 2) /
      this.zoom /
      // In landscape the goods column and the compass sit beside the round sea, not over it.
      Math.max(
        1,
        Math.min(
          (rect.width || 600) - ((rect.width || 600) > (rect.height || 600) ? 300 : 0),
          rect.height || 600,
        ),
      )
    );
  }
  private updateViewBox() {
    const svg = this.get('chart-map');
    const rect = svg.getBoundingClientRect();
    const unit = this.unitsPerPixel();
    const hw = ((rect.width || 600) * unit) / 2,
      hh = ((rect.height || 600) * unit) / 2;
    const extent = this.world.map.boundsRadius + 24;
    this.center.x = Math.max(
      -Math.max(0, extent - hw),
      Math.min(Math.max(0, extent - hw), this.center.x),
    );
    this.center.y = Math.max(
      -Math.max(0, extent - hh),
      Math.min(Math.max(0, extent - hh), this.center.y),
    );
    svg.setAttribute('viewBox', `${this.center.x - hw} ${this.center.y - hh} ${hw * 2} ${hh * 2}`);
    const plus = this.dialog.querySelector<HTMLButtonElement>('#chart-zoom-in');
    const minus = this.dialog.querySelector<HTMLButtonElement>('#chart-zoom-out');
    if (plus) plus.disabled = this.zoom >= this.maxZoom;
    if (minus) minus.disabled = this.zoom <= 1;
  }
  private drawCompass() {
    const { wind, boat, ship, destination, shelter } = this.world;
    const compass = this.dialog.querySelector<HTMLElement>('#chart-compass');
    if (!compass) return;
    const degrees = (wind.from / DEG + 360) % 360;
    const force = windForce(wind.speedKn);
    compass.dataset.force = String(force);
    compass.setAttribute(
      'aria-label',
      t('chart.windLabel', {
        deg: Math.round(degrees),
        kn: wind.speedKn.toFixed(0),
        force: t(`windForce.${WIND_FORCES[force]}`),
      }),
    );
    const rotate = (element: Element | null | undefined, angle: number) =>
      element?.setAttribute('transform', `rotate(${angle})`);
    rotate(compass.querySelector('.nogo')?.parentElement, degrees);
    rotate(compass.querySelector('.band')?.parentElement, degrees);
    const x = 40 * Math.sin(noGoAngle(ship)),
      y = -40 * Math.cos(noGoAngle(ship));
    compass.querySelector('.nogo')?.setAttribute('d', `M0 0 L${-x} ${y} A40 40 0 0 1 ${x} ${y} Z`);
    rotate(compass.querySelector('.wind')?.parentElement?.parentElement, degrees + 180);
    compass
      .querySelector('.wind')
      ?.parentElement?.setAttribute('transform', `scale(${0.8 + force * 0.12} 1)`);
    rotate(compass.querySelector('.boat')?.parentElement, boat.heading / DEG);
    const dot = compass.querySelector<SVGElement>('.wp');
    if (dot) {
      // The source HUD may have hidden its whole bearing group before the chart was created.
      if (dot.parentElement) dot.parentElement.style.display = '';
      dot.style.display = destination ? '' : 'none';
      if (destination)
        rotate(dot.parentElement, Math.atan2(destination.x - boat.x, destination.y - boat.y) / DEG);
    }
    this.get('chart-wind').textContent =
      `${t(`windForce.${WIND_FORCES[force]}`)} · ${wind.speedKn.toFixed(0)} ${t('unit.knots')}${shelter > 0.25 ? ` · ${t('hud.lee')}` : ''}`;
  }
  private get<T extends HTMLElement = HTMLElement>(id: string): T {
    return this.dialog.querySelector<T>(`#${id}`)!;
  }
  get isOpen() {
    return this.dialog.open;
  }
  /** Zoom in (factor > 1) or out; the first step in centres on the boat. */
  zoomBy(factor: number) {
    if (this.zoom === 1 && factor > 1)
      this.center = { x: this.world.boat.x, y: -this.world.boat.y };
    const zoom = Math.min(this.maxZoom, Math.max(1, this.zoom * factor));
    if (zoom === this.zoom) return;
    this.zoom = zoom;
    this.draw();
  }
  /** The whole sea again. */
  fit() {
    this.zoom = 1;
    this.center = { x: 0, y: 0 };
    this.draw();
  }
  /** Slide the view by screen pixels (a controller's stick, decision 0162). */
  panBy(dx: number, dy: number) {
    if (!dx && !dy) return;
    const unit = this.unitsPerPixel();
    this.center = { x: this.center.x + dx * unit, y: this.center.y + dy * unit };
    this.updateViewBox();
    this.settleLabels();
  }
  /**
   * Names are kept on screen when the chart is drawn, so after a pan they are placed again, once
   * the view stops moving (a whole redraw per frame would cost old tablets).
   */
  private settleLabels() {
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      if (this.isOpen) this.draw();
    }, 150);
  }
  /** Back, like Esc: an open side panel first, then the chart. */
  back() {
    if (this.panel) {
      const previous = this.panel;
      this.setPanel(null);
      this.dialog.querySelector<HTMLButtonElement>(`#chart-${previous}-toggle`)?.focus();
    } else this.close();
  }
  open() {
    if (this.isOpen) return;
    this.previousFocus = document.activeElement as HTMLElement | null;
    if (!this.goodPicked) this.good = this.defaultGood();
    this.zoom = 1;
    this.center = { x: 0, y: 0 };
    // Wide screens open with the journal beside the sea while a quest is under way.
    const wide =
      typeof matchMedia === 'function' &&
      matchMedia('(min-width: 900px) and (min-height: 500px)').matches;
    const tracked = this.quests?.journal().some((e) => e.state === 'tracked') ?? false;
    this.setPanel(wide && tracked ? 'journal' : null);
    this.dialog.showModal();
    this.draw();
    this.status('');
    this.onChange();
  }
  close() {
    this.dialog.close();
  }
  /** Show prices for what you carry most of; with an empty hold, a clean chart of names. */
  private defaultGood(): GoodId | null {
    const { cargo } = this.world.trade.captain;
    const most = GOODS.reduce((best, g) => (cargo[g] > cargo[best] ? g : best), GOODS[0]);
    return cargo[most] > 0 ? most : null;
  }
  private status(message: string) {
    this.get('chart-status').textContent = message;
  }
  private button(parent: HTMLElement, label: string, action: () => void) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', action);
    parent.append(b);
    return b;
  }
  private selectPort(portId: string) {
    const { map } = this.world;
    const port = map.ports.find((p) => p.id === portId)!;
    const anchor = this.harbours[port.id] ?? map.islands.find((i) => i.id === port.islandId)!;
    // Use the visible pier as the destination, rather than a legacy practice buoy.
    this.world.destination = { portId: port.id, label: port.name, x: anchor.x, y: anchor.y };
    this.onDestinationChange();
    this.draw();
    this.status(t('chart.statusPortSet', { name: port.name }));
  }
  /** One good's prices at every charted port (decisions 0036, 0048), and which are best. */
  private quotes() {
    const good = this.good ?? GOODS[0];
    const { map, trade } = this.world;
    const quotes = quoteAcross(
      trade.markets,
      good,
      discoveredPorts(map, trade).map((p) => p.id),
    );
    const stocked = quotes.filter((q) => q.available > 0).map((q) => q.buy);
    return {
      good,
      quotes,
      cheapest: stocked.length ? Math.min(...stocked) : null,
      dearest: Math.max(...quotes.map((q) => q.sell)),
    };
  }
  /** Goods to compare along the bottom, and the full price table in its sheet. */
  private drawMarket(market: ReturnType<SeaChart['quotes']>) {
    const { good, quotes, cheapest, dearest } = market;
    const { map, trade } = this.world;
    const goods = this.get('chart-goods');
    goods.replaceChildren();
    // Specialized goods join once a town makes them, or while one is in the hold (decision 0063).
    const made = madeGoods(map, trade);
    const inPlay = GOODS.filter((g) => !isMadeGood(g) || made.has(g) || trade.captain.cargo[g] > 0);
    for (const g of inPlay) {
      // Tap a good to show its prices on the chart; tap it again for names only.
      const b = this.button(goods, goodName(g), () => {
        this.good = this.good === g ? null : g;
        this.goodPicked = true;
        this.draw();
      });
      b.insertAdjacentHTML('afterbegin', icon(g));
      const on = g === this.good;
      b.setAttribute('aria-pressed', String(on));
      if (on) b.classList.add('active');
    }
    const title = this.dialog.querySelector('#chart-market-title');
    if (title) title.textContent = t('chart.pricesFor', { good: goodName(good) });
    const table = this.get('chart-prices');
    table.replaceChildren();
    const head = document.createElement('tr');
    for (const label of [t('chart.colPort'), t('chart.colBuy'), t('chart.colSell'), ''])
      head.append(Object.assign(document.createElement('th'), { textContent: label }));
    table.append(head);
    for (const q of quotes) {
      const port = map.ports.find((p) => p.id === q.portId)!;
      const row = document.createElement('tr');
      const nameCell = document.createElement('td');
      this.button(nameCell, port.name, () => this.selectPort(port.id)).dataset.compare = port.id;
      const buy = Object.assign(document.createElement('td'), {
        textContent: q.available > 0 ? `${q.buy} ` : t('chart.none'),
      });
      const sell = Object.assign(document.createElement('td'), { textContent: `${q.sell} ` });
      if (q.available > 0) buy.insertAdjacentHTML('beforeend', COIN);
      sell.insertAdjacentHTML('beforeend', COIN);
      const notes: string[] = [];
      if (q.available > 0 && q.buy === cheapest) {
        buy.classList.add('best');
        notes.push(t('chart.cheapest'));
      }
      if (q.sell === dearest) {
        sell.classList.add('best');
        notes.push(t('chart.paysMost'));
      }
      const order = trade.contracts.byPort[port.id];
      if (order && order.readyIn <= 0 && order.good === good)
        notes.push(
          t(order.help ? 'chart.help' : 'chart.order', { qty: order.qty, reward: order.reward }),
        );
      if (trade.dockedAt === port.id) notes.push(t('chart.youAreHere'));
      const note = Object.assign(document.createElement('td'), {
        textContent: notes.join(' · '),
        className: 'muted',
      });
      row.append(nameCell, buy, sell, note);
      table.append(row);
    }
  }
  /** The price under a port's name for the picked good: buy where it is stocked, else sell. */
  private priceLine(q: PortQuote | undefined, market: ReturnType<SeaChart['quotes']>) {
    if (!q) return { text: '', best: false };
    if (q.available > 0 && q.buy === market.cheapest)
      return { text: t('chart.cardBuy', { price: q.buy }), best: true };
    return { text: t('chart.cardSell', { price: q.sell }), best: q.sell === market.dearest };
  }
  /** The tracked step's place, people's faces on their ports, and the journal panel. */
  private drawQuests(
    shape: (tag: string, attrs: Record<string, string | number>, parent?: Element) => Element,
    unit: number,
    px: number,
  ) {
    const quests = this.quests!;
    const { map, boat } = this.world;
    const pierOf = (id: string) => {
      const port = map.ports.find((p) => p.id === id);
      const island = port && map.islands.find((i) => i.id === port.islandId);
      return this.harbours[id] ?? island ?? null;
    };
    const target = quests.target();
    const at = target && (target.point ?? (target.port ? pierOf(target.port) : null));
    if (target && at) {
      shape('line', { x1: boat.x, y1: -boat.y, x2: at.x, y2: -at.y, class: 'chart-quest-route' });
      shape('circle', {
        cx: at.x,
        cy: -at.y,
        r: target.radius ?? 15 * px,
        class: target.radius ? 'chart-quest-area' : 'chart-quest-ring',
      });
    }
    // The step's places at sea: gates and spots still to reach, the next one ringed brighter.
    for (const m of quests.markers?.() ?? []) {
      if (m.reached) continue;
      shape('circle', {
        cx: m.x,
        cy: -m.y,
        r: Math.max(m.within, 4 * px),
        class: m.next ? 'chart-quest-ring' : 'chart-quest-area',
      });
    }
    const size = 34 * px;
    for (const pin of quests.pins()) {
      const pier = pierOf(pin.port);
      if (!pier) continue;
      const g = shape('g', {
        class: `chart-quest-pin${pin.tracked ? ' is-tracked' : ''}`,
        transform: `translate(${pier.x} ${-pier.y - 14 * px - size / 2})`,
      });
      if (pin.tracked) shape('circle', { r: size * 0.62, class: 'chart-quest-glow' }, g);
      g.insertAdjacentHTML('beforeend', portraitSvg(pin.giver, { size: 34 }));
      const face = g.lastElementChild!;
      for (const [k, v] of Object.entries({
        x: -size / 2,
        y: -size / 2,
        width: size,
        height: size,
      }))
        face.setAttribute(k, String(v));
      if (pin.alert) {
        shape(
          'circle',
          { cx: size * 0.4, cy: -size * 0.4, r: 8 * px, class: 'chart-quest-alert' },
          g,
        );
        const mark = shape(
          'text',
          {
            x: size * 0.4,
            y: -size * 0.4 + 4.5 * px,
            class: 'chart-quest-mark',
            style: `font-size: ${13 * px}px`,
          },
          g,
        );
        mark.textContent = '!';
      }
    }
    void unit;
    this.drawJournal(quests.journal());
  }

  private drawJournal(entries: JournalEntry[]) {
    const toggle = this.dialog.querySelector<HTMLElement>('#chart-journal-toggle');
    const list = this.dialog.querySelector<HTMLElement>('#chart-journal-list');
    if (toggle) toggle.hidden = entries.length === 0;
    const news = entries.filter((e) => e.state === 'offered').length;
    const badge = toggle?.querySelector<HTMLElement>('.chart-journal-badge');
    if (badge) {
      badge.hidden = news === 0;
      badge.textContent = String(news);
    }
    if (!list) return;
    const pips = (e: JournalEntry) =>
      `<span class="quest-pips" aria-hidden="true">${Array.from({ length: e.steps }, (_, i) => `<i class="${i < e.stepNo ? 'on' : ''}"></i>`).join('')}</span>`;
    const face = (e: JournalEntry, size: number) =>
      e.giver
        ? portraitSvg(e.giver, { size, mood: e.state === 'done' ? 'pleased' : 'neutral' })
        : '';
    const html: string[] = [];
    const tracked = entries.find((e) => e.state === 'tracked');
    if (tracked) {
      html.push(`<div class="journal-tracked"><div class="journal-who">${face(tracked, 56)}<div>
        ${tracked.who ? `<small>${escapeHtml(tracked.who)}</small>` : ''}<b>${escapeHtml(tracked.arc)}</b>
        <span class="journal-step">${pips(tracked)} ${escapeHtml(t('journal.step', { n: tracked.stepNo, total: tracked.steps }))}</span></div></div>
        <ul class="journal-steps">${tracked.lines
          .map(
            (l) =>
              `<li class="is-${l.state}"><span class="journal-check" aria-hidden="true">${l.state === 'done' ? '✓' : l.state === 'now' ? '!' : ''}</span><span>${escapeHtml(l.state === 'later' ? t('journal.later') : l.title)}${l.progress ? ` <b>${escapeHtml(l.progress)}</b>` : ''}</span></li>`,
          )
          .join('')}</ul></div>`);
    }
    const others = entries.filter((e) => e !== tracked);
    if (others.length) {
      html.push(`<h4>${escapeHtml(t(tracked ? 'journal.others' : 'journal.people'))}</h4>`);
      for (const e of others) {
        const line =
          e.state === 'offered'
            ? t('journal.asks')
            : e.state === 'ignored'
              ? t('journal.ignored')
              : e.state === 'done'
                ? e.chose.length
                  ? t('journal.doneChose', { option: e.chose.join(', ') })
                  : t('journal.done')
                : `${e.arc} · ${t('journal.step', { n: e.stepNo, total: e.steps })}`;
        const attrs =
          e.state === 'active'
            ? ` data-track="${escapeHtml(e.quest)}" role="button" tabindex="0"`
            : e.state === 'ignored'
              ? ` data-take-up="${escapeHtml(e.quest)}" role="button" tabindex="0"`
              : '';
        html.push(
          `<div class="journal-row is-${e.state}"${attrs}><span class="journal-face">${face(e, 34)}${
            e.state === 'offered' ? '<i class="journal-alert">!</i>' : ''
          }</span><span><b>${escapeHtml(e.who ?? e.arc)}</b><small>${escapeHtml(line)}</small></span></div>`,
        );
      }
    }
    list.innerHTML = html.join('');
  }

  private draw() {
    const focused = document.activeElement;
    const focusedTarget = focused?.getAttribute('data-chart-target');
    const focusText =
      focused instanceof HTMLButtonElement && this.dialog.contains(focused)
        ? focused.textContent
        : null;
    const { map, boat, destination } = this.world;
    const svg = this.get('chart-map');
    svg.replaceChildren();
    this.updateViewBox();
    const unit = this.unitsPerPixel();
    this.drawCompass();
    const shape = (tag: string, attrs: Record<string, string | number>, parent: Element = svg) => {
      const el = document.createElementNS(NS, tag);
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
      parent.append(el);
      return el;
    };
    shape('circle', { r: map.boundsRadius, class: 'chart-boundary' });
    const zoneLabels = this.drawZones(shape, unit);
    this.drawCurrents(shape, unit);
    // Land reads like the 3D islands: an ink outline, a sand shore and a grass top.
    const land = (tag: string, attrs: Record<string, string | number>) => {
      shape(tag, { ...attrs, class: 'chart-shore' });
      shape(tag, { ...attrs, class: 'chart-land' });
    };
    const charted = discoveredPorts(map, this.world.trade);
    // Map text needs the same screen size at every zoom and grows a little on large screens.
    const rect = svg.getBoundingClientRect();
    const k = Math.min(1.25, Math.max(1, Math.min(rect.width, rect.height) / 520));
    const px = unit * k;
    // Island and reef names are placed after the ports, only where they fit (decision 0058).
    const places: { name: string; x: number; top: number; bottom: number }[] = [];
    // The captain's own islands (decisions 0126, 0128): a house badge and a name like a port's.
    const owned = ownedIslands(this.world.trade.home);
    const homes: typeof map.islands = [];
    const landBoxes: Box[] = [];
    // Only the land standing now: an island a quest has not raised yet is not drawn (0166).
    const { land: standing } = this.world;
    for (const island of standing.islands) {
      const coasts = islandCoasts(island);
      if (coasts) {
        for (const outline of coasts)
          land('polygon', { points: outline.map(([x, y]) => `${x},${-y}`).join(' ') });
      } else land('circle', { cx: island.x, cy: -island.y, r: island.radius });
      const lake = islandLake(island);
      if (lake)
        shape('polygon', {
          points: lake.map(([x, y]) => `${x},${-y}`).join(' '),
          fill: '#2b9eac',
          stroke: '#d6c4a4',
          'stroke-width': 1,
        });
      if (coasts) {
        const ps = coasts.flat();
        landBoxes.push({
          x0: Math.min(...ps.map((p) => p[0])),
          x1: Math.max(...ps.map((p) => p[0])),
          y0: Math.min(...ps.map((p) => -p[1])),
          y1: Math.max(...ps.map((p) => -p[1])),
        });
      } else landBoxes.push(box(island.x, -island.y, island.radius * 2, island.radius * 2));
      if (owned.includes(island.id) && !charted.some((p) => p.islandId === island.id))
        homes.push(island);
      else if (
        island.name &&
        !charted.some((p) => p.islandId === island.id) &&
        islandCharted(map, this.world.trade.progress, island)
      )
        places.push({
          name: island.name,
          x: island.x,
          top: -island.y - island.radius,
          bottom: -island.y + island.radius,
        });
    }
    for (const terrain of standing.terrain) {
      const points = terrain.outline.map(([x, y]) => `${x},${-y}`).join(' ');
      if (terrain.kind === 'island') land('polygon', { points });
      else
        shape('polygon', {
          points,
          class:
            terrain.kind === 'reef'
              ? 'chart-reef'
              : terrain.kind === 'shallows'
                ? 'chart-shallows'
                : 'chart-bank',
        });
      const xs = terrain.outline.map((p) => p[0]);
      const ys = terrain.outline.map((p) => -p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      if (terrain.kind === 'island') landBoxes.push({ x0, x1, y0, y1 });
      const known = chartedAt(map, this.world.trade.progress, (x0 + x1) / 2, -(y0 + y1) / 2);
      if (terrain.name && terrain.kind === 'island' && known)
        places.push({ name: terrain.name, x: (x0 + x1) / 2, top: y0, bottom: y1 });
      // The chart says which ships cross a sandy passage (decisions 0137, 0152).
      if (terrain.name && terrain.kind === 'shallows' && known)
        places.push({
          name: t('chart.shallows', { name: terrain.name }),
          x: (x0 + x1) / 2,
          top: y0,
          bottom: y1,
        });
    }
    // Sea marks on the chart (decision 0130): channel buoys and lights, once their quest says so.
    const done = questsDone(this.world.trade);
    for (const mark of map.marks ?? []) {
      if (!mark.chart || !questShown(mark, done)) continue;
      if (!chartedAt(map, this.world.trade.progress, mark.x, mark.y)) continue;
      // A named mark (a gateway's light) gets its place name beside it (decision 0152).
      if (mark.name)
        places.push({ name: mark.name, x: mark.x, top: -mark.y - 6, bottom: -mark.y + 6 });
      const { tag, attrs } = seaMarkShape(mark, px);
      shape(tag, { ...attrs, class: 'chart-mark' });
    }
    // A running quest's own marks (decision 0164: the lessons' buoys), named, charted or not.
    for (const mark of this.questMarks()) {
      if (mark.name)
        places.push({ name: mark.name, x: mark.x, top: -mark.y - 6, bottom: -mark.y + 6 });
      const { tag, attrs } = seaMarkShape(mark, px);
      shape(tag, { ...attrs, class: 'chart-mark' });
    }
    zoneLabels.push(...this.drawFog(shape, px));
    // Storms (decisions 0067 and 0070): a hazard badge over a soft cloud, chevrons for the drift.
    for (const storm of this.world.weather.storms) {
      if (storm.intensity < 0.05) continue;
      drawHazard(
        svg as unknown as SVGElement,
        { kind: 'storm', ...storm, reach: storm.radius, strength: storm.intensity },
        px,
        t('chart.storm'),
      );
    }
    // The course: a dashed line from the boat to a small ring on the destination's pier.
    if (destination) {
      shape('line', {
        x1: boat.x,
        y1: -boat.y,
        x2: destination.x,
        y2: -destination.y,
        class: 'chart-course',
      });
      shape('circle', {
        cx: destination.x,
        cy: -destination.y,
        r: 7 * unit,
        class: 'chart-selected',
      });
    }
    // Screen-sized signature boat; position/heading remain exact world coordinates.
    const player = shape('g', {
      transform: `translate(${boat.x} ${-boat.y}) rotate(${boat.heading / DEG}) scale(${unit * 0.85})`,
      class: 'chart-player',
      role: 'img',
      'aria-label': t('chart.boatLabel', { deg: Math.round((boat.heading / DEG + 360) % 360) }),
    });
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#i-chart-boat');
    use.setAttribute('x', '-18');
    use.setAttribute('y', '-22');
    use.setAttribute('width', '36');
    use.setAttribute('height', '44');
    player.append(use);
    const market = this.quotes();
    const showPrices = this.good !== null;
    const [vx, vy, vw, vh] = (svg.getAttribute('viewBox') ?? '0 0 0 0').split(' ').map(Number);
    const view = { x0: vx!, y0: vy!, x1: vx! + vw!, y1: vy! + vh! };
    const boatBox = box(boat.x, -boat.y, 34 * unit, 34 * unit);
    const placed: Box[] = [];
    // Anchor badges sit on the piers; labels keep clear of every one of them.
    const badges = charted.map((port) => {
      const pier = this.harbours[port.id] ?? map.islands.find((i) => i.id === port.islandId)!;
      return box(pier.x, -pier.y, 20 * px, 20 * px);
    });
    // Pick the free side of the island for a label: above, below, right, then left.
    const placeLabel = (cx: number, top: number, bottom: number, w: number, h: number) => {
      const gap = 5 * unit;
      const mid = (top + bottom) / 2,
        half = (bottom - top) / 2;
      const candidates = [
        { x: cx, y: top - gap - h / 2 },
        { x: cx, y: bottom + gap + h / 2 },
        { x: cx + half + gap + w / 2, y: mid },
        { x: cx - half - gap - w / 2, y: mid },
      ].map((c) => ({
        // Keep labels on screen at the chart's edges.
        x: Math.min(Math.max(c.x, view.x0 + w / 2 + 4 * unit), view.x1 - w / 2 - 4 * unit),
        y: Math.min(Math.max(c.y, view.y0 + h / 2 + 4 * unit), view.y1 - h / 2 - 4 * unit),
      }));
      let best = candidates[0]!,
        bestScore = Infinity;
      for (const c of candidates) {
        const b = box(c.x, c.y, w, h);
        const score =
          3 * overlap(b, boatBox) +
          3 * [...placed, ...badges].reduce((sum, p) => sum + overlap(b, p), 0) +
          landBoxes.reduce((sum, l) => sum + overlap(b, l), 0) * 0.5;
        if (score < bestScore - 1e-6) {
          best = c;
          bestScore = score;
        }
      }
      return { ...best, clash: bestScore };
    };
    // Ports: an anchor badge on the pier, the name, and the picked good's price.
    for (const port of charted) {
      const island = map.islands.find((i) => i.id === port.islandId)!;
      const anchor = this.harbours[port.id] ?? island;
      const select = () => this.selectPort(port.id);
      const selected = destination?.portId === port.id;
      const group = shape('g', {
        class: `chart-port-target${selected ? ' is-selected' : ''}`,
        role: 'button',
        tabindex: 0,
        'data-chart-target': port.id,
        'aria-label': t('chart.setBearingTo', { name: port.name }),
      });
      const price = showPrices
        ? this.priceLine(
            market.quotes.find((q) => q.portId === port.id),
            market,
          )
        : { text: '', best: false };
      const nameSize = 15 * px,
        priceSize = 13 * px;
      const w = Math.max(port.name.length * nameSize * 0.52, price.text.length * priceSize * 0.52);
      const h = nameSize * 1.15 + (price.text ? priceSize * 1.2 : 0);
      const spot = placeLabel(island.x, -island.y - island.radius, -island.y + island.radius, w, h);
      placed.push(box(spot.x, spot.y, w, h));
      const top = spot.y - h / 2;
      // Invisible tap areas: the label and a finger-sized circle on the pier.
      shape(
        'rect',
        {
          x: spot.x - w / 2 - 4 * unit,
          y: top - 3 * unit,
          width: w + 8 * unit,
          height: h + 6 * unit,
          class: 'chart-card-box',
        },
        group,
      );
      shape('circle', { cx: anchor.x, cy: -anchor.y, r: 20 * unit, class: 'chart-hit' }, group);
      shape('circle', { cx: anchor.x, cy: -anchor.y, r: 9 * px, class: 'chart-port-dot' }, group);
      shape(
        'use',
        {
          href: '#i-anchor',
          x: anchor.x - 6 * px,
          y: -anchor.y - 6 * px,
          width: 12 * px,
          height: 12 * px,
          class: 'chart-port-anchor',
        },
        group,
      );
      const name = shape(
        'text',
        {
          x: spot.x,
          y: top + nameSize * 0.9,
          class: 'chart-port-name',
          style: `font-size: ${nameSize}px`,
        },
        group,
      );
      name.textContent = port.name;
      if (price.text) {
        const line = shape(
          'text',
          {
            x: spot.x,
            y: top + nameSize * 1.15 + priceSize * 0.95,
            class: `chart-need${price.best ? ' best' : ''}`,
            style: `font-size: ${priceSize}px`,
          },
          group,
        );
        line.textContent = price.text;
      }
      group.addEventListener('click', (e) => {
        e.stopPropagation();
        select();
      });
      group.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
      });
    }
    // Her islands: the badge on the island, the name and "your island" on its free side.
    for (const island of homes) {
      const name = island.name ?? island.id;
      const nameSize = 15 * px,
        tagSize = 12 * px;
      const tag = t('chart.yourIsland');
      const w = Math.max(name.length * nameSize * 0.52, tag.length * tagSize * 0.5);
      const h = nameSize * 1.15 + tagSize * 1.2;
      const spot = placeLabel(island.x, -island.y - island.radius, -island.y + island.radius, w, h);
      placed.push(box(spot.x, spot.y, w, h));
      const top = spot.y - h / 2;
      const group = shape('g', {
        class: 'chart-home',
        role: 'img',
        'aria-label': `${name} · ${tag}`,
      });
      shape('circle', { cx: island.x, cy: -island.y, r: 10 * px, class: 'chart-home-dot' }, group);
      shape(
        'use',
        {
          href: '#i-home',
          x: island.x - 7 * px,
          y: -island.y - 7 * px,
          width: 14 * px,
          height: 14 * px,
          class: 'chart-home-icon',
        },
        group,
      );
      const label = shape(
        'text',
        {
          x: spot.x,
          y: top + nameSize * 0.9,
          class: 'chart-port-name',
          style: `font-size: ${nameSize}px`,
        },
        group,
      );
      label.textContent = name;
      const line = shape(
        'text',
        {
          x: spot.x,
          y: top + nameSize * 1.15 + tagSize * 0.95,
          class: 'chart-home-tag',
          style: `font-size: ${tagSize}px`,
        },
        group,
      );
      line.textContent = tag;
    }
    // Secondary names: small and quiet, and left out where they would cover a port or the boat.
    // A big sea seen whole on a small screen leaves them out until zoomed in (decision 0115):
    // past the Windward Ring's phone-portrait scale its islands are too close for them.
    const roomForNames = unit <= MAX_UNITS_PER_PIXEL_FOR_NAMES;
    for (const place of roomForNames ? places : []) {
      const size = 11 * px;
      const w = place.name.length * size * 0.5,
        h = size * 1.2;
      const spot = placeLabel(place.x, place.top, place.bottom, w, h);
      const b = box(spot.x, spot.y, w, h);
      if (overlap(b, boatBox) > 0 || placed.some((p) => overlap(b, p) > 0)) continue;
      placed.push(b);
      const label = shape('text', {
        x: spot.x,
        y: spot.y + size * 0.35,
        class: 'chart-place',
        style: `font-size: ${size}px`,
      });
      label.textContent = place.name;
    }
    // Charted wind zones' names: only where the zone is wide enough to hold one, and never over a
    // port, a place name or the boat (decision 0152). Zooming in shows the small ones.
    for (const z of zoneLabels) {
      const size = 11 * px;
      const w = z.text.length * size * 0.5,
        h = size * 1.2;
      const b = box(z.x, z.y, w, h);
      // The name may run a little past a zone's edge, but not over a zone much narrower than it.
      const inside = (dx: number) => coastDistance(z.x + dx, -z.y, z.outline).distance < 0;
      let chord = 0;
      for (const side of [-1, 1])
        for (let dx = 0; dx < w && inside(side * dx); dx += w / 20) chord += w / 20;
      const fits = w <= chord * 1.7;
      if (!fits || overlap(b, boatBox) > 0 || placed.some((p) => overlap(b, p) > 0)) continue;
      placed.push(b);
      const label = shape('text', {
        x: z.x,
        y: z.y + size * 0.35,
        class: `chart-zone-label chart-zone-${z.kind}`,
        style: `font-size: ${size}px`,
      });
      label.textContent = z.text;
    }
    this.drawMarket(market);
    if (this.quests) this.drawQuests(shape, unit, px);
    svg.append(player);
    const course = this.dialog.querySelector<HTMLElement>('#chart-course');
    if (course) {
      course.hidden = !destination;
      if (destination)
        (course.querySelector('#chart-course-text') ?? course).textContent = t('chart.course', {
          label: destination.label,
          dist: t('unit.metres', { n: Math.round(distance(boat, destination)) }),
        });
    }
    this.get<HTMLButtonElement>('chart-clear-target').disabled = !destination;
    if (focusedTarget) {
      Array.from(this.dialog.querySelectorAll<SVGElement>('[data-chart-target]'))
        .find((element) => element.getAttribute('data-chart-target') === focusedTarget)
        ?.focus({ preventScroll: true });
    } else if (focusText) {
      const replacement = Array.from(this.dialog.querySelectorAll('button')).find(
        (b) => b.textContent === focusText,
      );
      (replacement ?? this.get('close-chart')).focus({ preventScroll: true });
    }
  }
}
