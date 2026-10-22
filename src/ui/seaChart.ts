import type { World } from '../sim/world';
import { WIND_FORCES, windForce } from '../sim/windStrength';
import { GOODS, type GoodId, isMadeGood } from '../sim/goods';
import { madeGoods } from '../sim/settlement';
import { type PortQuote, quoteAcross } from '../sim/market';
import { DEG, distance } from '../sim/math';
import { STORM_CORE } from '../sim/storms';
import { discoveredPorts } from '../sim/shipyards';
import { goodName, t } from '../i18n';
import { icon, COIN } from './icons';

const NS = 'http://www.w3.org/2000/svg';

type Box = { x0: number; y0: number; x1: number; y1: number };
const box = (cx: number, cy: number, w: number, h: number): Box => ({
  x0: cx - w / 2,
  y0: cy - h / 2,
  x1: cx + w / 2,
  y1: cy + h / 2,
});
/** Overlapping area of two boxes, used to choose the clearest side for a label. */
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
  Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** An event-driven DOM/SVG chart; no second WebGL scene or animation loop. */
export class SeaChart {
  onChange: () => void = () => {};
  onDestinationChange: () => void = () => {};
  private previousFocus: HTMLElement | null = null;
  /** Good whose prices show under the port names; null shows names only. */
  private good: GoodId | null = null;
  /** Until the player picks a good, the chart follows the cargo in the hold. */
  private goodPicked = false;
  private zoom = 1;
  private center = { x: 0, y: 0 };
  private panel: string | null = null;
  private dragged = false;
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
    for (const id of ['legend', 'market']) {
      const panel = this.dialog.querySelector<HTMLElement>(`#chart-${id}-panel`);
      if (panel) panel.hidden = name !== id;
      this.dialog
        .querySelector(`#chart-${id}-toggle`)
        ?.setAttribute('aria-expanded', String(name === id));
    }
  }
  private setupTools() {
    for (const id of ['legend', 'market']) {
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
    const changeZoom = (factor: number) => {
      if (this.zoom === 1 && factor > 1)
        this.center = { x: this.world.boat.x, y: -this.world.boat.y };
      this.zoom = Math.min(3, Math.max(1, this.zoom * factor));
      this.draw();
    };
    this.dialog.querySelector('#chart-zoom-in')?.addEventListener('click', () => changeZoom(1.5));
    this.dialog
      .querySelector('#chart-zoom-out')
      ?.addEventListener('click', () => changeZoom(1 / 1.5));
    this.dialog.querySelector('#chart-fit')?.addEventListener('click', () => {
      this.zoom = 1;
      this.center = { x: 0, y: 0 };
      this.draw();
    });
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
    if (plus) plus.disabled = this.zoom >= 3;
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
    const x = 40 * Math.sin(ship.noGoAngle),
      y = -40 * Math.cos(ship.noGoAngle);
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
  open() {
    if (this.isOpen) return;
    this.previousFocus = document.activeElement as HTMLElement | null;
    if (!this.goodPicked) this.good = this.defaultGood();
    this.zoom = 1;
    this.center = { x: 0, y: 0 };
    this.setPanel(null);
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
        notes.push(t('chart.order', { qty: order.qty, reward: order.reward }));
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
    const landBoxes: Box[] = [];
    for (const island of map.islands) {
      land('circle', { cx: island.x, cy: -island.y, r: island.radius });
      landBoxes.push(box(island.x, -island.y, island.radius * 2, island.radius * 2));
      if (island.name && !charted.some((p) => p.islandId === island.id))
        places.push({
          name: island.name,
          x: island.x,
          top: -island.y - island.radius,
          bottom: -island.y + island.radius,
        });
    }
    for (const terrain of map.terrain ?? []) {
      const points = terrain.outline.map(([x, y]) => `${x},${-y}`).join(' ');
      if (terrain.kind === 'island') land('polygon', { points });
      else
        shape('polygon', { points, class: terrain.kind === 'reef' ? 'chart-reef' : 'chart-bank' });
      const xs = terrain.outline.map((p) => p[0]);
      const ys = terrain.outline.map((p) => -p[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      if (terrain.kind === 'island') landBoxes.push({ x0, x1, y0, y1 });
      if (terrain.name && terrain.kind === 'island')
        places.push({ name: terrain.name, x: (x0 + x1) / 2, top: y0, bottom: y1 });
    }
    // Storms (decision 0067): a grey patch with its core, and where it is heading in 2 minutes.
    for (const storm of this.world.weather.storms) {
      if (storm.intensity < 0.05) continue;
      const g = shape('g', { class: 'chart-storm', opacity: Math.min(1, storm.intensity * 1.3) });
      shape('circle', { cx: storm.x, cy: -storm.y, r: storm.radius }, g);
      shape(
        'circle',
        { cx: storm.x, cy: -storm.y, r: storm.radius * STORM_CORE, class: 'core' },
        g,
      );
      // A short arrow from the centre the way it is drifting; it is not a course.
      const len = storm.radius * 0.8;
      const tip = { x: storm.x + storm.dx * len, y: -(storm.y + storm.dy * len) };
      shape('line', { x1: storm.x, y1: -storm.y, x2: tip.x, y2: tip.y, class: 'track' }, g);
      const head = 9 * unit;
      const [ux, uy] = [storm.dx, -storm.dy];
      shape(
        'polygon',
        {
          points: [
            [tip.x + ux * head, tip.y + uy * head],
            [tip.x - uy * head * 0.8, tip.y + ux * head * 0.8],
            [tip.x + uy * head * 0.8, tip.y - ux * head * 0.8],
          ]
            .map((p) => p.join(','))
            .join(' '),
          class: 'track-head',
        },
        g,
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
    // Secondary names: small and quiet, and left out where they would cover a port or the boat.
    for (const place of places) {
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
    this.drawMarket(market);
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
