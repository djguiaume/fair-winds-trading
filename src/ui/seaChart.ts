import type { World } from '../sim/world';
import { DEG } from '../sim/math';
import { GOODS, GOOD_ICONS, type GoodId } from '../sim/goods';
import { quoteAcross, topNeed, unitSellPrice } from '../sim/market';
import { discoveredPorts } from '../sim/shipyards';
import { goodName, t } from '../i18n';

interface Pin {
  x: number;
  y: number;
  label: string;
}
const NS = 'http://www.w3.org/2000/svg';

/** A static DOM/SVG chart, built only on opening; no second WebGL scene or render loop. */
export class SeaChart {
  onChange: () => void = () => {};
  onDestinationChange: () => void = () => {};
  private pins: Pin[] = [];
  private previousFocus: HTMLElement | null = null;
  private readonly key: string;
  /** Good shown in the market overview; null until the chart first opens. */
  private good: GoodId | null = null;

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
    this.draw();
    this.dialog.showModal();
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
      const b = this.button(goods, `${GOOD_ICONS[g]} ${goodName(g)}`, () => {
        this.good = g;
        this.draw();
        this.status(t('chart.statusComparing', { good: goodName(g).toLowerCase() }));
      });
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
        textContent: q.available > 0 ? `${q.buy} 🪙` : t('chart.none'),
      });
      const sell = Object.assign(document.createElement('td'), { textContent: `${q.sell} 🪙` });
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
    const focusText =
      focused instanceof HTMLButtonElement && this.dialog.contains(focused)
        ? focused.textContent
        : null;
    const { map, boat, wind, destination } = this.world;
    const svg = this.get('chart-map');
    svg.replaceChildren();
    const extent = map.boundsRadius + 24;
    svg.setAttribute('viewBox', `${-extent} ${-extent} ${extent * 2} ${extent * 2}`);
    const shape = (tag: string, attrs: Record<string, string | number>) => {
      const el = document.createElementNS(NS, tag);
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
      svg.append(el);
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
      shape('circle', { cx: destination.x, cy: -destination.y, r: 17, class: 'chart-selected' });
    // Heading uses north = zero and clockwise positive, matching SVG rotation.
    shape('path', {
      d: 'M0 -13 L8 10 L0 6 L-8 10 Z',
      transform: `translate(${boat.x} ${-boat.y}) rotate(${boat.heading / DEG})`,
      class: 'chart-boat',
    });
    const windDegrees = Math.round((wind.from / DEG + 360) % 360);
    this.get('chart-wind').textContent = t('chart.wind', {
      deg: windDegrees,
      kn: wind.speedKn.toFixed(0),
    });
    const ports = this.get('chart-ports');
    ports.replaceChildren();
    for (const port of charted) {
      const island = map.islands.find((i) => i.id === port.islandId)!;
      const anchor = this.harbours[port.id] ?? island;
      const select = () => this.selectPort(port.id);
      const mark = shape('text', {
        x: anchor.x,
        y: -anchor.y,
        class: 'chart-port',
        role: 'button',
        tabindex: 0,
        'aria-label': t('chart.setBearingTo', { name: port.name }),
      });
      // Port labels scale with the chart so names and needs stay legible on a phone.
      const size = Math.round(16 * Math.max(1, extent / 220));
      const top = -island.y - island.radius - 8;
      const name = shape('text', {
        x: island.x,
        y: top - size * 1.1,
        class: 'chart-place chart-port-name',
        style: `font-size: ${size}px`,
      });
      name.textContent = port.name;
      const market = this.world.trade.markets[port.id];
      if (market) {
        // Top need (decision 0036): the good this port pays most for today, and that price.
        const need = topNeed(market);
        const needLabel = shape('text', {
          x: island.x,
          y: top,
          class: 'chart-need',
          style: `font-size: ${Math.round(size * 0.9)}px`,
        });
        needLabel.textContent = t('chart.wantsLabel', {
          icon: GOOD_ICONS[need],
          price: unitSellPrice(need, market.stock[need] + 1),
        });
      }
      mark.textContent = '⚓';
      mark.addEventListener('click', (e) => {
        e.stopPropagation();
        select();
      });
      mark.addEventListener('keydown', (e) => {
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
      const mark = shape('text', { x: pin.x, y: -pin.y, class: 'chart-pin' });
      mark.textContent = pin.label.replace('Marker ', '⚑');
      mark.addEventListener('click', (e) => {
        e.stopPropagation();
        select();
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
    this.status(
      destination ? t('chart.statusBearing', { label: destination.label }) : t('chart.statusNone'),
    );
    if (focusText) {
      const replacement = Array.from(this.dialog.querySelectorAll('button')).find(
        (b) => b.textContent === focusText,
      );
      (replacement ?? this.get('close-chart')).focus({ preventScroll: true });
    }
  }
}
