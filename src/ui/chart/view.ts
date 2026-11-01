import type { MapDef } from '../../sim/map';
import { seaReach, seaShape } from '../../sim/seaEdge';
import type { Box } from './svg';

/** Where the chart's zoom is kept between openings and visits (decision 0212). */
const ZOOM_KEY = 'fwt.chart.zoom';
/** A press that moves less than this (px) is a tap, not a drag. */
const TAP_SLOP = 6;
/** How long the view must rest before the words are placed again (ms). */
const SETTLE_MS = 150;
/** Mouse wheel: zoom per notch. */
const WHEEL_STEP = 1.15;

type Point = { x: number; y: number };

export interface ViewHooks {
  /** Draw the whole chart again (a zoom, or the view at rest after a pan). */
  redraw: () => void;
  /** A tap on the chart, not a drag: the map point under it. */
  tap: (at: Point) => void;
  /** The book tabs' width in landscape: the round sea fills the rest of the width. */
  sideRoom: () => number;
  /** The screen box the pad's cross keeps left of (the book tabs). */
  rightEdge: () => number | null;
}

/**
 * Where the chart looks (decisions 0115, 0183, 0212, issue #444): its zoom and centre, kept on her
 * boat until she pans; drag, pinch and the wheel; the arrow keys; a controller's cross. Only the
 * view box changes while the view moves; the chart is drawn again once it rests.
 */
export class ChartView {
  zoom = 1;
  private center: Point = { x: 0, y: 0 };
  /** Where the view would be centred if the sea's edge allowed: her boat, until she pans. */
  private aim: Point | null = null;
  /** Where the controller's cross is, in screen pixels from the middle of the chart (0183). */
  private cross: Point = { x: 0, y: 0 };
  private readonly pointers = new Map<number, Point>();
  private pinch: { dist: number; zoom: number; at: Point } | null = null;
  private drag: { x: number; y: number; cx: number; cy: number; unit: number } | null = null;
  /** The press moved: it was a drag or a pinch, not a tap. */
  private moved = false;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly svg: SVGSVGElement,
    private readonly crossEl: HTMLElement | null,
    private readonly map: () => MapDef,
    private readonly hooks: ViewHooks,
  ) {
    try {
      this.zoom = Number(localStorage.getItem(ZOOM_KEY)) || 1;
    } catch {
      /* Chart storage is optional and never touches voyage saves. */
    }
    this.listen();
  }

  /** The sea's half width with a margin, in map units. */
  private get extent() {
    return seaReach(seaShape(this.map())) + 24;
  }

  /**
   * Closest zoom: the same detail as 3x on the Windward Ring (sea radius 440) on any sea, so a
   * bigger map zooms in further rather than drawing its islands smaller (decision 0115).
   */
  get maxZoom() {
    return Math.max(3, (3 * this.extent) / (440 + 24));
  }

  /** Opens on her boat at the zoom she last chose, the cross in the middle. */
  openOn(boat: Point) {
    this.zoom = Math.min(this.maxZoom, Math.max(1, this.zoom));
    this.aim = { x: boat.x, y: -boat.y };
    this.cross = { x: 0, y: 0 };
    this.placeCross();
  }

  unitsPerPixel() {
    const rect = this.svg.getBoundingClientRect();
    const w = rect.width || 600,
      h = rect.height || 600;
    // Landscape: the round sea fills the width left of the book tabs, its top and bottom cut by
    // the page as on a real chart table (art director, #444); upright, it fits whole.
    const span = w > h ? w - this.hooks.sideRoom() : Math.min(w, h);
    return (this.extent * 2) / this.zoom / Math.max(1, span);
  }

  /** Writes the view box, the centre held inside the sea, and the zoom buttons' limits. */
  update() {
    const rect = this.svg.getBoundingClientRect();
    const unit = this.unitsPerPixel();
    const hw = ((rect.width || 600) * unit) / 2,
      hh = ((rect.height || 600) * unit) / 2;
    const extent = this.extent;
    // Until she pans, the view keeps making for the boat as zooming in leaves it room (0212).
    if (this.aim) this.center = { ...this.aim };
    const clamp = (v: number, half: number) =>
      Math.max(-Math.max(0, extent - half), Math.min(Math.max(0, extent - half), v));
    this.center = { x: clamp(this.center.x, hw), y: clamp(this.center.y, hh) };
    this.svg.setAttribute(
      'viewBox',
      `${this.center.x - hw} ${this.center.y - hh} ${hw * 2} ${hh * 2}`,
    );
  }

  /** Zoom in (factor > 1) or out; the first step in from the whole sea centres on the boat. */
  zoomBy(factor: number, boat: Point) {
    if (this.zoom === 1 && factor > 1) this.aim = { x: boat.x, y: -boat.y };
    if (this.setZoom(this.zoom * factor)) this.hooks.redraw();
  }

  /** The sea filling the page again, centred. */
  fit() {
    this.aim = null;
    this.center = { x: 0, y: 0 };
    this.setZoom(1);
    this.hooks.redraw();
  }

  /** Slide the view by screen pixels (a controller's stick, decision 0162). */
  panBy(dx: number, dy: number) {
    if (!dx && !dy) return;
    const unit = this.unitsPerPixel();
    this.aim = null;
    this.center = { x: this.center.x + dx * unit, y: this.center.y + dy * unit };
    this.update();
    this.settle();
  }

  /**
   * A controller's stick (decision 0183): the cross moves over the chart, and the view slides
   * only once the cross reaches an edge.
   */
  padMove(dx: number, dy: number, edgePx = 40) {
    if (!dx && !dy) return;
    const f = this.crossField(edgePx);
    const x = Math.max(f.left, Math.min(f.right, this.cross.x + dx));
    const y = Math.max(f.top, Math.min(f.bottom, this.cross.y + dy));
    const spillX = this.cross.x + dx - x,
      spillY = this.cross.y + dy - y;
    this.cross = { x, y };
    this.placeCross();
    if (spillX || spillY) this.panBy(spillX, spillY);
  }

  /** The cross in screen pixels. */
  crossOnScreen(): Point {
    const r = this.svg.getBoundingClientRect();
    return { x: r.left + r.width / 2 + this.cross.x, y: r.top + r.height / 2 + this.cross.y };
  }

  /** The map point under a screen point. */
  toMap(clientX: number, clientY: number): Point {
    const r = this.svg.getBoundingClientRect();
    const unit = this.unitsPerPixel();
    return {
      x: this.center.x + (clientX - r.left - r.width / 2) * unit,
      y: -(this.center.y + (clientY - r.top - r.height / 2) * unit),
    };
  }

  /** A screen rectangle (the rose, the cartouche) in the chart's drawing units. */
  cover(r: DOMRect): Box {
    const a = this.toMap(r.left, r.top),
      b = this.toMap(r.right, r.bottom);
    return { x0: a.x, y0: -a.y, x1: b.x, y1: -b.y };
  }

  /** Where the cross may go, in pixels from the chart's middle: clear of the book tabs. */
  private crossField(edgePx: number) {
    const r = this.svg.getBoundingClientRect();
    const cx = r.left + r.width / 2,
      cy = r.top + r.height / 2;
    let right = r.right - edgePx;
    const book = this.hooks.rightEdge();
    if (book !== null && book > cx) right = Math.min(right, book - edgePx / 2);
    const out = {
      left: r.left + edgePx - cx,
      right: right - cx,
      top: r.top + edgePx - cy,
      bottom: r.bottom - edgePx - cy,
    };
    if (out.left > out.right) out.left = out.right = (out.left + out.right) / 2;
    if (out.top > out.bottom) out.top = out.bottom = (out.top + out.bottom) / 2;
    return out;
  }

  private placeCross() {
    if (this.crossEl)
      this.crossEl.style.transform = `translate(${this.cross.x}px, ${this.cross.y}px)`;
  }

  /** A new zoom within its limits, kept for the next opening; false when it did not change. */
  private setZoom(zoom: number) {
    const next = Math.min(this.maxZoom, Math.max(1, zoom));
    if (next === this.zoom) return false;
    this.zoom = next;
    try {
      localStorage.setItem(ZOOM_KEY, String(next));
    } catch {
      /* A convenience only. */
    }
    return true;
  }

  /** Zoom keeping the map point under a screen point where it is (a pinch, the wheel). */
  private zoomAt(zoom: number, at: Point, clientX: number, clientY: number) {
    if (!this.setZoom(zoom)) return;
    this.aim = null;
    const r = this.svg.getBoundingClientRect();
    const unit = this.unitsPerPixel();
    this.center = {
      x: at.x - (clientX - r.left - r.width / 2) * unit,
      y: -at.y - (clientY - r.top - r.height / 2) * unit,
    };
    this.update();
  }

  /**
   * Words are kept on screen when the chart is drawn, so after a pan or a pinch they are placed
   * again once the view stops moving (a whole redraw per frame would cost old tablets).
   */
  private settle() {
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.hooks.redraw(), SETTLE_MS);
  }

  private listen() {
    const svg = this.svg;
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', (event) => {
      if (event.target !== svg) return;
      const step = 60;
      const move: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const d = move[event.key];
      if (!d) return;
      event.preventDefault();
      this.panBy(d[0], d[1]);
    });
    // A drag or a pinch must never press a port or drop a mark on release.
    svg.addEventListener(
      'click',
      (event) => {
        if (!this.moved) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true,
    );
    svg.addEventListener('click', (event) => {
      if ((event.target as Element).closest('[data-chart-target]')) return;
      this.hooks.tap(this.toMap(event.clientX, event.clientY));
    });
    svg.addEventListener('wheel', (event) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
      const at = this.toMap(event.clientX, event.clientY);
      this.zoomAt(this.zoom * factor, at, event.clientX, event.clientY);
      this.settle();
    });
    svg.addEventListener('pointerdown', (event) => this.down(event));
    svg.addEventListener('pointermove', (event) => this.move(event));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      svg.addEventListener(type, (event) => this.up(event));
  }

  private down(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!this.pointers.size) this.moved = false;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 1) {
      this.drag = { x: event.clientX, y: event.clientY, ...this.anchor() };
    } else if (this.pointers.size === 2) {
      // Two fingers: a pinch round the point between them.
      const [a, b] = [...this.pointers.values()] as [Point, Point];
      this.drag = null;
      this.pinch = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        zoom: this.zoom,
        at: this.toMap((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
    }
  }

  private anchor() {
    return { cx: this.center.x, cy: this.center.y, unit: this.unitsPerPixel() };
  }

  private move(event: PointerEvent) {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()] as [Point, Point];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      this.moved = true;
      this.zoomAt(
        this.pinch.zoom * (dist / this.pinch.dist),
        this.pinch.at,
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
      );
      return;
    }
    const d = this.drag;
    if (!d) return;
    const dx = event.clientX - d.x,
      dy = event.clientY - d.y;
    if (!this.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    if (!this.moved) this.svg.setPointerCapture?.(event.pointerId);
    this.moved = true;
    this.aim = null;
    this.center = { x: d.cx - dx * d.unit, y: d.cy - dy * d.unit };
    this.update();
  }

  private up(event: PointerEvent) {
    if (!this.pointers.delete(event.pointerId)) return;
    if (this.pinch && this.pointers.size < 2) {
      this.pinch = null;
      // The finger left on the glass drags on from where it is.
      const [rest] = [...this.pointers.values()];
      this.drag = rest ? { x: rest.x, y: rest.y, ...this.anchor() } : null;
    }
    if (!this.pointers.size) {
      this.drag = null;
      if (this.moved) this.settle();
    }
  }
}
