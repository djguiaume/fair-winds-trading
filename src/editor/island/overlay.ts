import { atLevel, type IslandDesign } from '../../data/islands';
import type { IslandIssue } from '../../sim/islandChecks';
import { isSloped } from '../../sim/islandLayout';
import { propName, type Level } from './doc';
import { type Shape, groundOutline, pointsOf, shapeName } from './shapes';
import type { IslandView } from './scene';

/**
 * The SVG drawn over the island (decision 0105), in island-radius units with the harbour at the
 * bottom: the harbour approach, later-level ghosts, prop outlines, the selection with its turn
 * handle, the check marks and the footprint of a prop being dropped; with the ground and lane
 * tools, the coasts, raised ground (sloped edges green), the lake, lanes and painted woods, and
 * the selected outline's points. Every pickable shape has a `data-hit` ("prop:12", "turn",
 * "shape:ground:2", "pt:3", "ins:3", "edge:3") so the builder knows what was pressed.
 */

const NS = 'http://www.w3.org/2000/svg';

export interface OverlayScene {
  /** False on an island with no harbour: no approach to keep clear (decision 0110). */
  harbour: boolean;
  design: IslandDesign;
  level: Level;
  view: IslandView;
  width: number;
  height: number;
  /** Props standing at the level, and those that only come later. */
  now: number[];
  later: number[];
  showLater: boolean;
  outlines: boolean;
  selection: number | null;
  /** A prop's plan outline, in island-radius units, where it stands. */
  hull: (index: number) => [number, number][];
  issues: IslandIssue[];
  /** A prop being dragged in from the palette: its outline and whether it fits there. */
  drop?: { hull: [number, number][]; ok: boolean; label: string };
  /** Which tools are out: props, or ground (with woods) and lanes. */
  mode: 'props' | 'ground' | 'lanes';
  shape: { shape: Shape; point?: number } | null;
  /** A lane being drawn, and where the pointer is. */
  drawing?: { points: number[][]; hover?: [number, number] };
  /** The woods brush under the pointer. */
  brush?: { x: number; z: number; r: number; mode: 'grow' | 'clear' };
}

/** The arrival pier's lane, as the checks keep it (islandChecks APPROACH). */
const APPROACH = { x: 0.08, halfWidth: 0.12, z: 0.45 };

export function drawOverlay(svg: SVGSVGElement, s: OverlayScene) {
  const { view, width, height } = s;
  const u = view.upp;
  svg.setAttribute(
    'viewBox',
    `${view.cx - (width * u) / 2} ${view.cz - (height * u) / 2} ${width * u} ${height * u}`,
  );
  svg.replaceChildren();
  const el = (tag: string, attrs: Record<string, string | number>, parent: Element = svg) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    parent.append(e);
    return e;
  };
  const pts = (hull: [number, number][]) => hull.map(([x, z]) => `${x},${z}`).join(' ');
  const label = (x: number, z: number, text: string, cls = 'i-label') => {
    const t = el('text', { x, y: z, class: cls, 'font-size': 13 * u, 'stroke-width': 3.5 * u });
    t.textContent = text;
    return t;
  };

  // Everything not on a prop is "sea" for the pointer: pan, or drop an armed prop.
  el('rect', {
    x: view.cx - width * u,
    y: view.cz - height * u,
    width: width * u * 2,
    height: height * u * 2,
    fill: 'transparent',
    'data-hit': 'sea',
  });

  // The harbour approach, kept clear for the player's ship.
  const defs = el('defs', {});
  const hatch = el(
    'pattern',
    {
      id: 'i-hatch',
      width: 0.03,
      height: 0.03,
      patternUnits: 'userSpaceOnUse',
      patternTransform: 'rotate(45)',
    },
    defs,
  );
  el('line', { x1: 0, y1: 0, x2: 0, y2: 0.03, class: 'i-hatch-line' }, hatch);
  if (s.harbour)
    el('rect', {
      x: APPROACH.x - APPROACH.halfWidth,
      y: APPROACH.z,
      width: APPROACH.halfWidth * 2,
      height: 1.6,
      class: 'i-approach',
    });

  if (s.mode !== 'props') drawShapes(s, el, label);
  else if (s.showLater)
    for (const i of s.later)
      el('polygon', {
        points: pts(s.hull(i)),
        class: 'i-ghost',
        'data-hit': `prop:${i}`,
      }).append(
        title(`${propName(s.design.props[i]!.type)} · from level ${s.design.props[i]!.from}`),
      );

  if (s.mode === 'props')
    for (const i of s.now)
      el('polygon', {
        points: pts(s.hull(i)),
        class: s.outlines ? 'i-outline' : 'i-hit',
        'data-hit': `prop:${i}`,
      }).append(title(propName(s.design.props[i]!.type)));

  // Check marks: red errors, amber warnings, at this level or any.
  for (const issue of s.issues) {
    if (!issue.at || (issue.level !== undefined && issue.level !== s.level)) continue;
    const g = el('g', {
      class: `i-mark ${issue.severity}`,
      'data-hit': issue.prop !== undefined && s.mode === 'props' ? `prop:${issue.prop}` : 'sea',
    });
    el('circle', { cx: issue.at[0], cy: issue.at[1], r: 8 * u }, g);
    const t = el('text', { x: issue.at[0], y: issue.at[1] + 4.5 * u, 'font-size': 12 * u }, g);
    t.textContent = '!';
    g.append(title(issue.message));
  }

  if (s.mode === 'props' && s.selection !== null && s.design.props[s.selection]) {
    const i = s.selection;
    const p = s.design.props[i]!;
    const hull = s.hull(i);
    el('polygon', { points: pts(hull), class: 'i-selected' });
    // The turn handle sits in front of the prop (its +z side), out past its outline.
    const reach = Math.max(...hull.map(([x, z]) => Math.hypot(x - p.x, z - p.z))) + 18 * u;
    const a = ((p.turn ?? 0) * Math.PI) / 180;
    const hx = p.x + Math.sin(a) * reach,
      hz = p.z + Math.cos(a) * reach;
    el('line', { x1: p.x, y1: p.z, x2: hx, y2: hz, class: 'i-turn-line' });
    el('circle', { cx: hx, cy: hz, r: 7 * u, class: 'i-turn', 'data-hit': 'turn' }).append(
      title('Drag to turn · R / Shift+R turn 15°'),
    );
    const top = Math.min(...hull.map((h) => h[1]));
    label(p.x, top - 8 * u, `${propName(p.type)} · level ${p.from}${p.to ? `–${p.to}` : '+'}`);
  }

  if (s.drop) {
    el('polygon', { points: pts(s.drop.hull), class: s.drop.ok ? 'i-drop ok' : 'i-drop bad' });
    const top = Math.min(...s.drop.hull.map((h) => h[1]));
    const cx = s.drop.hull.reduce((n, h) => n + h[0], 0) / s.drop.hull.length;
    label(cx, top - 8 * u, s.drop.label);
  }
}

type El = (tag: string, attrs: Record<string, string | number>, parent?: Element) => Element;
const line = (points: number[][]) => points.map((p) => `${p[0]},${p[1]}`).join(' ');

/** The ground and lane tools' view: every outline and lane, the selection's points. */
function drawShapes(s: OverlayScene, el: El, label: (x: number, z: number, t: string) => Element) {
  const { design, view } = s;
  const u = view.upp;
  const selected = s.shape?.shape;
  const hit = (shape: Shape) =>
    shape.kind === 'lake' ? 'shape:lake' : `shape:${shape.kind}:${shape.index}`;
  const ground = s.mode === 'ground';

  // Painted woods: where trees may grow, and clearings.
  if (ground) {
    for (const [x, z, r] of design.woods.areas ?? [])
      el('circle', { cx: x, cy: z, r, class: 'i-woods' });
    for (const [x, z, r] of design.woods.clear ?? [])
      el('circle', { cx: x, cy: z, r, class: 'i-clearing' });
  }
  design.coasts.forEach((c, index) =>
    el('polygon', {
      points: line(c),
      class: `i-coast${ground ? '' : ' quiet'}`,
      'data-hit': ground ? hit({ kind: 'coast', index }) : 'sea',
    }),
  );
  if (design.lake)
    el('polygon', {
      points: line(design.lake),
      class: 'i-lake',
      'data-hit': ground ? 'shape:lake' : 'sea',
    });
  design.ground.forEach((g, index) => {
    if (!atLevel(g, s.level)) return;
    const o = groundOutline(design, g);
    const shape: Shape = { kind: 'ground', index };
    el('polygon', {
      points: line(o),
      class: `i-ground${g.shape === 'peak' ? ' peak' : ''}${ground ? '' : ' quiet'}`,
      'data-hit': ground && g.outline ? hit(shape) : 'sea',
    });
    // Sloped edges in green, as wide as their ramp.
    if (g.slope && g.outline)
      o.forEach((a, i) => {
        if (!isSloped(g, i)) return;
        const b = o[(i + 1) % o.length]!;
        el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'i-slope' });
      });
  });
  // Ramps (decision 0123): a band as wide as the ramp, its foot and top marked with heights.
  (design.ramps ?? []).forEach((r, index) => {
    if (!atLevel(r, s.level)) return;
    el('polyline', {
      points: line(r.points),
      class: `i-ramp${ground ? '' : ' quiet'}`,
      'stroke-width': r.width,
      'data-hit': ground ? hit({ kind: 'ramp', index }) : 'sea',
    }).append(title(`Ramp ${r.start} → ${r.end}`));
    if (ground) {
      const [a, b] = [r.points[0]!, r.points[r.points.length - 1]!];
      label(a[0], a[1] + 14 * u, `↑ ${r.start}`);
      label(b[0], b[1] - 10 * u, `${r.end}`);
    }
  });
  design.lanes.forEach((lane, index) =>
    el('polyline', {
      points: line(lane.points),
      class: `i-lane ${lane.kind ?? 'lane'}${s.mode === 'lanes' ? '' : ' quiet'}`,
      'data-hit': s.mode === 'lanes' ? hit({ kind: 'lane', index }) : 'sea',
    }),
  );

  if (selected) {
    const pts =
      selected.kind === 'ground' && !design.ground[selected.index]?.outline
        ? undefined
        : pointsOf(design, selected);
    const g = selected.kind === 'ground' ? design.ground[selected.index] : undefined;
    const outline = g ? groundOutline(design, g) : pts;
    if (outline) {
      const isLane = selected.kind === 'lane' || selected.kind === 'ramp';
      el(isLane ? 'polyline' : 'polygon', { points: line(outline), class: 'i-shape-selected' });
      const n = outline.length;
      const edges = isLane ? n - 1 : n;
      const xs = outline.map((p) => p[0]!),
        zs = outline.map((p) => p[1]!);
      const what = shapeName(design, selected);
      const r = selected.kind === 'ramp' ? design.ramps?.[selected.index] : undefined;
      const extra = g
        ? ` · ${g.height}${g.shape === 'peak' ? '' : g.slope ? ' · slope' : ' · cliff'}`
        : r
          ? ` · ${r.start} → ${r.end}`
          : '';
      label((Math.min(...xs) + Math.max(...xs)) / 2, Math.min(...zs) - 10 * u, what + extra);
      if (pts)
        for (let i = 0; i < edges; i++) {
          const a = outline[i]!,
            b = outline[(i + 1) % n]!;
          // Raised ground: click an edge to switch it between cliff and slope.
          if (g && g.shape !== 'peak')
            el('line', {
              x1: a[0]!,
              y1: a[1]!,
              x2: b[0]!,
              y2: b[1]!,
              class: 'i-edge-hit',
              'data-hit': `edge:${i}`,
            }).append(title('Click: cliff ↔ slope'));
          el('circle', {
            cx: (a[0]! + b[0]!) / 2,
            cy: (a[1]! + b[1]!) / 2,
            r: 4.5 * u,
            class: 'i-insert',
            'data-hit': `ins:${i}`,
          }).append(title('Drag to add a point'));
        }
      if (pts)
        pts.forEach((p, i) =>
          el('rect', {
            x: p[0]! - 5 * u,
            y: p[1]! - 5 * u,
            width: 10 * u,
            height: 10 * u,
            class: `i-point${s.shape?.point === i ? ' on' : ''}`,
            'data-hit': `pt:${i}`,
          }),
        );
    }
  }
  if (s.drawing) {
    const pts = [...s.drawing.points, ...(s.drawing.hover ? [s.drawing.hover] : [])];
    el('polyline', { points: line(pts), class: 'i-drawing' });
    for (const p of s.drawing.points)
      el('circle', { cx: p[0]!, cy: p[1]!, r: 4 * u, class: 'i-drawing-point' });
  }
  if (s.brush)
    el('circle', {
      cx: s.brush.x,
      cy: s.brush.z,
      r: s.brush.r,
      class: `i-brush ${s.brush.mode}`,
    });
}

function title(text: string) {
  const t = document.createElementNS(NS, 'title');
  t.textContent = text;
  return t;
}
