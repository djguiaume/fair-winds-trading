import { t } from '../../i18n';
import { coastDistance } from '../../sim/coast';
import { chartedAt } from '../../sim/fog';
import type { IslandDef, PortDef } from '../../sim/map';
import { seaReach, seaShape } from '../../sim/seaEdge';
import type { ZoneLabel } from './flows';
import type { Place } from './land';
import { type Box, box, chartSize, overlap, type Paint, pressable } from './svg';

/** Chart scale (map units per pixel) beyond which secondary names are left out (0115). */
const MAX_UNITS_PER_PIXEL_FOR_NAMES = 3;
/** Rough width of a letter, as a share of the font size: IM Fell and Alegreya run narrow. */
const LETTER = 0.52;

/** A port as the chart prints it: where its pier is, and the price line under its name. */
export interface PortLabel {
  port: PortDef;
  island: IslandDef;
  pier: { x: number; y: number };
  price: { text: string; best: boolean };
  selected: boolean;
  onSelect: () => void;
}

/**
 * The chart's words (decision 0058): ports first, each on the clearest side of its island, then
 * her islands, then the quieter names of places and zones only where they fit, never over a port,
 * a word already placed or the boat.
 */
export class Labels {
  private readonly placed: Box[] = [];
  private readonly view: Box;

  constructor(
    private readonly p: Paint,
    private readonly boat: Box,
    private readonly land: readonly Box[],
    /** The port dots and people's faces on the piers: no word may cover one. */
    private readonly badges: readonly Box[],
  ) {
    const [x, y, w, h] = (p.svg.getAttribute('viewBox') ?? '0 0 0 0').split(' ').map(Number);
    this.view = { x0: x!, y0: y!, x1: x! + w!, y1: y! + h! };
  }

  /** The free side of an island for a label: above, below, right, then left. */
  private spot(cx: number, top: number, bottom: number, w: number, h: number) {
    const { unit } = this.p;
    const gap = 5 * unit;
    const mid = (top + bottom) / 2,
      half = (bottom - top) / 2;
    const { view } = this;
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
        3 * overlap(b, this.boat) +
        3 * [...this.placed, ...this.badges].reduce((sum, p) => sum + overlap(b, p), 0) +
        this.land.reduce((sum, l) => sum + overlap(b, l), 0) * 0.5;
      if (score < bestScore - 1e-6) {
        best = c;
        bestScore = score;
      }
    }
    return best;
  }

  /** Whether a quiet name would cover the boat, a face or a word already placed. */
  private clashes(b: Box) {
    return (
      overlap(b, this.boat) > 0 || [...this.placed, ...this.badges].some((p) => overlap(b, p) > 0)
    );
  }

  /** A port: its badge on the pier, its name, and the picked good's price under it. */
  port(o: PortLabel) {
    const { shape, unit, px } = this.p;
    const { port, island, pier, price } = o;
    const group = shape('g', {
      class: `chart-port-target${o.selected ? ' is-selected' : ''}`,
      'data-chart-target': port.id,
    });
    pressable(group, t('chart.setBearingTo', { name: port.name }));
    const nameSize = chartSize('port') * px,
      priceSize = chartSize('price') * px;
    const w = Math.max(port.name.length, price.text.length * 0.9) * nameSize * LETTER;
    const h = nameSize * 1.15 + (price.text ? priceSize * 1.25 : 0);
    const at = this.spot(island.x, -island.y - island.radius, -island.y + island.radius, w, h);
    this.placed.push(box(at.x, at.y, w, h));
    const top = at.y - h / 2;
    // Invisible tap areas: the label and a finger-sized circle on the pier.
    shape(
      'rect',
      {
        x: at.x - w / 2 - 4 * unit,
        y: top - 3 * unit,
        width: w + 8 * unit,
        height: h + 6 * unit,
        class: 'chart-card-box',
      },
      group,
    );
    shape('circle', { cx: pier.x, cy: -pier.y, r: 20 * unit, class: 'chart-hit' }, group);
    shape('circle', { cx: pier.x, cy: -pier.y, r: 5 * px, class: 'chart-port-dot' }, group);
    const name = shape(
      'text',
      { x: at.x, y: top + nameSize * 0.9, class: 'chart-port-name', 'font-size': nameSize },
      group,
    );
    name.textContent = port.name;
    if (price.text) {
      const line = shape(
        'text',
        {
          x: at.x,
          y: top + nameSize * 1.15 + priceSize,
          class: `chart-need${price.best ? ' best' : ''}`,
          'font-size': priceSize,
        },
        group,
      );
      line.textContent = price.text;
    }
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      o.onSelect();
    });
  }

  /** One of her islands (decisions 0126, 0128): a house badge, its name and "your island". */
  home(island: IslandDef) {
    const { shape, px } = this.p;
    const name = island.name ?? island.id;
    const tag = t('chart.yourIsland');
    const nameSize = chartSize('port') * px,
      tagSize = chartSize('tag') * px;
    const w = Math.max(name.length * nameSize, tag.length * tagSize) * LETTER;
    const h = nameSize * 1.15 + tagSize * 1.2;
    const at = this.spot(island.x, -island.y - island.radius, -island.y + island.radius, w, h);
    this.placed.push(box(at.x, at.y, w, h));
    const top = at.y - h / 2;
    const group = shape('g', {
      class: 'chart-home',
      role: 'img',
      'aria-label': `${name} · ${tag}`,
    });
    shape('circle', { cx: island.x, cy: -island.y, r: 9 * px, class: 'chart-home-dot' }, group);
    const s = 12 * px;
    shape(
      'use',
      { href: '#i-home', x: island.x - s / 2, y: -island.y - s / 2, width: s, height: s },
      group,
    ).setAttribute('class', 'chart-home-icon');
    const label = shape(
      'text',
      { x: at.x, y: top + nameSize * 0.9, class: 'chart-port-name', 'font-size': nameSize },
      group,
    );
    label.textContent = name;
    const line = shape(
      'text',
      {
        x: at.x,
        y: top + nameSize * 1.15 + tagSize,
        class: 'chart-home-tag',
        'font-size': tagSize,
      },
      group,
    );
    line.textContent = tag;
  }

  /**
   * The quest flag's name on the clearest side of the flag, kept clear of everything after it;
   * null when every side would cover a name, a face or the boat (the flag keeps its label).
   */
  flag(goal: { x: number; y: number; label: string }) {
    const { px } = this.p;
    const size = chartSize('flag') * px;
    const w = goal.label.length * size * LETTER,
      h = size * 1.2;
    const at = this.spot(goal.x, -goal.y - 16 * px, -goal.y + 12 * px, w, h);
    const b = box(at.x, at.y, w, h);
    if (this.clashes(b)) return null;
    this.placed.push(b);
    return { x: at.x, y: at.y + size * 0.35 };
  }

  /**
   * Secondary names, small and italic, left out where they would cover a port or the boat. A big
   * sea seen whole on a small screen leaves them out until zoomed in (decision 0115). `flagged`:
   * the quest's flag names the island it lies by, so that island's own name gives way (0212).
   */
  places(places: readonly Place[], flagged: string | undefined) {
    const { shape, unit, px } = this.p;
    if (unit > MAX_UNITS_PER_PIXEL_FOR_NAMES) return;
    for (const place of places) {
      if (place.name === flagged) continue;
      const size = chartSize('place') * px;
      const w = place.name.length * size * LETTER,
        h = size * 1.2;
      const at = this.spot(place.x, place.top, place.bottom, w, h);
      const b = box(at.x, at.y, w, h);
      if (this.clashes(b)) continue;
      this.placed.push(b);
      const label = shape('text', {
        x: at.x,
        y: at.y + size * 0.35,
        class: 'chart-place',
        'font-size': size,
      });
      label.textContent = place.name;
    }
  }

  /**
   * Charted zones' names: only where the zone is wide enough to hold one, and never over a port, a
   * place name or the boat (decision 0152). Zooming in shows the small ones.
   */
  zones(zones: readonly ZoneLabel[]) {
    const { world, shape, unit, px } = this.p;
    const { map } = world;
    for (const z of zones) {
      const size = chartSize('zone') * px;
      const w = z.text.length * size * LETTER,
        h = size * 1.2;
      // Slid in from the sea's rim so the chart's edge never cuts the name (Phase 4 review).
      // Out in a section past the round sea (decision 0202), only the sea's reach bounds it.
      const R =
        Math.hypot(z.x, z.y) < map.boundsRadius ? map.boundsRadius : seaReach(seaShape(map));
      const rim = Math.sqrt(Math.max(0, R ** 2 - (Math.abs(z.y) + h / 2) ** 2));
      const room = rim - 6 * unit - w / 2;
      if (room < 0) continue;
      const x = Math.min(Math.max(z.x, -room), room);
      // A zone's name waits for its water to be charted, like the islands in it (decision 0156).
      if (!chartedAt(map, world.trade.progress, x, -z.y)) continue;
      const b = box(x, z.y, w, h);
      if (!fitsInside(x, -z.y, w, z.outline) || this.clashes(b)) continue;
      this.placed.push(b);
      const label = shape('text', {
        x,
        y: z.y + size * 0.35,
        class: `chart-zone-label chart-zone-${z.kind}`,
        'font-size': size,
      });
      label.textContent = z.text;
    }
  }
}

/** A name may run a little past a zone's edge, but not over a zone much narrower than it. */
function fitsInside(x: number, y: number, w: number, outline: [number, number][]) {
  const inside = (dx: number) => coastDistance(x + dx, y, outline).distance < 0;
  let chord = 0;
  for (const side of [-1, 1])
    for (let dx = 0; dx < w && inside(side * dx); dx += w / 20) chord += w / 20;
  return w <= chord * 1.7;
}
