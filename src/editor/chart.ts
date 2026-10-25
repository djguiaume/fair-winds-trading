import { type Sectors, sectorSpan } from '../sim/seaSectors';
import { TUNING } from '../data/tuning';
import { bergChart, bergFields } from '../sim/bergs';
import { piersOf } from '../sim/collision';
import { GOOD_ICONS, isGood } from '../sim/goods';
import { islandCoasts, islandLake } from '../sim/islandLayout';
import type { MapDef } from '../sim/map';
import { DEG } from '../sim/math';
import { seaShape } from '../sim/seaEdge';
import { seaSvg } from '../ui/seaOutline';
import { landStyles, seaMarkShape } from '../ui/chartMarks';
import { drawFlow, drawFlowSelection, flowLabels } from './flowChart';
import { drawFleets } from './fleetChart';
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
  /** Currents and wind zones (decision 0140). */
  flow: boolean;
  /** Buoys, cardinal marks, boats and lights (decision 0130). */
  marks: boolean;
  /** Fog of war's chart areas (decision 0156). */
  areas?: boolean;
  /** Other boats' fleets: lanes and fishing grounds (decision 0215). */
  traffic?: boolean;
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
  /** The Windward Ring's own sea radius, drawn dashed on the grown sea (decision 0161). */
  ringRadius?: number;
  /** Each sea's slice of the outer ring (decision 0179), drawn as spokes from the ring's edge. */
  sectors?: Sectors;
  /** Chart size in pixels; the SVG's own size when left out (`npm run chart` has no layout). */
  size?: { width: number; height: number };
}

export function drawChart(svg: SVGSVGElement, scene: ChartScene) {
  const { map, prepared, shipped, selection, layers, view } = scene;
  const rect = scene.size ?? svg.getBoundingClientRect();
  const w = Math.max(1, rect.width) * view.upp,
    h = Math.max(1, rect.height) * view.upp;
  svg.setAttribute('viewBox', `${view.cx - w / 2} ${-view.cy - h / 2} ${w} ${h}`);
  svg.replaceChildren();
  const px = view.upp;
  const el = (tag: string, attrs: Record<string, string | number>, parent: Element = svg) => {
    const node = svg.ownerDocument.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    parent.append(node);
    return node;
  };
  const pts = (outline: [number, number][]) => outline.map(([x, y]) => `${x},${-y}`).join(' ');
  // Every name's box (text centred on x, baseline at y), so the wind zones' names keep clear.
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const labelBox = (text: string, x: number, y: number, size: number) => {
    const w = text.length * size * px * 0.55,
      h = size * px;
    return { x0: x - w / 2, x1: x + w / 2, y0: y - h * 1.1, y1: y + h * 0.4 };
  };
  const label = (text: string, x: number, y: number, size: number, cls = '') => {
    placed.push(labelBox(text, x, y, size));
    el('text', {
      x,
      y,
      class: `c-label ${cls}`,
      'font-size': size * px,
      'stroke-width': 3 * px,
    }).textContent = text;
  };
  // A big zone's middle often holds other names (the Cold Sea round the Calving Grounds): the
  // first free spot stepping up and down from it, slid in from the sea's rim (Phase 4 review).
  const freeLabel = (text: string, x: number, y: number, size: number, cls = '') => {
    const step = size * px * 1.4;
    const width = labelBox(text, 0, 0, size).x1 * 2;
    // Towards the sea's middle first, where there is more room; then a little to either side.
    const inward = y < 0 ? 1 : -1;
    const spots = (k: number) => {
      const ty = y + Math.ceil(k / 2) * step * (k % 2 ? inward : -inward);
      const rim =
        Math.sqrt(Math.max(0, map.boundsRadius ** 2 - (Math.abs(ty) + size * px) ** 2)) -
        6 * px -
        width / 2;
      if (rim <= 0) return [];
      return [0, -0.6, 0.6].map((f) => ({
        x: Math.min(Math.max(x + f * width, -rim), rim),
        y: ty,
      }));
    };
    const free = (c: { x: number; y: number }) => {
      const b = labelBox(text, c.x, c.y, size);
      return !placed.some((p) => p.x0 < b.x1 && b.x0 < p.x1 && p.y0 < b.y1 && b.y0 < p.y1);
    };
    let best = spots(0)[0] ?? { x, y };
    for (let k = 0; k <= 12; k++) {
      const found = spots(k).find(free);
      if (found) {
        best = found;
        break;
      }
    }
    label(text, best.x, best.y, size, cls);
  };

  // The water: the round sea, and any sea edges joined to it (decision 0202).
  const water = seaSvg(seaShape(map), 4 * px);
  el(water.tag, { ...water.attrs, class: 'c-sea', 'data-hit': 'sea' });
  // Each sea edge's own outline, faint, to pick it up and drag its points.
  for (const e of map.edges ?? []) {
    el('polygon', { points: pts(e.outline), class: 'c-edge-outline' });
    el('polygon', {
      points: pts(e.outline),
      class: 'c-edge-hit',
      'stroke-width': 10 * px,
      'data-hit': `edge:${e.id}`,
    });
  }
  if (scene.ringRadius) el('circle', { r: scene.ringRadius, class: 'c-ring-edge' });
  if (scene.sectors) drawSectors(el, label, scene.sectors, scene.ringRadius ?? 0, map, px);
  if (layers.grid) {
    const g = el('g', { class: 'c-grid' });
    const r = map.boundsRadius;
    for (let v = -Math.floor(r / 50) * 50; v <= r; v += 50) {
      const half = Math.sqrt(Math.max(0, r * r - v * v));
      el('line', { x1: v, x2: v, y1: -half, y2: half }, g);
      el('line', { y1: v, y2: v, x1: -half, x2: half }, g);
    }
  }

  if (layers.flow) drawFlow(el, map, px);
  // Fog of war's chart areas (decision 0156): a faint dashed outline each, named below.
  if (layers.areas)
    for (const a of map.fog?.areas ?? [])
      el('polygon', { points: pts(a.outline), class: 'c-area', 'data-hit': `area:${a.id}` });

  // Barrier islands, reefs and sandbanks first: port islands sit on top.
  for (const t of map.terrain ?? []) {
    const hit = `shape:${t.id}`;
    if (t.kind === 'island') {
      el('polygon', { points: pts(t.outline), class: 'c-shore', 'data-hit': hit });
      el('polygon', { points: pts(t.outline), class: 'c-land', 'data-hit': hit });
    } else
      el('polygon', {
        points: pts(t.outline),
        class:
          t.kind === 'reef'
            ? 'c-reef'
            : t.kind === 'shallows'
              ? 'c-shallows'
              : t.kind === 'ice'
                ? 'c-ice'
                : t.kind === 'bergs'
                  ? 'c-bergs'
                  : 'c-bank',
        'data-hit': hit,
      });
    const before = shipped.terrain?.find((s) => s.id === t.id);
    if (before && JSON.stringify(before.outline) !== JSON.stringify(t.outline))
      el('polygon', { points: pts(before.outline), class: 'c-ghost' });
  }
  // Drifting icebergs (decision 0170), with the flow layer: the loops the bergs drift round, the
  // band they sway across, which way (arrows), and each berg where it is now.
  if (layers.flow)
    bergFields(map).forEach((def, index) => {
      const chart = bergChart(def, index);
      for (const loop of chart.loops) {
        el('polygon', {
          points: pts(loop.points),
          class: 'c-berg-band',
          style: `stroke-width:${2 * chart.sway}`,
        });
        el('polygon', { points: pts(loop.points), class: 'c-berg-track' });
        for (const a of loop.arrows) {
          const s = 7 * px;
          const tip = [a.x + a.dx * s, a.y + a.dy * s];
          const back = (side: number) => [
            a.x - a.dx * s + a.dy * s * 0.8 * side,
            a.y - a.dy * s - a.dx * s * 0.8 * side,
          ];
          el('polygon', {
            points: pts([back(1), tip, back(-1)] as [number, number][]),
            class: 'c-berg-arrow',
          });
        }
      }
      for (const b of chart.bergs) el('circle', { cx: b.x, cy: -b.y, r: b.r, class: 'c-berg' });
    });

  const portIslands = new Set(map.ports.map((p) => p.islandId));
  for (const island of prepared.islands) {
    const hit = `island:${island.id}`;
    const coasts = islandCoasts(island);
    const [shore, land] = landStyles(island.look?.design);
    if (coasts)
      for (const c of coasts) {
        el('polygon', { points: pts(c), class: 'c-shore', ...shore });
        el('polygon', { points: pts(c), class: 'c-land', ...land });
      }
    else {
      const disc = { cx: island.x, cy: -island.y, r: island.radius };
      el('circle', { ...disc, class: 'c-shore', ...shore });
      el('circle', { ...disc, class: 'c-land', ...land });
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

  // Land that rises or clears after a quest (decision 0166): a dashed ring and its quest.
  for (const f of [...prepared.islands, ...(map.terrain ?? [])]) {
    const tag = f.tags?.find((t) => /^(after|before|during|except):/.test(t));
    if (!tag) continue;
    // Gold where it rises (after, during), pale where it clears (before, except).
    const cls = `c-quest c-quest-${/^(after|during):/.test(tag) ? 'after' : 'before'}`;
    // Its quest under it, clear of the name above.
    let x: number, below: number;
    if ('radius' in f) {
      el('circle', { cx: f.x, cy: -f.y, r: f.radius + 4 * px, class: cls });
      [x, below] = [f.x, -f.y + f.radius + 16 * px];
    } else {
      el('polygon', { points: pts(f.outline), class: cls });
      x = f.outline.reduce((n, p) => n + p[0], 0) / f.outline.length;
      below = Math.max(...f.outline.map((p) => -p[1])) + 14 * px;
    }
    label(tag.replace(':', ' '), x, below, 10, 'c-quest-label');
  }

  if (layers.harbours) {
    const heads = new Set<string>();
    for (const pier of piersOf(prepared)) {
      el('line', { x1: pier.x0, y1: -pier.y0, x2: pier.x1, y2: -pier.y1, class: 'c-pier' });
      // The first pier of a port island is its main one: you dock within range of its head.
      if (portIslands.has(pier.islandId) && !heads.has(pier.islandId)) {
        heads.add(pier.islandId);
        el('circle', {
          cx: pier.x1,
          cy: -pier.y1,
          r: TUNING.seamanship.harbour.dockRange,
          class: 'c-range',
        });
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

  if (layers.marks)
    (map.marks ?? []).forEach((mark, index) => {
      const { tag, attrs } = seaMarkShape(mark, px);
      el(tag, { ...attrs, 'data-hit': `mark:${index}` });
      // A bigger invisible target: a buoy is a few pixels across.
      el('circle', {
        cx: mark.x,
        cy: -mark.y,
        r: 7 * px,
        class: 'c-hit',
        'data-hit': `mark:${index}`,
      });
    });

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
  if (layers.flow || (selection?.kind === 'area' && layers.areas) || selection?.kind === 'edge')
    drawFlowSelection(el, map, selection, px);
  if (layers.traffic || selection?.kind === 'fleet')
    drawFleets(el, map, scene.prepared, selection, px);
  if (selection?.kind === 'waypoint') {
    const wp = map.course[selection.index];
    if (wp) el('circle', { cx: wp.x, cy: -wp.y, r: 9 * px, class: 'c-selected' });
  }
  if (selection?.kind === 'mark') {
    const mark = map.marks?.[selection.index];
    if (mark) el('circle', { cx: mark.x, cy: -mark.y, r: 9 * px, class: 'c-selected' });
  }
  if (selection?.kind === 'start')
    el('circle', { cx: s.x, cy: -s.y, r: 15 * px, class: 'c-selected' });

  if (layers.names) {
    for (const island of map.islands) {
      if (!island.name) continue;
      const port = map.ports.find((p) => p.islandId === island.id);
      const icon = port?.produces.find(isGood);
      // Above the coast's highest point: a ring-lagoon island's radius is far above its land.
      const shaped = prepared.islands.find((i) => i.id === island.id);
      const coasts = shaped && islandCoasts(shaped);
      const north = coasts
        ? Math.max(...coasts.flatMap((c) => c.map((p) => p[1])))
        : island.y + island.radius;
      label(`${island.name}${icon ? ` ${GOOD_ICONS[icon]}` : ''}`, island.x, -north - 8 * px, 15);
      if (port?.hidden)
        label(
          port.builds?.length ? 'hidden yard' : 'hidden',
          island.x,
          -north + 4 * px,
          11,
          'yard',
        );
    }
    for (const t of map.terrain ?? []) {
      if (!t.name) continue;
      const xs = t.outline.map((p) => p[0]),
        ys = t.outline.map((p) => p[1]);
      const x = (Math.min(...xs) + Math.max(...xs)) / 2;
      const y = (Math.min(...ys) + Math.max(...ys)) / 2;
      // A ring of ice round an island would put its name on the island: under the ring instead.
      const onIsland = map.islands.some((i) => Math.hypot(i.x - x, i.y - y) < i.radius * 2);
      label(t.name, x, onIsland ? -Math.min(...ys) + 12 * px : -y, 12, 'small');
    }
    if (layers.marks)
      for (const mark of map.marks ?? [])
        if (mark.name) label(mark.name, mark.x, -mark.y - 10 * px, 11, 'small');
    // The zones' names keep off the land too.
    for (const i of map.islands)
      placed.push({
        x0: i.x - i.radius,
        x1: i.x + i.radius,
        y0: -i.y - i.radius,
        y1: -i.y + i.radius,
      });
    if (layers.flow) flowLabels(map, freeLabel);
    if (layers.areas)
      for (const a of map.fog?.areas ?? []) {
        const xs = a.outline.map((p) => p[0]),
          ys = a.outline.map((p) => p[1]);
        label(
          `▦ ${a.name}`,
          (Math.min(...xs) + Math.max(...xs)) / 2,
          -(Math.min(...ys) + Math.max(...ys)) / 2,
          12,
          'small c-area-label',
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

/**
 * The seas' sectors (decision 0179): a dashed spoke at each border, from the ring's edge to the
 * rim, and each sea's name and span just inside the rim in the middle of its slice.
 */
function drawSectors(
  el: (tag: string, attrs: Record<string, string | number>, parent?: Element) => Element,
  label: (text: string, x: number, y: number, size: number, cls?: string) => void,
  sectors: Sectors,
  inner: number,
  map: MapDef,
  px: number,
) {
  const outer = map.boundsRadius;
  const g = el('g', { class: 'c-sector' });
  const at = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return [Math.sin(a) * r, -Math.cos(a) * r] as const;
  };
  const borders = new Set<number>();
  for (const [from, to] of Object.values(sectors)) borders.add(from % 360).add(to % 360);
  for (const deg of borders) {
    const [x1, y1] = at(deg, inner);
    const [x2, y2] = at(deg, outer);
    el('line', { x1, y1, x2, y2 }, g);
  }
  // Each sea's name just inside the rim, in the middle of its slice or as near it as is clear of
  // islands and their names.
  const r = outer - 34 * px;
  const clear = (deg: number) => {
    const [x, y] = at(deg, r);
    return (
      map.islands.every((i) => Math.hypot(i.x - x, -i.y - y) > i.radius + 70 * px) &&
      (map.terrain ?? []).every((t) =>
        t.outline.every(([tx, ty]) => Math.hypot(tx - x, -ty - y) > 70 * px),
      )
    );
  };
  for (const [id, s] of Object.entries(sectors)) {
    const span = sectorSpan(s);
    const mid = s[0] + span / 2;
    const offsets = [0, 6, -6, 12, -12, 18, -18, 24, -24, 30, -30].filter(
      (o) => Math.abs(o) < span / 2 - 8,
    );
    const deg = mid + (offsets.find((o) => clear(mid + o)) ?? 0);
    const [x, y] = at(deg, r);
    label(`${id} · ${s[0]}–${s[1]}°`, x, y, 13, 'c-sector-label');
  }
}
