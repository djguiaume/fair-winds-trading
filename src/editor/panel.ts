import { STYLES } from '../data/grounds';
import { GOODS, GOOD_DEFS, GOOD_ICONS, type GoodId, isGood } from '../sim/goods';
import { type LandmarkKind, type MapDef, type PortDef, SEA_MARK_TYPES } from '../sim/map';
import { SHIP_CLASSES } from '../sim/ship';
import { QUESTS } from '../sim/quests';
import { DEFAULT_START_LEVEL, SETTLEMENT_LEVELS, TOWN_LEVELS } from '../sim/settlement';
import { TUNING } from '../data/tuning';
import { zoneKindName } from './flowChart';
import {
  type Selection,
  addPort,
  findArea,
  findCurrent,
  findIsland,
  findShape,
  findZone,
  reverseCurrent,
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
  /** Opens the island builder on an island, making its file first if needed (0105, 0110). */
  editIsland(id: string): void;
  /** The sea editor's controls (decision 0161); left out when editing the ring alone. */
  seas?: SeaPanel;
}

/** What the panel needs from the sea editor (decision 0161). */
export interface SeaPanel {
  /** Every file's owner id and name, the ring first. */
  seas: [string, string][];
  /** The sea new things go into. */
  active: string;
  /** The file the selection belongs to. */
  owner?: string;
  radius: number;
  ringRadius: number;
  setActive(id: string): void;
  moveTo(id: string): void;
  rename(id: string, name: string): void;
  /** Each sea's slice of the outer ring, compass degrees `[from, to]` (decision 0178). */
  sectors: Record<string, [number, number]>;
  setSector(id: string, sector: [number, number] | null): void;
  add(): void;
}

const MARK_NAMES: Record<string, string> = {
  'buoy-red': 'red buoy (port)',
  'buoy-green': 'green buoy (starboard)',
  'cardinal-north': 'north cardinal',
  'cardinal-east': 'east cardinal',
  'cardinal-south': 'south cardinal',
  'cardinal-west': 'west cardinal',
  'fishing-boat': 'fishing boat',
  'pilot-cutter': 'pilot cutter',
  light: 'light',
};

const LANDMARKS: (LandmarkKind | '')[] = ['', 'lighthouse', 'ruins', 'wreck', 'beacon'];
/** Levels a town can grow into (all but the first), from `town-levels.json` (decision 0113). */
const LEVELS = SETTLEMENT_LEVELS.slice(1).map(String);

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
  /**
   * When it stands (decisions 0130, 0166): always, once a quest is done (`after:`), or until one
   * is (`before:`); land also only while a quest runs (`during:`) or all but then (`except:`).
   * Islands and shapes rise or clear out of the boat's sight; marks just show.
   */
  const stands = (target: { tags?: string[] }, land = true) => {
    const tag = target.tags?.find((t) => /^(after|before|during|except):/.test(t));
    const when = tag ? tag.slice(0, tag.indexOf(':')) : '';
    const quest = tag ? tag.slice(tag.indexOf(':') + 1) : '';
    const setTag = (w: string, q: string) => {
      const others = (target.tags ?? []).filter((t) => t !== tag);
      const tags = w && q ? [...others, `${w}:${q}`] : others;
      if (tags.length) target.tags = tags;
      else delete target.tags;
    };
    const ids = QUESTS.map((q) => q.id);
    const pick = node('select', {}, row('Stands'));
    for (const [v, t] of [
      ['', 'always'],
      ['after', 'once a quest is done'],
      ['before', 'until a quest is done'],
      ...(land || when === 'during' || when === 'except'
        ? ([
            ['during', 'only while a quest runs'],
            ['except', 'except while a quest runs'],
          ] as const)
        : []),
    ] as const)
      node('option', { value: v, textContent: t, selected: v === when }, pick);
    pick.addEventListener('change', () =>
      host.change(() => setTag(pick.value, quest || ids[0]!), true),
    );
    if (!tag) return;
    select(
      'Quest',
      quest,
      [...(ids.includes(quest) ? [] : [quest]), ...ids].map((id): [string, string] => [
        id,
        ids.includes(id) ? id : `${id} ?`,
      ]),
      (v) => setTag(when, v),
    );
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

  const seas = host.seas;
  const fileOf = (owner: string) => (owner === 'ring' ? 'phase1-map.json' : `seas/${owner}.json`);
  /** Which sea file the selection is written to, and a picker to move it to another. */
  const seaRow = () => {
    if (!seas?.owner) return;
    const input = node('select', { title: 'The file this is saved in' }, row('Sea file'));
    for (const [id, name] of seas.seas)
      node(
        'option',
        { value: id, textContent: name, title: fileOf(id), selected: id === seas.owner },
        input,
      );
    input.addEventListener('change', () => seas.moveTo(input.value));
    node('span', {
      className: 'ed-sea-tag',
      textContent: `saved in src/data/${fileOf(seas.owner)}`,
    });
  };

  if (!selection && seas) {
    heading('Phase 4 sea', 'the ring + every sea file');
    number('Sea radius', map.boundsRadius, (v) => (map.boundsRadius = v ?? map.boundsRadius), {
      min: seas.ringRadius,
      step: 5,
    });
    const fog = map.fog;
    if (fog)
      number(
        'Charted radius',
        fog.chartedRadius,
        (v) => (fog.chartedRadius = v ?? fog.chartedRadius),
        { min: 0, step: 5 },
      );
    node('p', {
      className: 'ed-note',
      textContent: `In seas/grown.json. The dashed circle is the Windward Ring's own edge (${seas.ringRadius}); inside the charted radius the chart starts charted, outside it is fog until an area is sailed into (decision 0156).`,
    });
    const active = node('select', {}, row('New things go into'));
    for (const [id, name] of seas.seas)
      node(
        'option',
        { value: id, textContent: name, title: fileOf(id), selected: id === seas.active },
        active,
      );
    active.addEventListener('change', () => seas.setActive(active.value));
    node('hr');
    heading('Sea files', 'in the order they open');
    for (const [id, name] of seas.seas.slice(1)) {
      const input = node('input', { value: name }, row(`seas/${id}.json`));
      input.addEventListener('change', () => seas.rename(id, input.value.trim()));
      // Its quarter of the outer ring (0178): "from, to" in compass degrees, empty for none.
      const sector = seas.sectors[id];
      const range = node(
        'input',
        { value: sector ? `${sector[0]}, ${sector[1]}` : '', placeholder: 'from°, to°' },
        row('its sector'),
      );
      range.addEventListener('change', () => {
        const parts = range.value.split(/[,–-]/).map((v) => Number(v.trim()));
        if (!range.value.trim()) seas.setSector(id, null);
        else if (parts.length === 2 && parts.every(Number.isFinite))
          seas.setSector(id, [parts[0]!, parts[1]!]);
      });
    }
    button(buttons(), '＋ New sea', () => seas.add());
    node('p', {
      className: 'ed-note',
      textContent:
        'A new sea is a new file in src/data/seas/ and one line in grown.json: no code. Pick it above, then add its islands, reefs, marks, currents and zones. Its sector (compass degrees from the middle, 0 = north) is the slice of the outer ring it owns: the checks flag anything placed outside it (decision 0178).',
    });
    node('hr');
    heading('Windward Ring', 'phase1-map.json');
  }
  if (!selection) {
    if (!seas) {
      heading(map.name, 'map');
      text('Name', map.name, (v) => (map.name = v || map.name));
    }
    number('Seed', map.seed, (v) => (map.seed = v ?? map.seed));
    if (!seas)
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
    seaRow();
    const file = island.look?.design;
    const edit = buttons();
    button(edit, file ? `✎ Edit island · ${file}.json` : '✎ Edit island (makes its file)', () =>
      host.editIsland(island.id),
    );
    edit.title = 'Open the island builder (or double-click the island)';
    text('Name', island.name ?? '', (v) => renameIsland(map, island.id, v));
    xy('Position', island.x, island.y, (x, y) => moveIsland(map, island.id, x, y));
    number('Radius', island.radius, (v) => (island.radius = Math.max(3, v ?? island.radius)), {
      min: 3,
    });
    stands(island);
    const look = () => (island.look ??= {});
    if (file) {
      // Its own file draws it (decision 0110); the radius scales the whole file.
      node('p', {
        className: 'ed-note',
        textContent: `Its ground, town, trees and landmark are in islands/${file}.json: edit them in the island builder. Radius scales the whole island.`,
      });
      check('Dock', !!island.look?.dock, (v) => (look().dock = v || undefined));
      if (port) portFields(port);
      const b = buttons();
      if (!port)
        button(b, '⚓ Make it a port', () => host.change(() => addPort(map, island.id), true));
      else button(b, 'Remove port', () => host.change(() => removePort(map, island.id), true));
      button(b, 'Delete island', () => host.remove());
      return;
    }
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
      String(port.level ?? DEFAULT_START_LEVEL),
      TOWN_LEVELS.map((l, i) => [String(i + 1), `${i + 1} · ${l.name.toLowerCase()}`]),
      (v) => (port.level = Number(v)),
    );
    // Outposts stop growing at town (decision 0146).
    select(
      'Top level',
      String(port.maxLevel ?? TOWN_LEVELS.length),
      TOWN_LEVELS.map((l, i) => [String(i + 1), `${i + 1} · ${l.name.toLowerCase()}`]),
      (v) => {
        if (Number(v) < TOWN_LEVELS.length) port.maxLevel = Number(v);
        else delete port.maxLevel;
      },
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
      // Far goods the ring's port towns buy once a main port crafts them (decision 0146).
      chips(`Wants made at L${level}`, goodList(port.levelWantsMade?.[level]), goods, (v) => {
        port.levelWantsMade = { ...port.levelWantsMade, [level]: v as GoodId[] };
        if (!v.length) delete port.levelWantsMade[level];
        if (!Object.keys(port.levelWantsMade).length) delete port.levelWantsMade;
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
    // An empty island until a quest's `found` reward opens it (decision 0157).
    check('Founding site', !!port.site, (v) => {
      if (v) port.site = true;
      else delete port.site;
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
      shallows: 'shallows (deep ships go round)',
    };
    heading(shape.name ?? shape.id, kinds[shape.kind]);
    seaRow();
    if (shape.kind === 'island') {
      const b = buttons();
      button(b, '✎ Edit island (makes its file)', () => host.editIsland(shape.id));
      b.title = 'Turns the ridge into an island with its own file, then opens the island builder';
    }
    text('Name', shape.name ?? '', (v) => {
      if (v) shape.name = v;
      else delete shape.name;
    });
    select('Kind', shape.kind, Object.entries(kinds), (v) => (shape.kind = v as typeof shape.kind));
    // Sandy passages refuse ships deeper than this (decision 0152); the sloop draws 0.7.
    if (shape.kind === 'shallows')
      number('Max draft', shape.maxDraft, (v) => (shape.maxDraft = v), { min: 0, optional: true });
    const look = () => (shape.look ??= {});
    // A pumice bank is grey, not sand (decision 0171).
    if (shape.kind === 'sandbank')
      text('Colour', shape.look?.color ?? '', (v) => {
        if (/^#[0-9a-f]{6}$/i.test(v)) look().color = v;
        else delete look().color;
      });
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
    // A reef's rocks take a palette style's colours (the east's basalt skerries).
    if (shape.kind === 'reef')
      select(
        'Rock style',
        shape.look?.style ?? '',
        [['', 'warm rock and coral'], ...Object.keys(STYLES).map((k): [string, string] => [k, k])],
        (v) => {
          if (v) look().style = v;
          else delete look().style;
        },
      );
    stands(shape);
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

  if (selection.kind === 'current') {
    const c = findCurrent(map, selection.id);
    if (!c) return;
    const lane = !!c.path;
    heading(c.name ?? c.id, lane ? `current lane · ${c.id}` : `area current · ${c.id}`);
    seaRow();
    text('Name', c.name ?? '', (v) => {
      if (v) c.name = v;
      else delete c.name;
    });
    const [slow, fast] = TUNING.weather.currents.speedKn as [number, number];
    number('Speed (kn)', c.speedKn, (v) => (c.speedKn = v ?? c.speedKn), {
      min: slow,
      max: fast,
      step: 0.1,
    });
    if (!lane)
      number(
        'Flows toward (°)',
        c.towardDeg,
        (v) => (c.towardDeg = (((v ?? 0) % 360) + 360) % 360),
        { step: 5 },
      );
    const points = c.path ?? c.outline ?? [];
    const point = selection.point !== undefined ? points[selection.point] : undefined;
    node('hr');
    if (point) {
      heading(`Point ${selection.point! + 1}`, `of ${points.length}`);
      xy('Position', point[0], point[1], (x, y) => {
        point[0] = x;
        point[1] = y;
      });
      if (lane && c.path![selection.point!])
        number(
          'Width',
          c.path![selection.point!]![2],
          (v) => {
            c.path![selection.point!]![2] = Math.max(4, v ?? 50);
          },
          { min: 4, step: 5 },
        );
    } else
      node('p', {
        className: 'ed-note',
        textContent: lane
          ? `${points.length} points, in the direction the water flows. The game smooths them into the curve drawn. Drag a dot to move it, a square to change the width there, a small ring to add a point; drag the water to move the whole current. Speed is at the narrowest place; it eases off where the lane widens.`
          : `${points.length} points. Drag a dot to reshape, a small ring on an edge to add a point, the water to move it.`,
      });
    const b = buttons();
    button(b, '⇄ Reverse flow', () => host.change(() => reverseCurrent(map, c.id), true));
    if (point && points.length > (lane ? 2 : 3)) button(b, 'Delete point', () => host.remove());
    button(b, 'Delete current', () => {
      host.select({ kind: 'current', id: c.id });
      host.remove();
    });
    return;
  }

  if (selection.kind === 'zone') {
    const z = findZone(map, selection.id);
    if (!z) return;
    heading(z.name ?? z.id, `wind zone · ${z.id}`);
    seaRow();
    text('Name', z.name ?? '', (v) => {
      if (v) z.name = v;
      else delete z.name;
    });
    const kinds = TUNING.weather.zones.kinds as Record<string, Record<string, unknown>>;
    select(
      'Kind',
      z.kind,
      Object.keys(kinds).map((k): [string, string] => [k, zoneKindName(k)]),
      (v) => {
        z.kind = v;
        delete z.tune;
      },
    );
    number(
      'Wind from (°)',
      z.headingDeg,
      (v) => {
        if (v === undefined) delete z.headingDeg;
        else z.headingDeg = ((v % 360) + 360) % 360;
      },
      { step: 5, optional: true },
    );
    // Overrides of the kind's numbers for this zone only; empty = the kind's value.
    const base = kinds[z.kind] ?? {};
    const fields = Object.entries(base).filter(
      ([, v]) => typeof v === 'number' || Array.isArray(v),
    );
    if (fields.length) {
      node('hr');
      heading('This zone only', 'empty = the kind’s value');
      for (const [key, value] of fields) {
        const current = z.tune?.[key];
        const input = node(
          'input',
          {
            value: current === undefined ? '' : String(current).replace(',', ', '),
            placeholder: String(value).replace(',', ', '),
          },
          row(key),
        );
        input.addEventListener('change', () =>
          host.change(() => {
            const parts = input.value
              .split(',')
              .map((x) => Number(x.trim()))
              .filter((x) => input.value.trim() && Number.isFinite(x));
            const tune = { ...z.tune };
            if (!parts.length) delete tune[key];
            else
              tune[key] =
                Array.isArray(value) && parts.length === 2 ? [parts[0]!, parts[1]!] : parts[0]!;
            if (Object.keys(tune).length) z.tune = tune;
            else delete z.tune;
          }),
        );
      }
    }
    const point = selection.point !== undefined ? z.outline[selection.point] : undefined;
    node('hr');
    if (point) {
      heading(`Point ${selection.point! + 1}`, `of ${z.outline.length}`);
      xy('Position', point[0], point[1], (x, y) => {
        z.outline[selection.point!] = [x, y];
      });
    } else
      node('p', {
        className: 'ed-note',
        textContent: `${z.outline.length} points, smoothed into the soft area drawn. The wind changes over ${TUNING.weather.zones.fadeUnits} units inside its edge. Its kind's numbers are in weather.json.`,
      });
    const b = buttons();
    if (point && z.outline.length > 3) button(b, 'Delete point', () => host.remove());
    button(b, 'Delete zone', () => {
      host.select({ kind: 'zone', id: z.id });
      host.remove();
    });
    return;
  }

  if (selection.kind === 'waypoint') {
    const wp = map.course[selection.index];
    if (!wp) return;
    heading(wp.label || 'Waypoint', 'harbour waypoint');
    seaRow();
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

  if (selection.kind === 'area') {
    const area = findArea(map, selection.id);
    if (!area) return;
    heading(area.name, `chart area · ${area.id}`);
    seaRow();
    text('Name', area.name, (v) => (area.name = v || area.name));
    text('Id', area.id, (v) => {
      if (v && !map.fog!.areas.some((a) => a !== area && a.id === v)) area.id = v;
    });
    const point = selection.point !== undefined ? area.outline[selection.point] : undefined;
    node('hr');
    if (point) {
      heading(`Point ${selection.point! + 1}`, `of ${area.outline.length}`);
      xy('Position', point[0], point[1], (x, y) => {
        area.outline[selection.point!] = [x, y];
      });
    } else
      node('p', {
        className: 'ed-note',
        textContent: `${area.outline.length} points. Sailing into it charts all of it, with "${area.name}" in the toast. Its id is kept in saves and quest steps (charts): renaming the id makes old saves forget the area.`,
      });
    const b = buttons();
    if (point && area.outline.length > 3) button(b, 'Delete point', () => host.remove());
    button(b, 'Delete area', () => {
      host.select({ kind: 'area', id: area.id });
      host.remove();
    });
    return;
  }

  if (selection.kind === 'mark') {
    const mark = map.marks?.[selection.index];
    if (!mark) return;
    heading(mark.name ?? MARK_NAMES[mark.type] ?? mark.type, 'sea mark');
    seaRow();
    select(
      'Type',
      mark.type,
      SEA_MARK_TYPES.map((t): [string, string] => [t, MARK_NAMES[t] ?? t]),
      (v) => (mark.type = v as typeof mark.type),
    );
    text('Name', mark.name ?? '', (v) => {
      if (v) mark.name = v;
      else delete mark.name;
    });
    xy('Position', mark.x, mark.y, (x, y) => ([mark.x, mark.y] = [x, y]));
    number(
      'Turn (°)',
      mark.turn,
      (v) => {
        if (v === undefined) delete mark.turn;
        else mark.turn = ((v % 360) + 360) % 360;
      },
      { step: 5, optional: true },
    );
    check('On the chart', !!mark.chart, (v) => {
      if (v) mark.chart = true;
      else delete mark.chart;
    });
    stands(mark, false);
    node('p', {
      className: 'ed-note',
      textContent:
        'A charted mark shows on the sea chart, with its name small beside it. Cardinal marks stand on the side of the danger they are named for: pass north of a north cardinal.',
    });
    button(buttons(), 'Delete mark', () => host.remove());
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
