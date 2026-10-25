import { TUNING } from '../data/tuning';
import { zonesTuning } from '../sim/windZones';
import { laneShape } from '../sim/currents';
import {
  type Crest,
  type OutlinePoint,
  areaCrests,
  boundingCircle,
  laneCrests,
  laneEdges,
  smoothOutline,
} from '../sim/flowShapes';
import type { ChartAreaDef } from '../sim/fog';
import type { SeaEdgeDef } from '../sim/seaEdge';
import type { CurrentDef, MapDef, WindZoneDef } from '../sim/map';
import { knotToUnits } from '../sim/boat';
import { isBeltKind } from '../sim/stormBelt';
import type { Selection } from './model';

/**
 * Currents and wind zones on the editor's chart (decision 0140): each current as the smooth band
 * of darker water the game draws, with crests drifting downstream; each zone as a soft tinted
 * area with its name. Handles for the selected one. Hits are tagged like the rest of the chart:
 * `current:id`, `cpoint:id:k`, `cwidth:id:k`, `cinsert:id:k`, `zone:id`, `zpoint:id:k`,
 * `zinsert:id:k`.
 */

const NS = 'http://www.w3.org/2000/svg';
type El = (tag: string, attrs: Record<string, string | number>, parent?: Element) => Element;

const pts = (outline: readonly (readonly number[])[]) =>
  outline.map(([x, y]) => `${x},${-y!}`).join(' ');

/** Zone tints by kind; an unknown kind is grey so it stands out next to the failing check. */
const ZONE_TINT: Record<string, string> = {
  'trade-belt': '#f2cf7e',
  doldrums: '#eef3f4',
  'stormy-coast': '#5b6b8c',
  'cold-gale': '#bfe3ff',
  sheltered: '#7cc04f',
  'storm-belt': '#3d4766',
};
const ZONE_NAMES: Record<string, string> = {
  'trade-belt': 'trade belt',
  doldrums: 'doldrums',
  'stormy-coast': 'stormy coast',
  'cold-gale': 'cold gale',
  sheltered: 'sheltered',
  'storm-belt': 'storm belt',
};
/** Does a zone's name already say its kind ("The Cold Sea", a cold sea), as a whole word? */
export const namesKind = (name: string, kind: string) =>
  new RegExp(`\\b${kind.replace(/[^a-z ]/gi, '')}\\b`, 'i').test(name);
export const zoneKindName = (kind: string) => ZONE_NAMES[kind] ?? kind.replace(/-/g, ' ');
/** A kind's tint: its `chart` colour in weather.json (decision 0169), else the built-in one. */
export const zoneTint = (kind: string) =>
  zonesTuning().kinds[kind]?.chart ?? ZONE_TINT[kind] ?? '#888';

/** The soft-edge blur, in map units. */
function softFilter(el: El) {
  const defs = el('defs', {});
  const filter = el(
    'filter',
    { id: 'c-soft', x: '-20%', y: '-20%', width: '140%', height: '140%' },
    defs,
  );
  el('feGaussianBlur', { stdDeviation: TUNING.weather.currents.edgeFadeUnits / 2 }, filter);
}

/** Zones, then current bands; crests go in a group `animateCrests` refreshes. */
export function drawFlow(el: El, map: MapDef, px: number) {
  if (!map.currents?.length && !map.windZones?.length) return;
  softFilter(el);
  for (const z of map.windZones ?? []) {
    const outline = smoothOutline(z.outline);
    el('polygon', {
      points: pts(outline),
      class: 'c-zone',
      fill: zoneTint(z.kind),
      filter: 'url(#c-soft)',
    });
    el('polygon', { points: pts(outline), class: 'c-hit', 'data-hit': `zone:${z.id}` });
    if (isBeltKind(z.kind)) squallArrows(el, outline, z.headingDeg ?? 90, px);
  }
  for (const c of map.currents ?? []) {
    const band = bandOf(c);
    if (!band) continue;
    el('polygon', { points: pts(band), class: 'c-current', filter: 'url(#c-soft)' });
    el('polygon', { points: pts(band), class: 'c-hit', 'data-hit': `current:${c.id}` });
  }
  const crests = el('g', { class: 'c-crests', 'stroke-width': 2.2 * px });
  drawCrests(crests, map);
}

/**
 * A storm belt's squalls march downwind of its heading (decision 0167): a row of chevrons across
 * its middle shows which way, so the side they roll in from is plain.
 */
function squallArrows(el: El, outline: OutlinePoint[], headingDeg: number, px: number) {
  const to = ((headingDeg + 180) * Math.PI) / 180;
  const dx = Math.sin(to),
    dy = Math.cos(to);
  const along = outline.map(([x, y]) => x * dx + y * dy);
  const { x: cx, y: cy } = boundingCircle(outline);
  const c = cx * dx + cy * dy;
  const half = (Math.max(...along) - Math.min(...along)) / 2;
  const size = Math.min(26, half / 4);
  const g = el('g', { class: 'c-squalls', 'stroke-width': 2.5 * px });
  for (let k = -2; k <= 2; k++) {
    const s = c + k * half * 0.38;
    const x = cx + (s - c) * dx,
      y = cy + (s - c) * dy;
    // A chevron pointing along (dx, dy): two strokes back from its tip.
    const bx = x - dx * size,
      by = y - dy * size;
    const wx = dy * size * 0.7,
      wy = -dx * size * 0.7;
    el('path', { d: `M${bx + wx},${-(by + wy)} L${x},${-y} L${bx - wx},${-(by - wy)}` }, g);
  }
}

/** The outline of a current's water: a lane's band, or an area's smoothed outline. */
function bandOf(c: CurrentDef): OutlinePoint[] | null {
  const lane = laneShape(c);
  if (lane) {
    const { left, right } = laneEdges(lane.points);
    return [...left, ...right.reverse()];
  }
  return c.outline && c.outline.length >= 3 ? smoothOutline(c.outline) : null;
}

/** Seconds since the page opened: the crests' clock. */
const clock = () => performance.now() / 1000;

function crestsOf(c: CurrentDef, t: number): Crest[] {
  // Drift at half the water's speed, so the crests read as moving without racing.
  const drift = t * c.speedKn * knotToUnits() * 0.5;
  const lane = laneShape(c);
  if (lane) return laneCrests(lane.points, drift, TUNING.weather.currents.endFadeUnits);
  return c.outline && c.outline.length >= 3
    ? areaCrests(smoothOutline(c.outline), c.towardDeg ?? 0, drift)
    : [];
}

function drawCrests(group: Element, map: MapDef) {
  const t = clock();
  group.replaceChildren();
  for (const c of map.currents ?? [])
    for (const crest of crestsOf(c, t)) {
      const path = group.ownerDocument.createElementNS(NS, 'path');
      path.setAttribute(
        'd',
        `M${crest.a[0]},${-crest.a[1]} Q${crest.c[0]},${-crest.c[1]} ${crest.b[0]},${-crest.b[1]}`,
      );
      path.setAttribute('stroke-opacity', (0.55 * crest.alpha).toFixed(2));
      group.append(path);
    }
}

/** Moves the crests on (called every few frames while the layer is shown). */
export function animateCrests(svg: SVGSVGElement, map: MapDef) {
  const group = svg.querySelector('g.c-crests');
  if (group) drawCrests(group, map);
}

/** Names of zones and currents, for the names layer. */
export function flowLabels(
  map: MapDef,
  label: (text: string, x: number, y: number, size: number, cls?: string) => void,
) {
  for (const z of map.windZones ?? []) {
    const { x, y } = boundingCircle(z.outline);
    const heading = z.headingDeg !== undefined ? `from ${z.headingDeg}°` : '';
    // A storm belt's name goes just above its band, clear of the chevrons.
    const top = isBeltKind(z.kind) ? Math.max(...z.outline.map((p) => p[1])) + 10 : y;
    // "The Cold Sea", not "The Cold Sea (cold sea)": the kind only when the name does not say it.
    const name = z.name ?? z.id;
    const kind = namesKind(name, zoneKindName(z.kind)) ? '' : zoneKindName(z.kind);
    const note = [kind, heading].filter(Boolean).join(' · ');
    label(note ? `${name} (${note})` : name, x, -top, 12, 'small');
  }
  for (const c of map.currents ?? []) {
    const lane = laneShape(c);
    const at = lane
      ? lane.points[Math.floor(lane.points.length / 2)]!
      : c.outline && boundingCircle(c.outline);
    if (!at) continue;
    const [x, y] = Array.isArray(at) ? at : [at.x, at.y];
    label(`${c.name ?? c.id} · ${c.speedKn} kn`, x!, -y! - 14, 12, 'small');
  }
}

/** Handles of the selected current or zone: points, widths and insert rings. */
export function drawFlowSelection(el: El, map: MapDef, selection: Selection, px: number) {
  if (
    selection?.kind !== 'current' &&
    selection?.kind !== 'zone' &&
    selection?.kind !== 'area' &&
    selection?.kind !== 'edge'
  )
    return;
  const isCurrent = selection.kind === 'current';
  const shape: CurrentDef | WindZoneDef | ChartAreaDef | SeaEdgeDef | undefined = isCurrent
    ? map.currents?.find((c) => c.id === selection.id)
    : selection.kind === 'zone'
      ? map.windZones?.find((z) => z.id === selection.id)
      : selection.kind === 'area'
        ? map.fog?.areas.find((a) => a.id === selection.id)
        : map.edges?.find((e) => e.id === selection.id);
  if (!shape) return;
  const prefix = selection.kind[0]!;
  const id = shape.id;
  const path = 'path' in shape ? shape.path : undefined;
  const points: readonly (readonly number[])[] = path ?? shape.outline ?? [];
  const closed = !path;
  if (path) {
    el('polyline', { points: pts(path), class: 'c-selected c-dashed' });
    const lane = laneShape(shape as CurrentDef);
    if (lane) {
      const { left, right } = laneEdges(lane.points);
      el('polygon', { points: pts([...left, ...right.reverse()]), class: 'c-selected' });
    }
  } else if (selection.kind === 'zone')
    el('polygon', { points: pts(smoothOutline(points as OutlinePoint[])), class: 'c-selected' });
  if (closed && points.length) el('polygon', { points: pts(points), class: 'c-selected c-dashed' });
  const n = points.length;
  for (let k = 0; k < (closed ? n : n - 1); k++) {
    const [x, y] = points[k]!,
      [nx, ny] = points[(k + 1) % n]!;
    el('circle', {
      cx: (x! + nx!) / 2,
      cy: -(y! + ny!) / 2,
      r: 3.5 * px,
      class: 'c-add',
      'data-hit': `${prefix}insert:${id}:${k}`,
    });
  }
  if (path)
    path.forEach(([x, y, w], k) => {
      // The width handle sits on the band's left edge, square to the flow.
      const a = path[Math.max(0, k - 1)]!,
        b = path[Math.min(n - 1, k + 1)]!;
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        len = Math.hypot(dx, dy) || 1;
      const hx = x - (dy / len) * (w / 2),
        hy = y + (dx / len) * (w / 2);
      el('line', { x1: x, y1: -y, x2: hx, y2: -hy, class: 'c-width' });
      el('rect', {
        x: hx - 4 * px,
        y: -hy - 4 * px,
        width: 8 * px,
        height: 8 * px,
        class: 'c-handle c-width-handle',
        'data-hit': `cwidth:${id}:${k}`,
      });
    });
  points.forEach(([x, y], k) =>
    el('circle', {
      cx: x!,
      cy: -y!,
      r: 5.5 * px,
      class: `c-handle${selection.point === k ? ' on' : ''}`,
      'data-hit': `${prefix}point:${id}:${k}`,
    }),
  );
  // Where the water goes: a small mark at the lane's last point.
  if (path && n >= 2) {
    const [x, y] = path[n - 1]!;
    el('circle', { cx: x, cy: -y, r: 9 * px, class: 'c-selected' });
  }
}
