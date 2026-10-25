import { SEA_MARK_TYPES, type SeaMarkType } from '../sim/map';
import {
  type Selection,
  addAreaCurrent,
  addChartArea,
  addIsland,
  addMark,
  addPort,
  addShape,
  addZone,
  deleteSelection,
  findArea,
  findCurrent,
  findIsland,
  findShape,
  findZone,
  moveFlow,
  moveIsland,
  moveMark,
  moveShape,
  moveWaypoint,
  removePort,
  renameIsland,
} from './model';
import { RING, type SeaDoc, addSea, claimNew, moveToSea, ownerOf, seaIds, selected } from './seas';

/**
 * The sea editor's edits as data (decision 0161), for `npm run sea` and its `--steps` lists: the
 * same model functions the editor's tools call, so a sea laid out on the command line is the sea
 * the editor would have made. Positions are map units (x east, y north).
 */

/** What a step adds or points at. `shape` is any reef, sandbank, shallows, ice or barrier island. */
export type SeaThing =
  'island' | 'shape' | 'port' | 'waypoint' | 'mark' | 'current' | 'zone' | 'area';
export type SeaAdd =
  | 'island'
  | 'reef'
  | 'sandbank'
  | 'shallows'
  | 'ice'
  | 'bergs'
  | 'ridge'
  | 'mark'
  | 'current'
  | 'drift'
  | 'zone'
  | 'area'
  | 'port';

type XY = [number, number];

export type SeaStep =
  | { do: 'new'; sea: string; name?: string }
  | {
      do: 'add';
      what: SeaAdd;
      /** The sea file it goes in (default: the active sea, the last one). */
      sea?: string;
      at?: XY;
      /** A shape's, zone's, drift's or chart area's outline (instead of the default oval). */
      outline?: XY[];
      /** A lane current's points `[x, y, width]`, in the direction the water flows. */
      path?: [number, number, number][];
      /** The island a port goes on. */
      island?: string;
      /** Any other field, set on what was added (`name`, `kind`, `maxDraft`, `type`, …). */
      fields?: Record<string, unknown>;
    }
  | {
      do: 'move';
      what: SeaThing;
      id: string | number;
      at?: XY;
      by?: XY;
      /** Turns it round the middle of the map, degrees clockwise: it keeps its distance (0179). */
      turn?: number;
      toSea?: string;
    }
  | {
      do: 'set';
      what: SeaThing | 'sea' | 'grown';
      id?: string | number;
      /** Fields to set; `null` removes one. Grown: `boundsRadius`, `chartedRadius`, `sectors`. */
      fields: Record<string, unknown>;
    }
  | { do: 'remove'; what: SeaThing; id: string | number };

/**
 * The selection a step points at: an id, or for waypoints and marks an index into the whole grown
 * sea (the ring's first) or their label or name, which is safer (decision 0170).
 */
export function seaRef(doc: SeaDoc, what: SeaThing, id: string | number): Selection {
  const index = Number(id);
  const sel: Selection =
    what === 'island'
      ? { kind: 'island', id: String(id) }
      : what === 'shape'
        ? { kind: 'shape', id: String(id) }
        : what === 'current'
          ? { kind: 'current', id: String(id) }
          : what === 'zone'
            ? { kind: 'zone', id: String(id) }
            : what === 'area'
              ? { kind: 'area', id: String(id) }
              : what === 'mark'
                ? {
                    kind: 'mark',
                    index: Number.isInteger(index)
                      ? index
                      : (doc.marks ?? []).findIndex((m) => m.name === id),
                  }
                : what === 'waypoint'
                  ? {
                      kind: 'waypoint',
                      index: Number.isInteger(index)
                        ? index
                        : doc.course.findIndex((w) => w.label === id),
                    }
                  : null;
  if (what === 'port') {
    const port = doc.ports.find((p) => p.id === id);
    return port ? { kind: 'island', id: port.islandId } : null;
  }
  if (!sel || !selected(doc, sel)) throw new Error(`no ${what} "${id}"`);
  return sel;
}

/** A centred oval of points, like the editor's new shapes. */
function oval(at: XY, rx: number, ry: number, n = 10): XY[] {
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    return [Math.round(at[0] + rx * Math.cos(a)), Math.round(at[1] + ry * Math.sin(a))] as XY;
  });
}

/** Sets fields on an object; `null` deletes one. */
function assign(target: object, fields: Record<string, unknown> = {}) {
  const t = target as Record<string, unknown>;
  for (const [k, v] of Object.entries(fields)) {
    if (v === null) delete t[k];
    // A look merges: its colour, design or landmark change without dropping the rest.
    else if (k === 'look' && typeof v === 'object' && typeof t.look === 'object')
      t.look = { ...(t.look as object), ...v };
    else t[k] = v;
  }
}

/**
 * Applies steps to the sea, in order; returns one line per step saying what it made or changed.
 * Throws on a step that cannot apply (the caller writes nothing).
 */
export function applySeaSteps(doc: SeaDoc, steps: readonly SeaStep[]): string[] {
  const made: string[] = [];
  for (const step of steps) {
    if (step.do === 'new') {
      const id = addSea(doc, step.sea, step.name ?? step.sea);
      if (!id) throw new Error(`sea "${step.sea}" is taken or not a usable file name`);
      made.push(`sea ${id}`);
      continue;
    }
    if (step.do === 'add') {
      const before = doc.seaEditor.active;
      if (step.sea) {
        if (step.sea !== RING && !seaIds(doc).includes(step.sea))
          throw new Error(`no sea "${step.sea}" (sea new ${step.sea})`);
        doc.seaEditor.active = step.sea;
      }
      const at = step.at ?? step.outline?.[0] ?? (step.path?.[0]?.slice(0, 2) as XY | undefined);
      if (!at && step.what !== 'port') throw new Error(`add ${step.what} needs --at`);
      let what: string;
      const shapeKind = {
        reef: 'reef',
        sandbank: 'sandbank',
        shallows: 'shallows',
        ice: 'ice',
        bergs: 'bergs',
        ridge: 'island',
      } as const;
      if (step.what === 'island') {
        const id = addIsland(doc, at![0], at![1]);
        assign(findIsland(doc, id)!, step.fields);
        what = `island ${id}`;
      } else if (step.what in shapeKind) {
        const id = addShape(doc, shapeKind[step.what as keyof typeof shapeKind], at![0], at![1]);
        const shape = findShape(doc, id)!;
        if (step.outline) shape.outline = step.outline;
        assign(shape, step.fields);
        what = `${step.what} ${id}`;
      } else if (step.what === 'mark') {
        const type = (step.fields?.type as SeaMarkType | undefined) ?? 'buoy-red';
        if (!SEA_MARK_TYPES.includes(type)) throw new Error(`unknown mark type ${type}`);
        const index = addMark(doc, at![0], at![1], type);
        assign(doc.marks![index]!, step.fields);
        what = `mark ${index} (${type})`;
      } else if (step.what === 'current') {
        if (!step.path || step.path.length < 2) throw new Error('add current needs --path');
        doc.currents ??= [];
        const id = (step.fields?.id as string | undefined) ?? freeId(doc.currents, 'current');
        doc.currents.push({ id, name: 'New current', speedKn: 1.5, path: step.path });
        assign(findCurrent(doc, id)!, { ...step.fields, id });
        what = `current ${id}`;
      } else if (step.what === 'drift') {
        const id = addAreaCurrent(doc, at![0], at![1]);
        const c = findCurrent(doc, id)!;
        if (step.outline) c.outline = step.outline;
        assign(c, step.fields);
        what = `drift ${c.id}`;
      } else if (step.what === 'zone') {
        const kind = (step.fields?.kind as string | undefined) ?? 'trade-belt';
        const id = addZone(doc, at![0], at![1], kind);
        const z = findZone(doc, id)!;
        if (step.outline) z.outline = step.outline;
        assign(z, step.fields);
        what = `zone ${z.id}`;
      } else if (step.what === 'area') {
        const id = addChartArea(doc, at![0], at![1]);
        if (!id) throw new Error('this sea has no fog of war to add chart areas to');
        const a = findArea(doc, id)!;
        a.outline = step.outline ?? oval(at!, 140, 100);
        assign(a, step.fields);
        what = `area ${a.id}`;
      } else if (step.what === 'port') {
        if (!step.island) throw new Error('add port needs --island');
        const port = addPort(doc, step.island);
        if (!port) throw new Error(`no island "${step.island}", or it has a port already`);
        assign(port, step.fields);
        what = `port ${port.id}`;
      } else throw new Error(`cannot add "${step.what}"`);
      claimNew(doc);
      doc.seaEditor.active = before;
      made.push(what);
      continue;
    }
    if (step.do === 'set' && step.what === 'sea') {
      const sea = doc.seaEditor.seas.find((s) => s.values.id === step.id);
      if (!sea) throw new Error(`no sea "${step.id}"`);
      assign(sea.values, step.fields);
      made.push(`sea ${step.id}`);
      continue;
    }
    if (step.do === 'set' && step.what === 'grown') {
      const f = step.fields;
      if (typeof f.boundsRadius === 'number') doc.boundsRadius = f.boundsRadius;
      if (typeof f.chartedRadius === 'number' && doc.fog) doc.fog.chartedRadius = f.chartedRadius;
      // Each sea's slice of the outer ring (decision 0179); null removes one.
      if (f.sectors && typeof f.sectors === 'object') {
        const grown = doc.seaEditor.grown;
        const sectors = { ...(grown.sectors as Record<string, unknown> | undefined) };
        assign(sectors, f.sectors as Record<string, unknown>);
        grown.sectors = sectors;
      }
      made.push('grown');
      continue;
    }
    const sel = seaRef(doc, step.what as SeaThing, step.id!);
    if (step.do === 'remove') {
      if (step.what === 'port' && sel?.kind === 'island') removePort(doc, sel.id);
      else deleteSelection(doc, sel);
      made.push(`removed ${step.what} ${step.id}`);
      continue;
    }
    if (step.do === 'move') {
      if (step.toSea) {
        moveToSea(doc, sel, step.toSea);
        if (ownerOf(selected(doc, sel)) !== step.toSea)
          throw new Error(`cannot move ${step.what} ${step.id} to "${step.toSea}"`);
      }
      if (step.at || step.by) moveBy(doc, sel, step.at, step.by);
      if (step.turn) turnBy(doc, sel, step.turn);
      made.push(`moved ${step.what} ${step.id}`);
      continue;
    }
    // set
    const item =
      step.what === 'port' ? doc.ports.find((p) => p.id === step.id) : selected(doc, sel);
    const { name, ...rest } = step.fields;
    if (sel?.kind === 'island' && step.what === 'island' && typeof name === 'string')
      renameIsland(doc, sel.id, name);
    else if (name !== undefined) assign(item!, { name });
    // A look is merged, so setting a reef's rock style keeps its landmark (null removes a key).
    if (rest.look && typeof rest.look === 'object') {
      const holder = item as { look?: object };
      const look = { ...holder.look };
      assign(look, rest.look as Record<string, unknown>);
      if (Object.keys(look).length) holder.look = look;
      else delete holder.look;
      delete rest.look;
    }
    assign(item!, rest);
    made.push(`set ${step.what} ${step.id}`);
  }
  return made;
}

function freeId(list: { id: string }[], base: string) {
  let n = 1;
  while (list.some((x) => x.id === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Moves a thing to a point (its first point, for outlines) or by an offset. */
function moveBy(doc: SeaDoc, sel: Selection, at?: XY, by?: XY) {
  if (!sel) return;
  const from: XY | undefined =
    sel.kind === 'island'
      ? [findIsland(doc, sel.id)!.x, findIsland(doc, sel.id)!.y]
      : sel.kind === 'mark'
        ? [doc.marks![sel.index]!.x, doc.marks![sel.index]!.y]
        : sel.kind === 'waypoint'
          ? [doc.course[sel.index]!.x, doc.course[sel.index]!.y]
          : sel.kind === 'shape'
            ? findShape(doc, sel.id)!.outline[0]
            : sel.kind === 'current'
              ? ((findCurrent(doc, sel.id)!.path?.[0]?.slice(0, 2) as XY | undefined) ??
                findCurrent(doc, sel.id)!.outline![0])
              : sel.kind === 'zone'
                ? findZone(doc, sel.id)!.outline[0]
                : sel.kind === 'area'
                  ? findArea(doc, sel.id)!.outline[0]
                  : undefined;
  if (!from) return;
  const [dx, dy] = at ? [at[0] - from[0], at[1] - from[1]] : by!;
  if (sel.kind === 'island') moveIsland(doc, sel.id, from[0] + dx, from[1] + dy);
  else if (sel.kind === 'mark') moveMark(doc, sel.index, from[0] + dx, from[1] + dy);
  else if (sel.kind === 'waypoint') moveWaypoint(doc, sel.index, from[0] + dx, from[1] + dy);
  else if (sel.kind === 'shape') moveShape(doc, sel.id, dx, dy);
  else moveFlow(doc, sel, dx, dy);
}

/**
 * Turns a thing round the middle of the map by `deg` clockwise (a compass bearing grows), so it
 * keeps its distance from the ring: how a sea's things move from one sector to the next (0179).
 */
function turnBy(doc: SeaDoc, sel: Selection, deg: number) {
  if (!sel) return;
  const a = (deg * Math.PI) / 180;
  const turn = ([x, y]: readonly number[]): XY => [
    Math.round((x! * Math.cos(a) + y! * Math.sin(a)) * 10) / 10,
    Math.round((-x! * Math.sin(a) + y! * Math.cos(a)) * 10) / 10,
  ];
  const point = (p: { x: number; y: number }) => turn([p.x, p.y]);
  if (sel.kind === 'island') return moveBy(doc, sel, point(findIsland(doc, sel.id)!));
  if (sel.kind === 'mark') return moveBy(doc, sel, point(doc.marks![sel.index]!));
  if (sel.kind === 'waypoint') return moveBy(doc, sel, point(doc.course[sel.index]!));
  const item =
    sel.kind === 'shape'
      ? findShape(doc, sel.id)
      : sel.kind === 'current'
        ? findCurrent(doc, sel.id)
        : sel.kind === 'zone'
          ? findZone(doc, sel.id)
          : sel.kind === 'area'
            ? findArea(doc, sel.id)
            : undefined;
  if (!item) return;
  const holder = item as { outline?: XY[]; path?: [number, number, number][] };
  if (holder.outline) holder.outline = holder.outline.map(turn);
  if (holder.path) holder.path = holder.path.map(([x, y, w]) => [...turn([x, y]), w]);
}

/** One line per sea file: what is in it. */
export function seaSummary(doc: SeaDoc): string[] {
  return [RING, ...seaIds(doc)].map((owner) => {
    const count = (list: object[] | undefined) =>
      (list ?? []).filter((x) => ownerOf(x) === owner).length;
    const parts: [string, number][] = [
      ['islands', count(doc.islands)],
      ['ports', count(doc.ports)],
      ['shapes', count(doc.terrain)],
      ['marks', count(doc.marks)],
      ['currents', count(doc.currents)],
      ['zones', count(doc.windZones)],
      ['chart areas', count(doc.fog?.areas)],
    ];
    const name =
      owner === RING
        ? 'Windward Ring'
        : (doc.seaEditor.seas.find((s) => s.values.id === owner)?.values.name as string);
    const file = owner === RING ? 'phase1-map.json' : `seas/${owner}.json`;
    return `${file.padEnd(18)} ${name}: ${parts
      .filter(([, n]) => n)
      .map(([k, n]) => `${n} ${k}`)
      .join(', ')}`;
  });
}
