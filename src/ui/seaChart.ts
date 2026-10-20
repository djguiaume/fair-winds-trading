import type { World } from '../sim/world';
import { WIND_FORCES, windForce } from '../sim/windStrength';
import { DEG } from '../sim/math';
import { GOODS, type GoodId } from '../sim/goods';
import { quoteAcross, topNeed, unitSellPrice } from '../sim/market';
import { discoveredPorts } from '../sim/shipyards';
import { goodName, t } from '../i18n';
import { icon, COIN } from './icons';

interface Pin {
  x: number;
  y: number;
  label: string;
}
const NS = 'http://www.w3.org/2000/svg';

/** An event-driven DOM/SVG chart; no second WebGL scene or animation loop. */
export class SeaChart {
  onChange: () => void = () => {};
  onDestinationChange: () => void = () => {};
  private pins: Pin[] = [];
  private previousFocus: HTMLElement | null = null;
  private readonly key: string;
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
    this.key = `fwt.chart.v1.${world.map.name}`;
    try {
      const data: unknown = JSON.parse(localStorage.getItem(this.key) ?? '[]');
      if (Array.isArray(data))
        this.pins = data
          .filter(
            (p): p is Pin =>
              p &&
              Number.isFinite(p.x) &&
              Number.isFinite(p.y) &&
              Math.hypot(p.x, p.y) <= world.map.boundsRadius &&
              typeof p.label === 'string' &&
              /^Marker [1-5]$/.test(p.label),
          )
          .slice(0, 5);
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
    this.get('chart-pin-here').addEventListener('click', () =>
      this.addPin(world.boat.x, world.boat.y),
    );
    this.get('chart-map').addEventListener('click', (event) => {
      if (this.dragged) return;
      const svg = this.get('chart-map') as unknown as SVGSVGElement;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const p = point.matrixTransform(matrix.inverse());
      this.addPin(p.x, -p.y);
    });
    dialog.addEventListener('close', () => {
      this.onChange();
      this.previousFocus?.focus({ preventScroll: true });
    });
  }

  private setPanel(name: string | null) {
    this.panel = name;
    for (const id of ['legend', 'market', 'markers']) {
      const panel = this.dialog.querySelector<HTMLElement>(`#chart-${id}-panel`);
      if (panel) panel.hidden = name !== id;
      this.dialog
        .querySelector(`#chart-${id}-toggle`)
        ?.setAttribute('aria-expanded', String(name === id));
    }
  }
  private setupTools() {
    for (const id of ['legend', 'market', 'markers']) {
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
    // A drag must never select a port or place a marker on pointer release.
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
  private get(id: string): HTMLElement {
    return this.dialog.querySelector(`#${id}`)!;
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
  private save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.pins));
    } catch {
      /* private mode */
    }
  }
  private addPin(x: number, y: number) {
    if (Math.hypot(x, y) > this.world.map.boundsRadius) return;
    if (this.pins.length >= 5) {
      this.status(t('chart.statusFull'));
      return;
    }
    const label = Array.from({ length: 5 }, (_, i) => `Marker ${i + 1}`).find(
      (label) => !this.pins.some((p) => p.label === label),
    )!;
    this.pins.push({ x, y, label });
    this.save();
    this.draw();
    this.status(t('chart.statusPlaced', { label: this.pinName(label) }));
  }
  /** Pins keep their English id ("Marker 2") in storage; this is the name players read. */
  private pinName(label: string) {
    return t('chart.marker', { n: label.slice(-1) });
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
  /** Market overview (decision 0036): one good's prices at every charted port. */
  private drawMarket() {
    const good = this.good ?? this.defaultGood();
    const { map, trade } = this.world;
    const goods = this.get('chart-goods');
    goods.replaceChildren();
    for (const g of GOODS) {
      const b = this.button(goods, goodName(g), () => {
        this.good = g;
        this.draw();
        this.status(t('chart.statusComparing', { good: goodName(g).toLowerCase() }));
      });
      b.insertAdjacentHTML('afterbegin', icon(g));
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(g === good));
      if (g === good) b.classList.add('active');
    }
    // Only charted ports (decision 0048): hidden yards join once discovered.
    const quotes = quoteAcross(
      trade.markets,
      good,
      discoveredPorts(map, trade).map((p) => p.id),
    );
    const cheapest = Math.min(...quotes.filter((q) => q.available > 0).map((q) => q.buy));
    const dearest = Math.max(...quotes.map((q) => q.sell));
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
          y: -island.y - island.radius - 6,
          class: 'chart-place',
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
          y: -Math.max(...terrain.outline.map((p) => p[1])) - 6,
          class: 'chart-place',
        });
        label.textContent = terrain.name;
      }
    }
    if (destination)
      shape('circle', {
        cx: destination.x,
        cy: -destination.y,
        r: 15 * unit,
        class: 'chart-selected',
      });
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
    const ports = this.get('chart-ports');
    ports.replaceChildren();
    for (const port of charted) {
      const island = map.islands.find((i) => i.id === port.islandId)!;
      const anchor = this.harbours[port.id] ?? island;
      const select = () => this.selectPort(port.id);
      const group = shape('g', {
        class: 'chart-port-target',
        role: 'button',
        tabindex: 0,
        'data-chart-target': port.id,
        'aria-label': t('chart.setBearingTo', { name: port.name }),
      });
      shape('circle', { cx: anchor.x, cy: -anchor.y, r: 22 * unit, fill: 'transparent' }, group);
      const mark = shape(
        'text',
        {
          x: anchor.x,
          y: -anchor.y,
          style: `font-size: ${22 * unit}px`,
          class: 'chart-port',
        },
        group,
      );
      // Port labels scale with the chart so names and needs stay legible on a phone.
      const size = 12 * unit;
      let top = Math.min(-island.y - island.radius - 8, -anchor.y - 27 * unit);
      // Keep the boat readable when it is beside its harbour's name/price.
      if (
        Math.abs(boat.x - island.x) < 80 * unit &&
        Math.abs(-boat.y - (top - size * 0.5)) < 26 * unit
      )
        top -= 30 * unit;
      const name = shape('text', {
        x: island.x,
        y: top - size * 1.1,
        class: 'chart-place chart-port-name',
        style: `font-size: ${size}px`,
      });
      name.textContent = port.name;
      group.append(name);
      const market = this.world.trade.markets[port.id];
      if (market) {
        // Top need (decision 0036): the good this port pays most for today, and that price.
        const need = topNeed(market);
        const price = String(unitSellPrice(need, market.stock[need] + 1));
        const word = t('chart.needVerb');
        const font = 11 * unit;
        const wordWidth = word.length * font * 0.55;
        const priceWidth = price.length * font * 0.6;
        const width = wordWidth + priceWidth + font * 3.5;
        const left = island.x - width / 2;
        const needLabel = shape(
          'g',
          {
            class: 'chart-need',
            'aria-label': t('chart.needLabel', { good: goodName(need), price }),
          },
          group,
        );
        const wordText = shape(
          'text',
          { x: left, y: top, style: `font-size: ${font}px` },
          needLabel,
        );
        wordText.textContent = word;
        shape(
          'use',
          {
            href: `#i-${need}`,
            x: left + wordWidth + font * 0.4,
            y: top - font,
            width: font * 1.2,
            height: font * 1.2,
          },
          needLabel,
        );
        const priceText = shape(
          'text',
          { x: left + wordWidth + font * 1.9, y: top, style: `font-size: ${font}px` },
          needLabel,
        );
        priceText.textContent = price;
        shape(
          'use',
          {
            href: '#i-coin',
            x: left + wordWidth + font * 2.1 + priceWidth,
            y: top - font,
            width: font * 1.15,
            height: font * 1.15,
          },
          needLabel,
        );
      }
      mark.textContent = '⚓';
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
      this.button(ports, `⚓ ${port.name}`, select);
    }
    this.drawMarket();
    const pins = this.get('chart-pins');
    pins.replaceChildren();
    for (const pin of this.pins) {
      const select = () => {
        this.world.destination = { x: pin.x, y: pin.y, label: this.pinName(pin.label), portId: '' };
        this.onDestinationChange();
        this.draw();
        this.status(t('chart.statusPinSet', { label: this.pinName(pin.label) }));
      };
      const group = shape('g', {
        class: 'chart-pin-target',
        role: 'button',
        tabindex: 0,
        'data-chart-target': pin.label,
        'aria-label': t('chart.setBearingTo', { name: this.pinName(pin.label) }),
      });
      shape('circle', { cx: pin.x, cy: -pin.y, r: 22 * unit, fill: 'transparent' }, group);
      const mark = shape(
        'text',
        {
          x: pin.x,
          y: -pin.y,
          class: 'chart-pin',
          style: `font-size: ${22 * unit}px`,
        },
        group,
      );
      mark.textContent = pin.label.replace('Marker ', '⚑');
      group.addEventListener('click', (e) => {
        e.stopPropagation();
        select();
      });
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      });
      this.button(pins, `⚑ ${this.pinName(pin.label)}`, select);
      this.button(pins, t('chart.removeMarker', { label: this.pinName(pin.label) }), () => {
        this.pins = this.pins.filter((p) => p !== pin);
        const target = this.world.destination;
        if (target && !target.portId && target.x === pin.x && target.y === pin.y)
          this.world.destination = null;
        this.save();
        this.draw();
        this.status(t('chart.statusRemoved', { label: this.pinName(pin.label) }));
      });
    }
    svg.append(player);
    this.status(destination ? t('chart.statusBearing', { label: destination.label }) : '');
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
