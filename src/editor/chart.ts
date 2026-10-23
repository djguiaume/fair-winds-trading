import { piersOf } from '../sim/collision';
import { GOOD_ICONS, isGood } from '../sim/goods';
import { islandCoasts, islandLake } from '../sim/islandLayout';
import type { MapDef } from '../sim/map';
import { DEG } from '../sim/math';
import { DOCK_RANGE } from '../sim/trade';
import type { Selection } from './model';
import { findIsland, findShape, waypointOf } from './model';

/**
 * Draws the editor's chart as SVG in map units (y flipped, like the sea chart) and tags every
 * pickable shape with `data-hit` ("island:westholm", "point:gull-hook:3", "start" …) so the
 * editor finds what was pressed without its own hit testing.
 */

const NS = 'http://www.w3.org/2000/svg';

export interface Layers {
  names: boolean;
  course: boolean;
  harbours: boolean;
  grid: boolean;
}

export interface View {
  /** Map point at the centre of the chart. */
  cx: number;
  cy: number;
  /** Map units per screen pixel. */
  upp: number;
}

export interface ChartScene {
  /** The authored map being edited. */
  map: MapDef;
  /** The same map after prepareMap: harbour bearings and coast outlines. */
  prepared: MapDef;
  /** The shipped map, for the dashed "where it was" outlines. */
  shipped: MapDef;
  selection: Selection;
  layers: Layers;
  view: View;
}

export function drawChart(svg: SVGSVGElement, scene: ChartScene) {
  const { map, prepared, shipped, selection, layers, view } = scene;
  const rect = svg.getBoundingClientRect();
  const w = Math.max(1, rect.width) * view.upp,
    h = Math.max(1, rect.height) * view.upp;
  svg.setAttribute('viewBox', `${view.cx - w / 2} ${-view.cy - h / 2} ${w} ${h}`);
  svg.replaceChildren();
  const px = view.upp;
  const el = (tag: string, attrs: Record<string, string | number>, parent: Element = svg) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    parent.append(node);
    return node;
  };
  const pts = (outline: [number, number][]) => outline.map(([x, y]) => `${x},${-y}`).join(' ');
  const label = (text: string, x: number, y: number, size: number, cls = '') =>
    (el('text', {
      x,
      y,
      class: `c-label ${cls}`,
      'font-size': size * px,
      'stroke-width': 3 * px,
    }).textContent = text);

  el('circle', { r: map.boundsRadius, class: 'c-sea', 'data-hit': 'sea' });
  if (layers.grid) {
    const g = el('g', { class: 'c-grid' });
    const r = map.boundsRadius;
    for (let v = -Math.floor(r / 50) * 50; v <= r; v += 50) {
      const half = Math.sqrt(Math.max(0, r * r - v * v));
      el('line', { x1: v, x2: v, y1: -half, y2: half }, g);
      el('line', { y1: v, y2: v, x1: -half, x2: half }, g);
    }
  }

  // Barrier islands, reefs and sandbanks first: port islands sit on top.
  for (const t of map.terrain ?? []) {
    const hit = `shape:${t.id}`;
    if (t.kind === 'island') {
      el('polygon', { points: pts(t.outline), class: 'c-shore', 'data-hit': hit });
      el('polygon', { points: pts(t.outline), class: 'c-land', 'data-hit': hit });
    } else
      el('polygon', {
        points: pts(t.outline),
        class: t.kind === 'reef' ? 'c-reef' : 'c-bank',
        'data-hit': hit,
      });
    const before = shipped.terrain?.find((s) => s.id === t.id);
    if (before && JSON.stringify(before.outline) !== JSON.stringify(t.outline))
      el('polygon', { points: pts(before.outline), class: 'c-ghost' });
  }

  const portIslands = new Set(map.ports.map((p) => p.islandId));
  for (const island of prepared.islands) {
    const hit = `island:${island.id}`;
    const coasts = islandCoasts(island);
    if (coasts)
      for (const c of coasts) {
        el('polygon', { points: pts(c), class: 'c-shore' });
        el('polygon', { points: pts(c), class: 'c-land' });
      }
    else {
      el('circle', { cx: island.x, cy: -island.y, r: island.radius, class: 'c-shore' });
      el('circle', { cx: island.x, cy: -island.y, r: island.radius, class: 'c-land' });
    }
    const lake = islandLake(island);
    if (lake) el('polygon', { points: pts(lake), fill: '#2b9eac', 'pointer-events': 'none' });
    // A generous invisible disc to grab the island by, whatever its coast looks like.
    el('circle', {
      cx: island.x,
      cy: -island.y,
      r: Math.max(island.radius, 10 * px),
      class: 'c-hit',
      'data-hit': hit,
    });
    const before = shipped.islands.find((i) => i.id === island.id);
    if (
      before &&
      (before.x !== island.x || before.y !== island.y || before.radius !== island.radius)
    )
      el('circle', { cx: before.x, cy: -before.y, r: before.radius, class: 'c-ghost' });
  }

  if (layers.harbours) {
    const heads = new Set<string>();
    for (const pier of piersOf(prepared)) {
      el('line', { x1: pier.x0, y1: -pier.y0, x2: pier.x1, y2: -pier.y1, class: 'c-pier' });
      // The first pier of a port island is its main one: you dock within range of its head.
      if (portIslands.has(pier.islandId) && !heads.has(pier.islandId)) {
        heads.add(pier.islandId);
        el('circle', { cx: pier.x1, cy: -pier.y1, r: DOCK_RANGE, class: 'c-range' });
      }
    }
  }

  if (layers.course) {
    for (const island of map.islands) {
      const wp = waypointOf(map, island);
      if (wp && portIslands.has(island.id))
        el('line', { x1: island.x, y1: -island.y, x2: wp.x, y2: -wp.y, class: 'c-link' });
    }
    map.course.forEach((wp, index) => {
      el('circle', {
        cx: wp.x,
        cy: -wp.y,
        r: 5 * px,
        class: 'c-waypoint',
        'data-hit': `waypoint:${index}`,
      });
    });
  }

  // Start position: the boat icon pointing along the start heading.
  const s = map.start;
  const boat = el('g', {
    transform: `translate(${s.x} ${-s.y}) rotate(${s.headingDeg}) scale(${px})`,
    'data-hit': 'start',
  });
  el('path', { d: 'M0,-11 L7,8 L0,4 L-7,8 Z', class: 'c-start', 'data-hit': 'start' }, boat);

  // Selection outline and handles.
  if (selection?.kind === 'island') {
    const island = findIsland(prepared, selection.id);
    if (island) {
      el('circle', { cx: island.x, cy: -island.y, r: island.radius + 6 * px, class: 'c-selected' });
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        el('rect', {
          x: island.x + dx! * (island.radius + 6 * px) - 4 * px,
          y: -island.y - dy! * (island.radius + 6 * px) - 4 * px,
          width: 8 * px,
          height: 8 * px,
          class: 'c-handle',
          'data-hit': `radius:${island.id}`,
        });
    }
  }
  if (selection?.kind === 'shape') {
    const shape = findShape(map, selection.id);
    if (shape) {
      el('polygon', { points: pts(shape.outline), class: 'c-selected' });
      const n = shape.outline.length;
      shape.outline.forEach(([x, y], k) => {
        const [nx, ny] = shape.outline[(k + 1) % n]!;
        el('circle', {
          cx: (x + nx) / 2,
          cy: -(y + ny) / 2,
          r: 3.5 * px,
          class: 'c-add',
          'data-hit': `insert:${shape.id}:${k}`,
        });
      });
      shape.outline.forEach(([x, y], k) =>
        el('circle', {
          cx: x,
          cy: -y,
          r: 5.5 * px,
          class: `c-handle${selection.point === k ? ' on' : ''}`,
          'data-hit': `point:${shape.id}:${k}`,
        }),
      );
    }
  }
  if (selection?.kind === 'waypoint') {
    const wp = map.course[selection.index];
    if (wp) el('circle', { cx: wp.x, cy: -wp.y, r: 9 * px, class: 'c-selected' });
  }
  if (selection?.kind === 'start')
    el('circle', { cx: s.x, cy: -s.y, r: 15 * px, class: 'c-selected' });

  if (layers.names) {
    for (const island of map.islands) {
      if (!island.name) continue;
      const port = map.ports.find((p) => p.islandId === island.id);
      const icon = port?.produces.find(isGood);
      label(
        `${island.name}${icon ? ` ${GOOD_ICONS[icon]}` : ''}`,
        island.x,
        -island.y - island.radius - 8 * px,
        15,
      );
      if (port?.hidden)
        label(
          port.builds?.length ? 'hidden yard' : 'hidden',
          island.x,
          -island.y - island.radius + 4 * px,
          11,
          'yard',
        );
    }
    for (const t of map.terrain ?? []) {
      if (!t.name) continue;
      const xs = t.outline.map((p) => p[0]),
        ys = t.outline.map((p) => p[1]);
      label(
        t.name,
        (Math.min(...xs) + Math.max(...xs)) / 2,
        -(Math.min(...ys) + Math.max(...ys)) / 2,
        12,
        'small',
      );
    }
    label('start', s.x, -s.y + 22 * px, 11, 'small');
  }
}

/** The wind compass: where the base wind blows from. */
export function drawCompass(svg: SVGSVGElement, fromDeg: number) {
  svg.replaceChildren();
  svg.setAttribute('viewBox', '-40 -40 80 80');
  const el = (tag: string, attrs: Record<string, string | number>) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    svg.append(node);
    return node;
  };
  el('circle', { r: 36, fill: '#0d2433', stroke: '#e8c46a', 'stroke-width': 2 });
  // The arrow blows downwind: it starts on the side the wind comes from.
  const a = fromDeg * DEG;
  const [sx, sy] = [Math.sin(a) * 26, -Math.cos(a) * 26];
  el('line', { x1: sx, y1: sy, x2: -sx, y2: -sy, stroke: '#8fd3e6', 'stroke-width': 4 });
  el('path', {
    d: 'M0,0 L-7,-12 L7,-12 Z',
    fill: '#8fd3e6',
    transform: `translate(${-sx} ${-sy}) rotate(${fromDeg})`,
  });
}
