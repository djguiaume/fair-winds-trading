import type { World } from '../sim/world';
import { WIND_FORCES, windForce } from '../sim/windStrength';
import { GOODS, type GoodId } from '../sim/goods';
import { type PortQuote, quoteAcross } from '../sim/market';
import { DEG, distance } from '../sim/math';
import { discoveredPorts } from '../sim/shipyards';
import { goodName, t } from '../i18n';
import { icon, COIN } from './icons';

const NS = 'http://www.w3.org/2000/svg';

/** An event-driven DOM/SVG chart; no second WebGL scene or animation loop. */
export class SeaChart {
  onChange: () => void = () => {};
  onDestinationChange: () => void = () => {};
  private previousFocus: HTMLElement | null = null;
  /** Good shown in the market overview; null until the chart first opens. */
  private good: GoodId | null = null;
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
      Math.max(1, Math.min(rect.width || 600, rect.height || 600))
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
    this.good ??= this.defaultGood();
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
  /** Compare what you carry most of; with an empty hold, start with the first good. */
  private defaultGood(): GoodId {
    const { cargo } = this.world.trade.captain;
    return GOODS.reduce((best, g) => (cargo[g] > cargo[best] ? g : best), GOODS[0]);
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
    const good = this.good ?? this.defaultGood();
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
    for (const g of GOODS) {
      const b = this.button(goods, goodName(g), () => {
        this.good = g;
        this.draw();
      });
      b.insertAdjacentHTML('afterbegin', icon(g));
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(g === good));
      if (g === good) b.classList.add('active');
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
  /** The port card's second line: the picked good's price there, green when it is the best. */
  private cardLine(q: PortQuote | undefined, market: ReturnType<SeaChart['quotes']>) {
    if (!q) return { text: '', best: false };
    if (q.available > 0 && q.buy === market.cheapest)
      return {
        text: `${t('chart.cardBuy', { price: q.buy })} · ${t('chart.cardCheapest')}`,
        best: true,
      };
    if (q.sell === market.dearest)
      return {
        text: `${t('chart.cardSell', { price: q.sell })} · ${t('chart.cardBest')}`,
        best: true,
      };
    return { text: t('chart.cardSell', { price: q.sell }), best: false };
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
    const charted = discoveredPorts(map, this.world.trade);
    for (const island of map.islands) {
      shape('circle', { cx: island.x, cy: -island.y, r: island.radius, class: 'chart-land' });
      if (island.name && !charted.some((p) => p.islandId === island.id)) {
        const label = shape('text', {
          x: island.x,
          y: -island.y - island.radius - 6 * unit,
          class: 'chart-place',
          style: `font-size: ${11 * unit}px`,
        });
        label.textContent = island.name;
      }
    }
    for (const terrain of map.terrain ?? []) {
      shape('polygon', {
        points: terrain.outline.map(([x, y]) => `${x},${-y}`).join(' '),
        class:
          terrain.kind === 'island'
            ? 'chart-land'
            : terrain.kind === 'reef'
              ? 'chart-reef'
              : 'chart-bank',
      });
      if (terrain.name) {
        const xs = terrain.outline.map((p) => p[0]);
        const label = shape('text', {
          x: (Math.min(...xs) + Math.max(...xs)) / 2,
          y: -Math.max(...terrain.outline.map((p) => p[1])) - 6 * unit,
          class: 'chart-place',
          style: `font-size: ${11 * unit}px`,
        });
        label.textContent = terrain.name;
      }
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
      transform: `translate(${boat.x} ${-boat.y}) rotate(${boat.heading / DEG}) scale(${unit * 0.72})`,
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
    const [vx, vy, vw, vh] = (svg.getAttribute('viewBox') ?? '0 0 0 0').split(' ').map(Number);
    const view = { x: vx!, y: vy!, w: vw!, h: vh! };
    // Cards grow a little on large screens, where 14px names look lost.
    const rect = svg.getBoundingClientRect();
    const k = Math.min(1.3, Math.max(1, Math.min(rect.width, rect.height) / 520));
    // One card per charted port (style D, decision 0058): its name and the picked good's price.
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
      const line = this.cardLine(
        market.quotes.find((q) => q.portId === port.id),
        market,
      );
      const nameSize = 14 * k * unit;
      const lineSize = 12.5 * k * unit;
      const iconSize = 15 * k * unit;
      const lineWidth = line.text.length * lineSize * 0.5 + iconSize + 4 * unit;
      const width = Math.max(port.name.length * nameSize * 0.56, lineWidth) + 16 * unit;
      const height = 38 * k * unit;
      let bottom = -island.y - island.radius - 10 * unit;
      // Keep the boat readable when it sits right under a card.
      if (
        Math.abs(boat.x - island.x) < width / 2 + 14 * unit &&
        Math.abs(-boat.y - (bottom - height / 2)) < height / 2 + 14 * unit
      )
        bottom -= height + 18 * unit;
      const top = bottom - height;
      // Keep the whole card on screen at the chart's edges.
      const cx = Math.min(
        Math.max(island.x, view.x + width / 2 + 6 * unit),
        view.x + view.w - width / 2 - 6 * unit,
      );
      shape(
        'line',
        { x1: cx, y1: bottom, x2: anchor.x, y2: -anchor.y, class: 'chart-card-stem' },
        group,
      );
      shape('circle', { cx: anchor.x, cy: -anchor.y, r: 3.5 * unit, class: 'chart-pier' }, group);
      shape(
        'rect',
        { x: cx - width / 2, y: top, width, height, rx: 4 * unit, class: 'chart-card-box' },
        group,
      );
      const name = shape(
        'text',
        {
          x: cx,
          y: top + 16 * k * unit,
          class: 'chart-card-name',
          style: `font-size: ${nameSize}px`,
        },
        group,
      );
      name.textContent = port.name;
      if (line.text) {
        const left = cx - lineWidth / 2;
        shape(
          'use',
          {
            href: `#i-${market.good}`,
            x: left,
            y: top + 20 * k * unit,
            width: iconSize,
            height: iconSize,
          },
          group,
        );
        const price = shape(
          'text',
          {
            x: left + iconSize + 4 * unit,
            y: top + 32 * k * unit,
            class: `chart-need${line.best ? ' best' : ''}`,
            style: `font-size: ${lineSize}px`,
          },
          group,
        );
        price.textContent = line.text;
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
    this.drawMarket(market);
    svg.append(player);
    const course = this.dialog.querySelector<HTMLElement>('#chart-course');
    if (course) {
      course.hidden = !destination;
      if (destination)
        course.textContent = t('chart.course', {
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
