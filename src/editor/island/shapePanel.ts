import { type GroundDef, type IslandDesign, LANE_WIDTH, type WoodsDef } from '../../data/islands';
import { WOODLAND_TREES } from '../../render/models/props';
import { GROUNDS, GROUND_IDS, groundId } from '../../data/grounds';
import { BEACH, isSloped } from '../../sim/islandLayout';
import { setSmooth } from './smooth';
import { LEVEL_NAMES, LEVELS, type Level, propName } from './doc';
import {
  RAMP_WIDTH,
  RIVER_WIDTH,
  SLOPE_WIDTH,
  type Shape,
  clearWoodsPainting,
  pointsOf,
  setEdges,
  setLaneKind,
  setRiverKind,
  setRiverPointWidth,
  shapeName,
} from './shapes';

/**
 * The island builder's panel for the ground and lane tools (decision 0105, part 2): the selected
 * coast, raised ground (height, ground material, cliff or slope edges, levels), mountain, lake or
 * lane, or with nothing selected the woods (with the brush) or the lanes. Every field edits
 * through `change`, which records undo and rebuilds the island.
 */
export interface ShapePanelHost {
  design: IslandDesign;
  mode: 'ground' | 'lanes';
  shape: { shape: Shape; point?: number } | null;
  brush: number;
  setBrush(r: number): void;
  change(edit: (design: IslandDesign) => void): void;
  remove(): void;
  /** Ground height at a point, for stairs. */
  heightAt(x: number, z: number): number;
}

export function renderShapePanel(root: HTMLElement, host: ShapePanelHost) {
  root.replaceChildren();
  const { design } = host;
  const node = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Record<string, string | boolean> = {},
    parent: HTMLElement = root,
  ): HTMLElementTagNameMap[K] => {
    const el = Object.assign(document.createElement(tag), props);
    parent.append(el);
    return el;
  };
  const div = (label: string) => {
    const r = node('div', { className: 'ed-row' });
    node('span', { textContent: label }, r);
    return r;
  };
  const note = (text: string) => node('p', { className: 'ed-note', textContent: text });
  const number = (
    label: string,
    value: number | undefined,
    set: (v: number | undefined) => void,
    opts: { step?: number; min?: number; placeholder?: string } = {},
  ) => {
    const r = node('label', { className: 'ed-row' });
    node('span', { textContent: label }, r);
    const input = node(
      'input',
      { type: 'number', value: value === undefined ? '' : String(value) },
      r,
    );
    input.step = String(opts.step ?? 0.01);
    if (opts.min !== undefined) input.min = String(opts.min);
    if (opts.placeholder) input.placeholder = opts.placeholder;
    input.addEventListener('change', () =>
      host.change(() => set(input.value === '' ? undefined : Number(input.value))),
    );
  };
  const segment = <T>(
    label: string,
    options: { value: T; text: string; title?: string }[],
    current: T,
    set: (v: T) => void,
  ) => {
    const seg = node('div', { className: 'ib-seg small' }, div(label));
    for (const o of options) {
      const b = node('button', { textContent: o.text, title: o.title ?? '' }, seg);
      b.setAttribute('aria-pressed', String(o.value === current));
      b.addEventListener('click', () => host.change(() => set(o.value)));
    }
  };
  /** The ground materials of palette.json (decision 0168); the style may show another. */
  const groundPicker = (current: string, set: (m: string) => void) => {
    const r = div('Ground');
    const s = node('select', {}, r);
    for (const id of GROUND_IDS) {
      const shown = groundId(id, design.style);
      const text =
        shown === id
          ? GROUNDS[id]!.name
          : `${GROUNDS[id]!.name} (${GROUNDS[shown]?.name ?? shown} here)`;
      node('option', { value: id, textContent: text, selected: id === current }, s);
    }
    s.addEventListener('change', () => host.change(() => set(s.value)));
  };
  const levels = (e: { from?: number; to?: number }) => {
    const from = (e.from ?? 1) as Level;
    segment(
      'Appears from',
      LEVELS.map((l) => ({
        value: l,
        text: String(l),
        title: LEVEL_NAMES[l - 1],
      })),
      from,
      (l) => {
        if (l > 1) e.from = l;
        else delete e.from;
        if (e.to !== undefined && e.to < l) delete e.to;
      },
    );
    segment(
      'Gone after',
      [
        { value: 4 as number, text: '–', title: 'Stays to the end' },
        ...[1, 2, 3].filter((l) => l >= from).map((l) => ({ value: l, text: String(l) })),
      ],
      e.to ?? 4,
      (l) => {
        if (l === 4) delete e.to;
        else e.to = l;
      },
    );
  };
  /** `after:<quest>` and `before:<quest>` tags (decision 0130), comma separated. */
  const tagsField = (e: { tags?: string[] }) => {
    const r = node('label', { className: 'ed-row' });
    node('span', { textContent: 'Tags' }, r);
    const input = node(
      'input',
      { value: (e.tags ?? []).join(', '), placeholder: 'after:quest, before:quest' },
      r,
    );
    input.addEventListener('change', () =>
      host.change(() => {
        const list = input.value
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        if (list.length) e.tags = list;
        else delete e.tags;
      }),
    );
  };
  const buttons = () => node('div', { className: 'ed-buttons' });
  const button = (parent: HTMLElement, label: string, action: () => void, cls = '') =>
    node('button', { textContent: label, className: cls }, parent).addEventListener(
      'click',
      action,
    );
  const heading = (title: string, sub: string) => {
    const h = node('h2', { textContent: title });
    node('small', { textContent: sub }, h);
  };

  const sel = host.shape;
  if (!sel) {
    if (host.mode === 'lanes') {
      heading(
        'Lanes',
        `${design.lanes.length} lanes, paths and stairs · ${design.rivers?.length ?? 0} rivers`,
      );
      note(
        'Pick Lane, Path or Stairs, then click the island to add bends; click the last point ' +
          'again (or press Enter) to finish. Lanes show near the homes that stand at each level ' +
          'and follow the ground: they climb slopes, and need stairs only at a cliff. Click a ' +
          'lane to edit its points. River and Lava river draw from the source down to the mouth.',
      );
      return;
    }
    woodsPanel(design.woods);
    return;
  }

  const { shape } = sel;
  const pts = pointsOf(design, shape);
  heading(shapeName(design, shape), pts ? `${pts.length} points` : '');
  if (shape.kind === 'coast') {
    note(
      'The coast is the collision shore, the chart and the water line. Drag a square to move a ' +
        'point, the small ring on an edge to add one; Delete removes the selected point. The low ' +
        'ground inside the beach follows it.',
    );
    if (shape.index > 0) button(buttons(), '🗑 Delete islet', () => host.remove(), 'danger');
    return;
  }
  if (shape.kind === 'lake') {
    note('Inland water, a hole through the island. Homes and props keep out of it.');
    button(buttons(), '🗑 Delete lake', () => host.remove(), 'danger');
    return;
  }
  if (shape.kind === 'lane') {
    const lane = design.lanes[shape.index]!;
    segment(
      'Kind',
      [
        { value: 'lane' as const, text: 'Lane', title: 'Shows near standing homes' },
        { value: 'path' as const, text: 'Path', title: 'Always shown' },
        { value: 'stairs' as const, text: 'Stairs', title: 'Climbs a cliff' },
      ],
      lane.kind ?? 'lane',
      (k) => setLaneKind(design, shape.index, k, host.heightAt),
    );
    if (lane.kind === 'path')
      number('Height', lane.y, (v) => (v === undefined ? delete lane.y : (lane.y = v)), {
        placeholder: 'follows the ground',
      });
    if (lane.kind !== 'stairs')
      number('Width', lane.width, (v) => (v === undefined ? delete lane.width : (lane.width = v)), {
        step: 0.005,
        min: 0.01,
        placeholder: String(LANE_WIDTH),
      });
    if (lane.kind === 'stairs') {
      number('Stands on', lane.base, (v) => (lane.base = v ?? 0));
      note('Each point keeps the height of the ground where you put it; a landing at each bend.');
    } else
      note(
        lane.kind === 'path'
          ? 'Always shown, along the ground.'
          : 'Its pieces show near homes standing at the level, along the ground, up slopes.',
      );
    button(buttons(), '🗑 Delete', () => host.remove(), 'danger');
    return;
  }
  if (shape.kind === 'river') {
    const r = design.rivers![shape.index]!;
    segment(
      'Kind',
      [
        { value: 'water' as const, text: 'Water', title: 'A stream, white where it falls' },
        { value: 'lava' as const, text: 'Lava', title: 'Glows at night, steams in the sea' },
      ],
      r.kind ?? 'water',
      (k) => setRiverKind(design, shape.index, k),
    );
    number('Width', r.width, (v) => (r.width = v ?? RIVER_WIDTH), { step: 0.005, min: 0.01 });
    const point = sel.point;
    if (point !== undefined && r.points[point])
      number(
        `Point ${point + 1} width`,
        r.points[point]![2],
        (v) => setRiverPointWidth(design, shape.index, point, v),
        { step: 0.005, min: 0.005, placeholder: `${r.width} (the river's)` },
      );
    levels(r);
    tagsField(r);
    note(
      'Runs from its first point (the source) to its last (the mouth), lying on the ground: ' +
        'down slopes and mountains, falling as a sheet at a cliff. A mouth past the coast falls ' +
        'into the sea, with foam for water and steam for lava. Lava glows at night like windows. ' +
        'Click a point to give it its own width: the river widens and narrows smoothly.',
    );
    button(buttons(), '🗑 Delete', () => host.remove(), 'danger');
    return;
  }
  if (shape.kind === 'ramp') {
    const r = design.ramps![shape.index]!;
    number('Start height', r.start, (v) => (r.start = v ?? r.start), { step: 0.01, min: 0 });
    number('End height', r.end, (v) => (r.end = v ?? r.end), { step: 0.01, min: 0 });
    number('Width', r.width, (v) => (r.width = v ?? RAMP_WIDTH), { step: 0.01, min: 0.03 });
    groundPicker(r.material, (m) => (r.material = m));
    levels(r);
    note(
      'Climbs evenly from its first point (start height) to its last (end height), over any ' +
        'cliff it crosses. Drag a square to move a point, a ring to add a bend. Lanes and paths ' +
        'climb it; buildings need flat ground.',
    );
    button(buttons(), '🗑 Delete', () => host.remove(), 'danger');
    return;
  }

  const gi = shape.index;
  const g = design.ground[gi]!;
  number('Height', g.height, (v) => (g.height = v ?? g.height), { step: 0.02, min: 0.02 });
  groundPicker(g.material, (m) => (g.material = m));
  // The new look (issue #269): how much it rounds this shape; 0 keeps a landmark faceted.
  number('Smooth', g.smooth, (v) => setSmooth(g, v), {
    step: 0.1,
    min: 0,
    placeholder: '1 (rolling; 0 stays faceted)',
  });
  if (g.shape === 'peak') {
    number('Base', g.base, (v) => (v === undefined ? delete g.base : (g.base = v)), {
      placeholder: '0',
    });
    number(
      'Crater',
      g.crater,
      (v) => (v ? (g.crater = Math.min(0.8, Math.max(0.05, v))) : delete g.crater),
      { step: 0.05, min: 0, placeholder: 'none (a pointed peak)' },
    );
    note(
      'A peak: a cone over this outline, from its base up to its height, in its ground. A crater ' +
        'cuts its top open (a share of its size); a ground that glows fills it with lava.',
    );
  } else if (g.outline) {
    edges(g);
  } else {
    number('Beach width', g.beach, (v) => (v === undefined ? delete g.beach : (g.beach = v)), {
      step: 0.005,
      min: 0.01,
      placeholder: String(BEACH),
    });
    note(`Follows coast ${g.coast ?? 0} inside the beach: edit the coast to reshape it.`);
  }
  levels(g);
  if (g.outline) button(buttons(), '🗑 Delete', () => host.remove(), 'danger');

  function edges(g: GroundDef) {
    const n = g.outline!.length;
    const sloped = Array.from({ length: n }, (_, i) => isSloped(g, i)).filter(Boolean).length;
    segment(
      'Edges',
      [
        { value: 'cliff', text: 'Cliff', title: 'Every edge a cliff' },
        { value: 'slope', text: 'Slope', title: 'Every edge a ramp' },
        ...(sloped && sloped < n ? [{ value: 'mixed', text: `${sloped} of ${n}` }] : []),
      ],
      !sloped ? 'cliff' : sloped === n ? 'slope' : 'mixed',
      (v) => {
        if (v !== 'mixed') setEdges(design, gi, v === 'cliff' ? null : (g.slope ?? SLOPE_WIDTH));
      },
    );
    if (g.slope)
      number('Slope width', g.slope, (v) => (g.slope = v ?? SLOPE_WIDTH), {
        step: 0.01,
        min: 0.03,
      });
    note(
      'Click an edge on the island to switch it between cliff and slope. Trees, lamp posts and ' +
        'crates may stand on a slope; buildings need flat ground. Lanes climb slopes; a cliff ' +
        'needs stairs.',
    );
  }

  function woodsPanel(w: WoodsDef) {
    heading('Ground and woods', '');
    note(
      'Click the coast, raised ground, a mountain or the lake to edit it, or add one with the ' +
        'buttons. Woods: paint where trees may grow, or clear them; homes, lanes, props and ' +
        'fields clear trees as the town grows.',
    );
    const tree = div('Trees');
    const select = node('select', {}, tree);
    for (const id of Object.keys(WOODLAND_TREES)) {
      const o = node('option', { value: id, textContent: propName(id) }, select);
      o.selected = id === w.tree;
    }
    select.addEventListener('change', () => host.change(() => (w.tree = select.value)));
    number('Tries', w.tries, (v) => (w.tries = Math.max(0, Math.round(v ?? w.tries))), {
      step: 100,
      min: 0,
    });
    number('Spacing', w.spacing, (v) => (w.spacing = v ?? w.spacing), { step: 0.01, min: 0.03 });
    number('Tree size', w.size, (v) => (w.size = v ?? w.size), { step: 0.1, min: 0.3 });
    const brush = node('label', { className: 'ed-row' });
    node('span', { textContent: 'Brush' }, brush);
    // The range first, then the value, or the default 0 to 100 in steps of 1 rounds it.
    const range = node('input', { type: 'range', min: '0.04', max: '0.4', step: '0.01' }, brush);
    range.value = String(host.brush);
    range.addEventListener('input', () => host.setBrush(Number(range.value)));
    div('Painted').append(
      `${w.areas?.length ?? 0} woods · ${w.clear?.length ?? 0} clearings` +
        (w.areas?.length ? '' : ' (trees anywhere)'),
    );
    if (w.areas?.length)
      button(buttons(), 'Remove painted woods', () =>
        host.change(() => clearWoodsPainting(design)),
      );
  }
}
