import type { IslandDesign } from '../../data/islands';
import type { IslandIssue } from '../../sim/islandChecks';
import { propName, type Level } from './doc';
import type { IslandView } from './scene';

/**
 * The SVG drawn over the island (decision 0105), in island-radius units with the harbour at the
 * bottom: the harbour approach, later-level ghosts, prop outlines, the selection with its turn
 * handle, the check marks and the footprint of a prop being dropped. Every pickable shape has a
 * `data-hit` ("prop:12", "turn") so the builder knows what was pressed.
 */

const NS = 'http://www.w3.org/2000/svg';

export interface OverlayScene {
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
  el('rect', {
    x: APPROACH.x - APPROACH.halfWidth,
    y: APPROACH.z,
    width: APPROACH.halfWidth * 2,
    height: 1.6,
    class: 'i-approach',
  });

  if (s.showLater)
    for (const i of s.later)
      el('polygon', {
        points: pts(s.hull(i)),
        class: 'i-ghost',
        'data-hit': `prop:${i}`,
      }).append(
        title(`${propName(s.design.props[i]!.type)} · from level ${s.design.props[i]!.from}`),
      );

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
      'data-hit': issue.prop !== undefined ? `prop:${issue.prop}` : 'sea',
    });
    el('circle', { cx: issue.at[0], cy: issue.at[1], r: 8 * u }, g);
    const t = el('text', { x: issue.at[0], y: issue.at[1] + 4.5 * u, 'font-size': 12 * u }, g);
    t.textContent = '!';
    g.append(title(issue.message));
  }

  if (s.selection !== null && s.design.props[s.selection]) {
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

function title(text: string) {
  const t = document.createElementNS(NS, 'title');
  t.textContent = text;
  return t;
}
