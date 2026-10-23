import { atLevel, type IslandDesign } from '../../data/islands';
import { PROP_TYPES } from '../../render/models/props';
import { TRIANGLE_BUDGET, type IslandIssue } from '../../sim/islandChecks';
import {
  LEVEL_NAMES,
  LEVELS,
  TOP_LEVEL,
  type Level,
  homesPerLevel,
  propName,
  setLevels,
  setPropValue,
  turnProp,
} from './doc';

/**
 * The island builder's side panel (decision 0105): the selected prop (levels, position, turn,
 * size, colours, tags, duplicate and delete) or, with nothing selected, the island itself.
 * Every field edits the design through `change`, which records undo and rebuilds the island.
 */

export interface IslandPanelHost {
  design: IslandDesign;
  selection: number | null;
  level: Level;
  issues: IslandIssue[];
  /** Triangles at each level, once the checks have counted them. */
  triangles: number[];
  thumbs: Record<string, string>;
  change(edit: (design: IslandDesign) => void, rebuildPanel?: boolean): void;
  select(index: number | null): void;
  duplicate(): void;
  remove(): void;
  /** What the prop stands on, in words ("plateau 0.32", "the sand", "the sea"). */
  groundOf(index: number): string;
}

const isHome = (p: { type: string; tags?: string[] }) =>
  !!PROP_TYPES[p.type]?.home && !p.tags?.includes('outbuilding');

export function renderIslandPanel(root: HTMLElement, host: IslandPanelHost) {
  root.replaceChildren();
  const { design, selection } = host;
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
  const number = (
    label: string,
    value: number | undefined,
    set: (v: number | undefined) => void,
    opts: { step?: number; min?: number; max?: number; placeholder?: string } = {},
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
    if (opts.max !== undefined) input.max = String(opts.max);
    if (opts.placeholder) input.placeholder = opts.placeholder;
    input.addEventListener('change', () =>
      host.change(() => set(input.value === '' ? undefined : Number(input.value))),
    );
    return input;
  };
  /** A row of toggle buttons, one pressed. */
  const segment = <T>(
    label: string,
    options: { value: T; text: string; title?: string }[],
    current: T,
    set: (v: T) => void,
  ) => {
    const r = div(label);
    const seg = node('div', { className: 'ib-seg small' }, r);
    for (const o of options) {
      const b = node('button', { textContent: o.text, title: o.title ?? '' }, seg);
      b.setAttribute('aria-pressed', String(o.value === current));
      b.addEventListener('click', () => host.change(() => set(o.value)));
    }
  };

  const p = selection !== null ? design.props[selection] : undefined;
  if (!p || selection === null) {
    // The island itself.
    const h = node('h2', { textContent: design.name });
    node('small', { textContent: `${design.id}.json · ${design.style}` }, h);
    const homes = homesPerLevel(design, isHome);
    div('Props').append(
      `${design.props.filter((q) => atLevel(q, host.level)).length} at level ${host.level} · ${design.props.length} in the file`,
    );
    div('Homes').append(`${homes.join(' · ')} at levels 1 to ${TOP_LEVEL}`);
    if (host.triangles.length)
      div('Triangles').append(
        `${host.triangles[host.level - 1]!.toLocaleString('en')} here · ${host.triangles[TOP_LEVEL - 1]!.toLocaleString('en')} of ${TRIANGLE_BUDGET.toLocaleString('en')} at level ${TOP_LEVEL}`,
      );
    node('p', {
      className: 'ed-note',
      textContent:
        'Drag a prop from the palette onto the island. Click a prop to select it, drag to move it, ' +
        'turn it with its handle or R / Shift+R. A prop belongs to the level it first appears; ' +
        'with Show later levels, what later levels add is dashed.',
    });
    return;
  }

  const type = PROP_TYPES[p.type];
  const head = node('div', { className: 'ib-head' });
  if (host.thumbs[p.type]) node('img', { src: host.thumbs[p.type]!, alt: '' }, head);
  const title = node('div', {}, head);
  node('h2', { textContent: propName(p.type) }, title);
  node(
    'small',
    {
      textContent: `${type?.group ?? 'unknown'} · ${host.groundOf(selection)}`,
    },
    title,
  );

  const from = (p.from ?? 1) as Level;
  segment(
    'Appears from',
    LEVELS.map((l) => ({ value: l, text: String(l), title: LEVEL_NAMES[l - 1] })),
    from,
    (l) => setLevels(design, selection, l, p.to as Level | undefined),
  );
  segment(
    'Gone after',
    [
      { value: TOP_LEVEL, text: '–', title: 'Stays to the end' },
      ...LEVELS.filter((l) => l < TOP_LEVEL && l >= from).map((l) => ({
        value: l,
        text: String(l),
        title: LEVEL_NAMES[l - 1],
      })),
    ],
    (p.to ?? TOP_LEVEL) as Level,
    (l) => setLevels(design, selection, from, l),
  );
  const at = div('Position');
  const pair = node('div', { className: 'ed-pair' }, at);
  for (const key of ['x', 'z'] as const) {
    const input = node('input', { type: 'number', value: String(p[key]), title: key }, pair);
    input.step = '0.01';
    input.addEventListener('change', () =>
      host.change((d) => {
        const q = d.props[selection]!;
        q[key] = Number(Number(input.value).toFixed(6));
      }),
    );
  }
  const turn = div('Turn');
  const turns = node('div', { className: 'ed-pair' }, turn);
  const left = node('button', { textContent: '⟲ 15°', title: 'Shift+R' }, turns);
  const deg = node('input', { type: 'number', value: String(p.turn ?? 0) }, turns);
  const right = node('button', { textContent: '⟳ 15°', title: 'R' }, turns);
  left.addEventListener('click', () =>
    host.change((d) => turnProp(d, selection, (p.turn ?? 0) - 15)),
  );
  right.addEventListener('click', () =>
    host.change((d) => turnProp(d, selection, (p.turn ?? 0) + 15)),
  );
  deg.addEventListener('change', () =>
    host.change((d) => turnProp(d, selection, Number(deg.value))),
  );
  number('Size', p.size ?? 1, (v) => setPropValue(design, selection, 'size', v ?? 1), {
    step: 0.05,
    min: 0.2,
  });
  number('Variant', p.variant, (v) => setPropValue(design, selection, 'variant', v), {
    step: 1,
    min: 0,
    placeholder: 'colours or count',
  });
  number('Shape', p.shape, (v) => setPropValue(design, selection, 'shape', v), {
    step: 0.05,
    min: 0,
    max: 1,
    placeholder: '0 to 1',
  });
  if (p.type === 'paving' || p.type === 'rail')
    number('Length', p.length, (v) => setPropValue(design, selection, 'length', v), {
      placeholder: 'radius units',
    });
  number('Height', p.y, (v) => setPropValue(design, selection, 'y', v), {
    placeholder: 'automatic',
  });
  const tags = node('label', { className: 'ed-row' });
  node('span', { textContent: 'Tags' }, tags);
  const tagInput = node(
    'input',
    {
      value: (p.tags ?? []).join(', '),
      placeholder: 'workshop, windmill, log-yard:shore…',
    },
    tags,
  );
  tagInput.addEventListener('change', () =>
    host.change((d) => {
      const list = tagInput.value
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (list.length) d.props[selection]!.tags = list;
      else delete d.props[selection]!.tags;
    }),
  );
  if (isHome(p)) {
    const order = design.props.slice(0, selection + 1).filter(isHome).length;
    node('p', {
      className: 'ed-note',
      textContent: `Residence ${order} (homes count in file order).`,
    });
  }
  const mine = host.issues.filter((i) => i.prop === selection);
  if (mine.length) {
    const list = node('ul', { className: 'ed-checks' });
    for (const issue of mine)
      node(
        'li',
        {
          className: issue.severity,
          textContent: `${issue.severity === 'error' ? '✗' : '⚠'} ${issue.message}${issue.level ? ` (level ${issue.level})` : ''}`,
        },
        list,
      );
  }
  const buttons = node('div', { className: 'ed-buttons' });
  node('button', { textContent: '⧉ Duplicate', title: 'Ctrl+D' }, buttons).addEventListener(
    'click',
    () => host.duplicate(),
  );
  node(
    'button',
    { textContent: '🗑 Delete', title: 'Delete', className: 'danger' },
    buttons,
  ).addEventListener('click', () => host.remove());
}
