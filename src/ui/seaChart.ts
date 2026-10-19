import type { World } from '../sim/world';
import { DEG } from '../sim/math';

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
      this.status('Bearing cleared. Sail wherever you like.');
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
    this.draw();
    this.dialog.showModal();
    this.onChange();
  }
  close() {
    this.dialog.close();
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
      this.status('Five markers placed. Remove one to make room.');
      return;
    }
    const label = Array.from({ length: 5 }, (_, i) => `Marker ${i + 1}`).find(
      (label) => !this.pins.some((p) => p.label === label),
    )!;
    this.pins.push({ x, y, label });
    this.save();
    this.draw();
    this.status(`${label} placed. Select it below to set a bearing.`);
  }
  private button(parent: HTMLElement, label: string, action: () => void) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', action);
    parent.append(b);
    return b;
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
    for (const island of map.islands) {
      shape('circle', { cx: island.x, cy: -island.y, r: island.radius, class: 'chart-land' });
      if (island.name && !map.ports.some((p) => p.islandId === island.id)) {
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
    this.get('chart-wind').textContent =
      `N ↑ · Wind from ${windDegrees}° · ${wind.speedKn.toFixed(0)} kn · Sailing paused`;
    const ports = this.get('chart-ports');
    ports.replaceChildren();
    for (const port of map.ports) {
      const island = map.islands.find((i) => i.id === port.islandId)!;
      const anchor = this.harbours[port.id] ?? island;
      const select = () => {
        // Use the visible pier as the destination, rather than a legacy practice buoy.
        this.world.destination = { portId: port.id, label: port.name, ...anchor };
        this.onDestinationChange();
        this.draw();
        this.status(`Bearing set for ${port.name}. Close the chart when ready.`);
      };
      const mark = shape('text', {
        x: anchor.x,
        y: -anchor.y,
        class: 'chart-port',
        role: 'button',
        tabindex: 0,
        'aria-label': `Set bearing to ${port.name}`,
      });
      const name = shape('text', {
        x: island.x,
        y: -island.y - island.radius - 8,
        class: 'chart-place',
      });
      name.textContent = port.name;
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
    const pins = this.get('chart-pins');
    pins.replaceChildren();
    for (const pin of this.pins) {
      const select = () => {
        this.world.destination = { ...pin, portId: '' };
        this.onDestinationChange();
        this.draw();
        this.status(`Bearing set for ${pin.label}.`);
      };
      const mark = shape('text', { x: pin.x, y: -pin.y, class: 'chart-pin' });
      mark.textContent = pin.label.replace('Marker ', '⚑');
      mark.addEventListener('click', (e) => {
        e.stopPropagation();
        select();
      });
      this.button(pins, `⚑ ${pin.label}`, select);
      this.button(pins, `Remove ${pin.label}`, () => {
        this.pins = this.pins.filter((p) => p !== pin);
        if (this.world.destination?.label === pin.label && !this.world.destination.portId)
          this.world.destination = null;
        this.save();
        this.draw();
        this.status(`${pin.label} removed.`);
      });
    }
    this.status(destination ? `Bearing: ${destination.label}` : 'No destination selected.');
    if (focusText) {
      const replacement = Array.from(this.dialog.querySelectorAll('button')).find(
        (b) => b.textContent === focusText,
      );
      (replacement ?? this.get('close-chart')).focus({ preventScroll: true });
    }
  }
}
