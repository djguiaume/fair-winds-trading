import type { SeaMarkDef } from '../sim/map';
import { DEG, distance } from '../sim/math';
import { noGoAngle } from '../sim/ship';
import { WIND_FORCES, windForce } from '../sim/windStrength';
import type { Destination, World } from '../sim/world';
import { goodName, t } from '../i18n';
import { ChartDial } from './chartDial';
import { drawCargo } from './chart/cargo';
import { type ChartQuests, drawSea } from './chart/draw';
import { JournalPage } from './chart/journal';
import { buildChart, CHART_TABS, type ChartParts, type ChartTab } from './chart/layout';
import { drawPrices, PriceKey } from './chart/prices';
import { shaper } from './chart/svg';
import { ChartView } from './chart/view';
import './chart/chart.css';
import './chart/frame.css';
import './chart/pages.css';

export { CHART_TABS, type ChartQuests, type ChartTab };

/**
 * A course for the quest's place (decision 0212), named by the island it lies by ("To Teeth
 * Rock"), else by the step's ask; a port by its name.
 */
export function questCourse(goal: {
  x: number;
  y: number;
  label: string;
  portId?: string;
  place?: string;
}): Destination {
  const { place, ...at } = goal;
  return { kind: 'quest', ...at, label: place ?? at.label };
}

/**
 * The sea chart (issue #444): a paper chart table, event-driven DOM and SVG with no second WebGL
 * scene or animation loop. This class keeps the course, the tabs and the pad's calls; the drawing
 * lives in `chart/`, one layer per module, and the view (zoom, pan, pinch) in `chart/view.ts`.
 */
export class SeaChart {
  /** Blur the fog's edge (High quality only, decision 0156). */
  fogBlur = false;
  onChange: () => void = () => {};
  /** People's faces on their ports, the tracked step's place and the journal; none: no quests. */
  quests: ChartQuests | null = null;
  onDestinationChange: () => void = () => {};
  /** Quest cargo on deck, one line each (decision 0213), for the Cargo tab. */
  questCargo: () => string[] = () => [];
  /** The running quests' own sea marks (decision 0164), drawn while they run. */
  questMarks: () => readonly SeaMarkDef[] = () => [];
  /** The race under way's course (decision 0217): its line, its marks in order, its finish. */
  raceCourse: () => readonly { x: number; y: number }[] | null = () => null;
  private previousFocus: HTMLElement | null = null;
  private tab: ChartTab = 'map';
  private readonly parts: ChartParts;
  private readonly view: ChartView;
  private readonly dial = new ChartDial();
  private readonly prices: PriceKey;
  private readonly journal: JournalPage;

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
    const parts = buildChart(dialog, (tab) => this.setTab(tab));
    this.parts = parts;
    parts.dial.replaceChildren(this.dial.svg);
    const book = parts.book.root;
    this.view = new ChartView(parts.svg, parts.cross, () => world.map, {
      redraw: () => this.isOpen && this.draw(),
      tap: (at) => this.dropMark(at),
      sideRoom: () => book.getBoundingClientRect().width,
      rightEdge: () => book.getBoundingClientRect().left || null,
    });
    this.prices = new PriceKey(world);
    this.journal = new JournalPage(parts.journal, {
      track: (quest) => {
        this.quests?.track(quest);
        this.draw();
      },
      takeUp: (quest) => {
        this.quests?.takeUp?.(quest);
        this.draw();
      },
    });
    parts.close.addEventListener('click', () => this.close());
    parts.clearCourse.addEventListener('click', () => this.clearCourse(t('chart.statusCleared')));
    parts.clearPrices.addEventListener('click', () => {
      this.prices.pick(null);
      this.draw();
    });
    parts.zoomIn.addEventListener('click', () => this.zoomBy(1.5));
    parts.zoomOut.addEventListener('click', () => this.zoomBy(1 / 1.5));
    parts.fit.addEventListener('click', () => this.fit());
    // No animation loop: draw again only on open, edits, zoom or a viewport resize.
    if (typeof ResizeObserver !== 'undefined')
      new ResizeObserver(() => this.isOpen && this.draw()).observe(parts.svg);
    dialog.addEventListener('close', () => {
      this.onChange();
      this.previousFocus?.focus({ preventScroll: true });
    });
  }

  /** The tab on show: the sea, or one of the full pages over it (decision 0196). */
  get currentTab(): ChartTab {
    return this.tab;
  }
  setTab(name: ChartTab) {
    this.tab = name;
    this.dialog.dataset.tab = name;
    this.parts.book.select(name, false);
    for (const [id, page] of Object.entries(this.parts.pages)) page.hidden = id !== name;
    // A controller on the map plays the cross: no focus ring left on a tab or the close button.
    const active = document.activeElement as HTMLElement | null;
    if (name === 'map' && document.documentElement.dataset.input === 'pad' && active)
      if (this.dialog.contains(active)) active.blur();
  }
  /** LB / RB: the next tab that shows (the journal hides with no quests). */
  stepTab(step: number) {
    const shown = CHART_TABS.filter(
      (id) => !this.dialog.querySelector(`#chart-tab-${id}`)?.hasAttribute('hidden'),
    );
    const at = Math.max(0, shown.indexOf(this.tab));
    this.parts.book.select(shown[(at + step + shown.length) % shown.length]!);
  }
  get isOpen() {
    return this.dialog.open;
  }
  /** Zoom in (factor > 1) or out; the first step in centres on the boat. */
  zoomBy(factor: number) {
    this.view.zoomBy(factor, this.world.boat);
  }
  /** The whole sea again. */
  fit() {
    this.view.fit();
  }
  /** Slide the view by screen pixels (a controller's stick, decision 0162). */
  panBy(dx: number, dy: number) {
    this.view.panBy(dx, dy);
  }
  /** A controller's stick on the chart (decision 0183): the cross, then the view at an edge. */
  padMove(dx: number, dy: number, edgePx = 40) {
    this.view.padMove(dx, dy, edgePx);
  }
  /**
   * A controller's A (decision 0183): set a course to the port or mark nearest the cross, if one
   * lies within `reachPx` screen pixels. True when one was picked.
   */
  pickAtCross(reachPx: number): boolean {
    const at = this.view.crossOnScreen();
    let best: Element | null = null;
    let bestD = reachPx * reachPx;
    for (const g of this.parts.svg.querySelectorAll('[data-chart-target]')) {
      const b = g.getBoundingClientRect();
      const dx = Math.max(b.left - at.x, 0, at.x - b.right),
        dy = Math.max(b.top - at.y, 0, at.y - b.bottom);
      if (dx * dx + dy * dy < bestD) {
        bestD = dx * dx + dy * dy;
        best = g;
      }
    }
    best?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return !!best;
  }
  /** A controller's A with nothing under the cross: her own mark there (decision 0212). */
  markAtCross() {
    const at = this.view.crossOnScreen();
    this.dropMark(this.view.toMap(at.x, at.y));
  }
  /** A controller's X on the map (decision 0196): the next good's prices, then names only. */
  nextGood() {
    this.prices.next();
    this.draw();
  }
  /** Back, like Esc: the chart closes from any tab, as the port screen does. */
  back() {
    this.close();
  }
  open() {
    if (this.isOpen) return;
    this.previousFocus = document.activeElement as HTMLElement | null;
    this.prices.open();
    this.view.openOn(this.world.boat);
    this.dialog.showModal();
    this.setTab('map');
    this.draw();
    this.status('');
    this.onChange();
  }
  close() {
    this.dialog.close();
  }

  /** Her own mark (decision 0212): one at a time, the course while it stands. */
  private dropMark(at: { x: number; y: number }) {
    this.setCourse({ kind: 'mark', label: t('chart.yourMark'), x: at.x, y: at.y });
    this.status(t('chart.statusMarkSet'));
  }
  private clearCourse(message: string) {
    this.setCourse(null);
    this.status(message);
  }
  /** A course for the tracked quest's place; it follows the quest on to its next place. */
  private setQuestCourse() {
    const goal = this.quests?.goal?.();
    if (!goal) return;
    const course = questCourse(goal);
    this.setCourse(course);
    this.status(t('chart.statusPortSet', { name: course.label }));
  }
  /** A port's pier as the course (the visible pier, not a legacy practice buoy). */
  private selectPort(portId: string) {
    const { map } = this.world;
    const port = map.ports.find((p) => p.id === portId)!;
    const pier = this.pierOf(port.id)!;
    this.setCourse({ portId: port.id, label: port.name, x: pier.x, y: pier.y });
    // Picked from the price table: back to the sea, with the course on it.
    this.setTab('map');
    this.status(t('chart.statusPortSet', { name: port.name }));
  }
  private setCourse(course: Destination | null) {
    this.world.destination = course;
    this.onDestinationChange();
    this.draw();
  }
  private pierOf(portId: string) {
    const { map } = this.world;
    const port = map.ports.find((p) => p.id === portId);
    const island = port && map.islands.find((i) => i.id === port.islandId);
    return this.harbours[portId] ?? island ?? null;
  }
  private status(message: string) {
    this.parts.status.textContent = message;
  }

  /** The rose: the wind at her boat, her no-go, her heading and the course; its words. */
  private drawCompass() {
    const { wind, boat, ship, destination, shelter } = this.world;
    const force = windForce(wind.speedKn);
    const forceName = t(`windForce.${WIND_FORCES[force]}`);
    const { compass } = this.parts;
    compass.dataset.force = String(force);
    compass.setAttribute(
      'aria-label',
      t('chart.windLabel', {
        deg: Math.round((wind.from / DEG + 360) % 360),
        kn: wind.speedKn.toFixed(0),
        force: forceName,
      }),
    );
    const course = destination ? Math.atan2(destination.x - boat.x, destination.y - boat.y) : null;
    this.dial.update(wind.from, force, noGoAngle(ship), boat.heading, course);
    this.parts.wind.textContent = `${forceName} · ${wind.speedKn.toFixed(0)} ${t('unit.knots')}${shelter > 0.25 ? ` · ${t('hud.lee')}` : ''}`;
  }

  /** The cartouche: the sea's name, her course and the good priced on the map. */
  private drawCartouche() {
    const { map, boat, destination } = this.world;
    const p = this.parts;
    p.title.textContent = t('chart.seaTitle', { name: map.name });
    p.course.hidden = !destination;
    p.clearCourse.disabled = !destination;
    if (destination)
      p.courseText.textContent = t('chart.course', {
        label: destination.label,
        dist: t('unit.metres', { n: Math.round(distance(boat, destination)) }),
      });
    const good = this.prices.good;
    p.pricesOn.hidden = good === null;
    if (good) p.pricesText.textContent = t('chart.pricesFor', { good: goodName(good) });
  }

  /** The pages behind the book tabs: prices, cargo and the journal (hidden with no quests). */
  private drawPages() {
    const p = this.parts;
    drawPrices(
      { goods: p.marketGoods, title: p.marketTitle, table: p.prices },
      this.world,
      this.prices,
      {
        pick: (good) => {
          this.prices.pick(good);
          this.draw();
        },
        selectPort: (port) => this.selectPort(port),
      },
    );
    drawCargo(p.hold, this.world, this.questCargo());
    const entries = this.quests?.journal() ?? [];
    const tab = this.dialog.querySelector<HTMLElement>('#chart-tab-journal')!;
    tab.hidden = entries.length === 0;
    if (!entries.length && this.tab === 'journal') this.setTab('map');
    const news = entries.filter((e) => e.state === 'offered').length;
    p.journalBadge.hidden = news === 0;
    p.journalBadge.textContent = String(news);
    this.journal.render(entries);
  }

  private draw() {
    const focused = document.activeElement;
    const focusedTarget = focused?.getAttribute('data-chart-target');
    const focusText =
      focused instanceof HTMLButtonElement && this.dialog.contains(focused)
        ? focused.textContent
        : null;
    const { world } = this;
    const svg = this.parts.svg;
    svg.replaceChildren();
    this.view.update();
    this.parts.zoomIn.disabled = this.view.zoom >= this.view.maxZoom;
    this.parts.zoomOut.disabled = this.view.zoom <= 1;
    const unit = this.view.unitsPerPixel();
    // Map text keeps its screen size at every zoom and grows a little on large screens.
    const rect = svg.getBoundingClientRect();
    const k = Math.min(1.25, Math.max(1, Math.min(rect.width, rect.height) / 520));
    drawSea(
      { world, svg, shape: shaper(svg), unit, px: unit * k },
      {
        fogBlur: this.fogBlur,
        race: this.raceCourse(),
        questMarks: this.questMarks(),
        prices: this.prices,
        quests: this.quests,
        pierOf: (id) => this.pierOf(id),
        selectPort: (id) => this.selectPort(id),
        setQuestCourse: () => this.setQuestCourse(),
        removeMark: () => this.clearCourse(t('chart.statusMarkRemoved')),
      },
    );
    this.drawPages();
    this.drawCompass();
    this.drawCartouche();
    if (focusedTarget)
      this.parts.svg
        .querySelector<SVGElement>(`[data-chart-target="${CSS.escape(focusedTarget)}"]`)
        ?.focus({
          preventScroll: true,
        });
    else if (focusText) {
      const again = [...this.dialog.querySelectorAll('button')].find(
        (b) => b.textContent === focusText,
      );
      (again ?? this.parts.close).focus({ preventScroll: true });
    }
  }
}
