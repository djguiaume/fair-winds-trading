import { GOODS, GOOD_DEFS, GOOD_ICONS, type GoodId, isGood } from '../sim/goods';
import type { LandmarkKind, MapDef, PortDef } from '../sim/map';
import { SHIP_CLASSES } from '../sim/ship';
import {
  type Selection,
  addPort,
  findIsland,
  findShape,
  moveIsland,
  portOn,
  removePort,
  renameIsland,
} from './model';

/**
 * The side panel (decision 0095): the selected island, port, shape, waypoint or start, or the
 * map itself when nothing is selected. Every field edits the map through `change`, which records
 * undo, redraws the chart and reruns the checks.
 */

export interface PanelHost {
  map: MapDef;
  selection: Selection;
  /** Applies one edit (with undo) and redraws everything except this panel. */
  change(edit: (map: MapDef) => void, rebuildPanel?: boolean): void;
  select(selection: Selection): void;
  remove(): void;
  /** Opens the island builder on an island with an island file (decision 0105). */
  editIsland(id: string): void;
}

const LANDMARKS: (LandmarkKind | '')[] = ['', 'lighthouse', 'ruins', 'wreck', 'beacon'];
const LEVELS = ['2', '3', '4'] as const;

export function renderPanel(root: HTMLElement, host: PanelHost) {
  root.replaceChildren();
  const { map, selection } = host;
  const node = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Record<string, string | boolean> = {},
    parent: HTMLElement = root,
  ): HTMLElementTagNameMap[K] => {
    const el = Object.assign(document.createElement(tag), props);
    parent.append(el);
    return el;
  };
  const heading = (title: string, sub = '') => {
    const h = node('h2', { textContent: title });
    if (sub) node('small', { textContent: sub }, h);
  };
  const row = (label: string) => {
    const r = node('label', { className: 'ed-row' });
    node('span', { textContent: label }, r);
    return r;
  };
  const div = (label: string) => {
    const r = node('div', { className: 'ed-row' });
    node('span', { textContent: label }, r);
    return r;
  };
  const text = (label: string, value: string, set: (v: string) => void) => {
    const input = node('input', { value }, row(label));
    input.addEventListener('change', () => host.change(() => set(input.value.trim())));
  };
  const number = (
    label: string,
    value: number | undefined,
    set: (v: number | undefined) => void,
    opts: { min?: number; max?: number; step?: number; optional?: boolean } = {},
  ) => {
    const input = node(
      'input',
      { type: 'number', value: value === undefined ? '' : String(value) },
      row(label),
    );
    if (opts.min !== undefined) input.min = String(opts.min);
    if (opts.max !== undefined) input.max = String(opts.max);
    input.step = String(opts.step ?? 1);
    if (opts.optional) input.placeholder = 'none';
    input.addEventListener('change', () => {
      if (input.value === '' && opts.optional) return host.change(() => set(undefined));
      const v = Number(input.value);
      if (Number.isFinite(v)) host.change(() => set(v));
    });
  };
  const xy = (label: string, x: number, y: number, set: (x: number, y: number) => void) => {
    const pair = node('div', { className: 'ed-pair' }, div(label));
    const ix = node('input', { type: 'number', value: String(x), title: 'x (east)' }, pair);
    const iy = node('input', { type: 'number', value: String(y), title: 'y (north)' }, pair);
    for (const input of [ix, iy])
      input.addEventListener('change', () => {
        const [vx, vy] = [Number(ix.value), Number(iy.value)];
        if (Number.isFinite(vx) && Number.isFinite(vy)) host.change(() => set(vx, vy));
      });
  };
  const check = (label: string, value: boolean, set: (v: boolean) => void) => {
    const input = node('input', { type: 'checkbox', checked: value }, row(label));
    input.addEventListener('change', () => host.change(() => set(input.checked)));
  };
  const select = (
    label: string,
    value: string,
    options: [string, string][],
    set: (v: string) => void,
  ) => {
    const input = node('select', {}, row(label));
    for (const [v, t] of options)
      node('option', { value: v, textContent: t, selected: v === value }, input);
    input.addEventListener('change', () => host.change(() => set(input.value)));
  };
  /** A list of ids as chips with ×, plus a "+ add" picker of what is not in it yet. */
  const chips = (
    label: string,
    items: string[],
    all: [string, string][],
    set: (items: string[]) => void,
  ) => {
    const box = node('div', { className: 'ed-chips' }, div(label));
    for (const id of items) {
      const chip = node(
        'span',
        {
          className: 'ed-chip',
          textContent: all.find(([v]) => v === id)?.[1] ?? `${id} ?`,
        },
        box,
      );
      const x = node('button', { textContent: '×', title: `Remove ${id}` }, chip);
      x.addEventListener('click', () =>
        host.change(() => set(items.filter((i) => i !== id)), true),
      );
    }
    const rest = all.filter(([v]) => !items.includes(v));
    if (rest.length) {
      const add = node('select', { title: `Add to ${label.toLowerCase()}` }, box);
      node('option', { value: '', textContent: '+ add' }, add);
      for (const [v, t] of rest) node('option', { value: v, textContent: t }, add);
      add.addEventListener('change', () => {
        if (add.value) host.change(() => set([...items, add.value]), true);
      });
    }
  };
  const buttons = () => node('div', { className: 'ed-buttons' });
  const button = (parent: HTMLElement, label: string, action: () => void) =>
    node('button', { textContent: label }, parent).addEventListener('click', action);

  const goods: [string, string][] = GOODS.map((g) => [g, `${GOOD_ICONS[g]} ${GOOD_DEFS[g].name}`]);
  const ships: [string, string][] = Object.keys(SHIP_CLASSES).map((id) => [id, id]);

  if (!selection) {
    heading(map.name, 'map');
    text('Name', map.name, (v) => (map.name = v || map.name));
    number('Seed', map.seed, (v) => (map.seed = v ?? map.seed));
    number('Sea radius', map.boundsRadius, (v) => (map.boundsRadius = v ?? map.boundsRadius), {
      min: 100,
      step: 10,
    });
    node('hr');
    heading('Base wind');
    number(
      'From (°)',
      map.wind.fromDeg,
      (v) => (map.wind.fromDeg = (((v ?? 0) % 360) + 360) % 360),
      {
        step: 5,
      },
    );
    number('Speed (kn)', map.wind.speedKn, (v) => (map.wind.speedKn = v ?? map.wind.speedKn), {
      min: 1,
    });
    number('Gusts', map.wind.gustiness, (v) => (map.wind.gustiness = v ?? 0), {
      min: 0,
      max: 1,
      step: 0.05,
    });
    number('Shift (°)', map.wind.shiftDeg, (v) => (map.wind.shiftDeg = v ?? 0), { min: 0 });
    node('hr');
    select(
      'Home port',
      map.homePort ?? '',
      [['', 'nearest the start'], ...map.ports.map((p): [string, string] => [p.id, p.name])],
      (v) => {
        if (v) map.homePort = v;
        else delete map.homePort;
      },
    );
    node('p', {
      className: 'ed-note',
      textContent:
        'Select an island, port, reef or waypoint on the chart to edit it. Drag to move; the ' +
        'tools on the left add new ones.',
    });
    return;
  }

  if (selection.kind === 'island') {
    const island = findIsland(map, selection.id);
    if (!island) return;
    const port = portOn(map, island.id);
    heading(island.name ?? island.id, port ? 'island + port' : 'island');
    if (island.look?.design) {
      const b = buttons();
      button(b, `✎ Edit island · ${island.look.design}.json`, () => host.editIsland(island.id));
      b.title = 'Open the island builder (or double-click the island)';
    }
    text('Name', island.name ?? '', (v) => renameIsland(map, island.id, v));
    xy('Position', island.x, island.y, (x, y) => moveIsland(map, island.id, x, y));
    number('Radius', island.radius, (v) => (island.radius = Math.max(3, v ?? island.radius)), {
      min: 3,
    });
    const look = () => (island.look ??= {});
    number('Houses', island.look?.houses, (v) => (look().houses = v), { min: 0, optional: true });
    number('Trees', island.look?.trees, (v) => (look().trees = v), { min: 0, optional: true });
    number('Cliff tiers', island.look?.layers, (v) => (look().layers = v), {
      min: 1,
      max: 4,
      optional: true,
    });
    select(
      'Landmark',
      island.look?.landmark ?? '',
      LANDMARKS.map((l): [string, string] => [l, l || 'none']),
      (v) => {
        if (v) look().landmark = v as LandmarkKind;
        else delete look().landmark;
      },
    );
    check('Rock', !!island.look?.rock, (v) => (look().rock = v || undefined));
    check('Dock', !!island.look?.dock, (v) => (look().dock = v || undefined));
    if (port) portFields(port);
    const b = buttons();
    if (!port)
      button(b, '⚓ Make it a port', () => host.change(() => addPort(map, island.id), true));
    else button(b, 'Remove port', () => host.change(() => removePort(map, island.id), true));
    button(b, 'Delete island', () => host.remove());
    return;
  }

  function portFields(port: PortDef) {
    node('hr');
    heading('Port', port.id);
    text('Port name', port.name, (v) => (port.name = v || port.name));
    select(
      'Start level',
      String(port.level ?? 2),
      [
        ['1', '1 · hamlet'],
        ['2', '2 · village'],
        ['3', '3 · town'],
        ['4', '4 · port town'],
      ],
      (v) => (port.level = Number(v)),
    );
    const goodList = (items: string[] | undefined) => (items ?? []).filter(isGood);
    chips('Makes', port.produces, goods, (v) => (port.produces = v as GoodId[]));
    chips('Wants', port.wants, goods, (v) => (port.wants = v as GoodId[]));
    for (const level of LEVELS) {
      chips(`Makes at L${level}`, goodList(port.levelProduces?.[level]), goods, (v) => {
        port.levelProduces = { ...port.levelProduces, [level]: v as GoodId[] };
        if (!v.length) delete port.levelProduces[level];
        if (!Object.keys(port.levelProduces).length) delete port.levelProduces;
      });
      chips(`Wants at L${level}`, goodList(port.levelWants?.[level]), goods, (v) => {
        port.levelWants = { ...port.levelWants, [level]: v as GoodId[] };
        if (!v.length) delete port.levelWants[level];
        if (!Object.keys(port.levelWants).length) delete port.levelWants;
      });
    }
    chips('Wants made', port.wantsMade ?? [], goods, (v) => {
      if (v.length) port.wantsMade = v as GoodId[];
      else delete port.wantsMade;
    });
    chips('Builds ships', port.builds ?? [], ships, (v) => {
      if (v.length) port.builds = v;
      else delete port.builds;
    });
    check('Hidden', !!port.hidden, (v) => {
      if (v) port.hidden = true;
      else delete port.hidden;
    });
    check('Home port', map.homePort === port.id, (v) => {
      if (v) map.homePort = port.id;
      else if (map.homePort === port.id) delete map.homePort;
    });
  }

  if (selection.kind === 'shape') {
    const shape = findShape(map, selection.id);
    if (!shape) return;
    const kinds: Record<string, string> = {
      island: 'barrier island',
      reef: 'reef',
      sandbank: 'sandbank',
    };
    heading(shape.name ?? shape.id, kinds[shape.kind]);
    text('Name', shape.name ?? '', (v) => {
      if (v) shape.name = v;
      else delete shape.name;
    });
    select('Kind', shape.kind, Object.entries(kinds), (v) => (shape.kind = v as typeof shape.kind));
    const look = () => (shape.look ??= {});
    number('Trees', shape.look?.trees, (v) => (look().trees = v), { min: 0, optional: true });
    select(
      'Landmark',
      shape.look?.landmark ?? '',
      LANDMARKS.map((l): [string, string] => [l, l || 'none']),
      (v) => {
        if (v) look().landmark = v as LandmarkKind;
        else delete look().landmark;
      },
    );
    const point = selection.point !== undefined ? shape.outline[selection.point] : undefined;
    node('hr');
    if (point) {
      heading(`Point ${selection.point! + 1}`, `of ${shape.outline.length}`);
      xy('Position', point[0], point[1], (x, y) => {
        shape.outline[selection.point!] = [x, y];
      });
    } else
      node('p', {
        className: 'ed-note',
        textContent: `${shape.outline.length} points. Drag a dot to reshape, drag a small ring on an edge to add a point, drag inside to move the whole shape.`,
      });
    const b = buttons();
    if (point && shape.outline.length > 3) button(b, 'Delete point', () => host.remove());
    button(b, 'Delete shape', () => {
      host.select({ kind: 'shape', id: shape.id });
      host.remove();
    });
    return;
  }

  if (selection.kind === 'waypoint') {
    const wp = map.course[selection.index];
    if (!wp) return;
    heading(wp.label || 'Waypoint', 'harbour waypoint');
    text('Label', wp.label, (v) => (wp.label = v));
    xy('Position', wp.x, wp.y, (x, y) => ([wp.x, wp.y] = [x, y]));
    node('p', {
      className: 'ed-note',
      textContent:
        'The port island with this exact name turns its harbour and pier to face this point.',
    });
    button(buttons(), 'Delete waypoint', () => host.remove());
    return;
  }

  if (selection.kind === 'start') {
    heading('Start', 'where a new voyage begins');
    xy('Position', map.start.x, map.start.y, (x, y) => ([map.start.x, map.start.y] = [x, y]));
    number('Heading (°)', map.start.headingDeg, (v) => (map.start.headingDeg = v ?? 0), {
      step: 5,
    });
  }
}
