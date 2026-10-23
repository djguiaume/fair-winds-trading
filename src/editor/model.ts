import type { IslandDef, MapDef, PortDef, TerrainDef } from '../sim/map';

/**
 * The map editor's document (decision 0095): the authored map JSON exactly as it is saved in
 * `src/data/phase1-map.json`, plus the edits the tools make to it. Pure data, no DOM, so the
 * tests can drive it. Positions are whole map units, like the hand-written file.
 */

export type Selection =
  | { kind: 'island'; id: string }
  | { kind: 'shape'; id: string; point?: number }
  | { kind: 'waypoint'; index: number }
  | { kind: 'start' }
  | null;

export type ShapeKind = TerrainDef['kind'];

const round = (v: number) => Math.round(v);

export function findIsland(map: MapDef, id: string): IslandDef | undefined {
  return map.islands.find((i) => i.id === id);
}
export function findShape(map: MapDef, id: string): TerrainDef | undefined {
  return map.terrain?.find((t) => t.id === id);
}
export function portOn(map: MapDef, islandId: string): PortDef | undefined {
  return map.ports.find((p) => p.islandId === islandId);
}
/** The course waypoint a port island's harbour faces: the one carrying the island's name. */
export function waypointOf(map: MapDef, island: IslandDef) {
  return island.name ? map.course.find((w) => w.label === island.name) : undefined;
}

/** Moves an island, and its harbour waypoint with it so the harbour keeps facing the same way. */
export function moveIsland(map: MapDef, id: string, x: number, y: number) {
  const island = findIsland(map, id);
  if (!island) return;
  const [dx, dy] = [round(x) - island.x, round(y) - island.y];
  island.x += dx;
  island.y += dy;
  const wp = waypointOf(map, island);
  if (wp) {
    wp.x += dx;
    wp.y += dy;
  }
}

export function moveShape(map: MapDef, id: string, dx: number, dy: number) {
  const shape = findShape(map, id);
  if (!shape) return;
  shape.outline = shape.outline.map(([x, y]) => [round(x + dx), round(y + dy)]);
}

export function movePoint(map: MapDef, id: string, index: number, x: number, y: number) {
  const shape = findShape(map, id);
  if (shape?.outline[index]) shape.outline[index] = [round(x), round(y)];
}

/** Adds a point halfway along the edge after `index`; returns the new point's index. */
export function insertPoint(map: MapDef, id: string, index: number): number | undefined {
  const shape = findShape(map, id);
  if (!shape) return;
  const n = shape.outline.length;
  const a = shape.outline[index % n]!,
    b = shape.outline[(index + 1) % n]!;
  shape.outline.splice(index + 1, 0, [round((a[0] + b[0]) / 2), round((a[1] + b[1]) / 2)]);
  return index + 1;
}

/** Removes an outline point; a shape keeps at least three. */
export function deletePoint(map: MapDef, id: string, index: number): boolean {
  const shape = findShape(map, id);
  if (!shape || shape.outline.length <= 3) return false;
  shape.outline.splice(index, 1);
  return true;
}

export function moveWaypoint(map: MapDef, index: number, x: number, y: number) {
  const wp = map.course[index];
  if (wp) [wp.x, wp.y] = [round(x), round(y)];
}

export function moveStart(map: MapDef, x: number, y: number) {
  [map.start.x, map.start.y] = [round(x), round(y)];
}

function freeId(taken: string[], base: string): string {
  let n = 1;
  while (taken.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** A small scenery island with a beacon (scenery islands are landmarks, see the map checks). */
export function addIsland(map: MapDef, x: number, y: number): string {
  const id = freeId(
    map.islands.map((i) => i.id),
    'island',
  );
  map.islands.push({
    id,
    x: round(x),
    y: round(y),
    radius: 12,
    look: { trees: 3, rock: true, landmark: 'beacon' },
  });
  return id;
}

/** A six-point reef, sandbank or barrier island centred on (x, y). */
export function addShape(map: MapDef, kind: ShapeKind, x: number, y: number): string {
  map.terrain ??= [];
  const id = freeId(
    map.terrain.map((t) => t.id),
    kind,
  );
  const r = kind === 'island' ? 40 : 22;
  const outline: [number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    outline.push([round(x + r * Math.cos(a) * 1.4), round(y + r * Math.sin(a) * 0.6)]);
  }
  map.terrain.push(
    kind === 'island'
      ? { id, name: 'New ridge', kind, outline, look: { trees: 12, landmark: 'ruins' } }
      : { id, kind, outline },
  );
  return id;
}

/**
 * Turns an island into a port: a name, a dock and houses, a harbour waypoint off its south side
 * and an empty hamlet you then fill with what it makes and wants.
 */
export function addPort(map: MapDef, islandId: string): PortDef | undefined {
  const island = findIsland(map, islandId);
  if (!island || portOn(map, islandId)) return;
  island.name ??= `Port ${island.id}`;
  island.look = { ...island.look, dock: true, houses: island.look?.houses ?? 4 };
  if (!waypointOf(map, island))
    map.course.push({ label: island.name, x: island.x, y: round(island.y - island.radius - 25) });
  const port: PortDef = {
    id: map.ports.some((p) => p.id === island.id)
      ? freeId(
          map.ports.map((p) => p.id),
          'port',
        )
      : island.id,
    name: island.name,
    islandId,
    produces: [],
    wants: [],
    level: 1,
  };
  map.ports.push(port);
  return port;
}

export function removePort(map: MapDef, islandId: string) {
  const port = portOn(map, islandId);
  if (!port) return;
  map.ports.splice(map.ports.indexOf(port), 1);
  if (map.homePort === port.id) delete map.homePort;
}

/** Renames an island, and with it its harbour waypoint and a port that shared its name. */
export function renameIsland(map: MapDef, id: string, name: string) {
  const island = findIsland(map, id);
  if (!island) return;
  const wp = waypointOf(map, island);
  const port = portOn(map, id);
  if (wp) wp.label = name;
  if (port && port.name === island.name) port.name = name;
  if (name) island.name = name;
  else delete island.name;
}

/** Deletes the selection; returns what stays selected (an outline keeps its shape selected). */
export function deleteSelection(map: MapDef, sel: Selection): Selection {
  if (!sel) return null;
  if (sel.kind === 'island') {
    const island = findIsland(map, sel.id);
    if (!island) return null;
    removePort(map, sel.id);
    const wp = waypointOf(map, island);
    if (wp) map.course.splice(map.course.indexOf(wp), 1);
    map.islands.splice(map.islands.indexOf(island), 1);
    return null;
  }
  if (sel.kind === 'shape') {
    if (sel.point !== undefined) {
      deletePoint(map, sel.id, sel.point);
      return { kind: 'shape', id: sel.id };
    }
    const shape = findShape(map, sel.id);
    if (shape) map.terrain!.splice(map.terrain!.indexOf(shape), 1);
    return null;
  }
  if (sel.kind === 'waypoint') {
    map.course.splice(sel.index, 1);
    return null;
  }
  return sel;
}

// --- Undo ----------------------------------------------------------------------------------

/** Snapshots of the whole map: tiny (about 8 KB) and impossible to get out of step. */
export class History {
  private past: string[] = [];
  private future: string[] = [];
  constructor(private readonly limit = 200) {}
  /** Call before a change. */
  record(map: MapDef) {
    this.past.push(JSON.stringify(map));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  /** Drops the last snapshot when the change it guarded did nothing (a click without a drag). */
  discardIfSame(map: MapDef) {
    if (this.past[this.past.length - 1] === JSON.stringify(map)) this.past.pop();
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  undo(map: MapDef): MapDef | null {
    const prior = this.past.pop();
    if (!prior) return null;
    this.future.push(JSON.stringify(map));
    return JSON.parse(prior) as MapDef;
  }
  redo(map: MapDef): MapDef | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(JSON.stringify(map));
    return JSON.parse(next) as MapDef;
  }
}

// --- Export --------------------------------------------------------------------------------

/**
 * Writes the map the way Prettier formats `phase1-map.json` (print width 100), so an exported
 * file drops into the repo and passes `npm run lint` with a clean diff: objects one key per line,
 * except small level tables; arrays on one line when they fit, except lists of points.
 */
export function formatMapJson(map: MapDef): string {
  const WIDTH = 100;
  const isPlain = (v: unknown) => v === null || typeof v !== 'object';
  const inline = (v: unknown): string =>
    Array.isArray(v)
      ? `[${v.map(inline).join(', ')}]`
      : v && typeof v === 'object'
        ? Object.keys(v).length
          ? `{ ${Object.entries(v)
              .map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`)
              .join(', ')} }`
          : '{}'
        : JSON.stringify(v);
  const write = (v: unknown, indent: string, prefix: string): string => {
    const one = prefix + inline(v);
    if (Array.isArray(v)) {
      // Prettier always breaks a list of two or more non-empty lists or objects (the outlines).
      const nested =
        v.length > 1 &&
        v.every((x) => x && typeof x === 'object' && Object.keys(x as object).length > 1);
      if (!v.length || (!nested && indent.length + one.length <= WIDTH)) return one;
      const inner = indent + '  ';
      return `${prefix}[\n${v.map((x) => inner + write(x, inner, '')).join(',\n')}\n${indent}]`;
    }
    if (v && typeof v === 'object') {
      const entries = Object.entries(v);
      if (!entries.length) return `${prefix}{}`;
      // Level tables ({ "3": ["grain"] }) stay on one line when they fit, as in the file.
      const table = entries.every(([, x]) => Array.isArray(x) && x.every(isPlain));
      if (table && indent.length + one.length <= WIDTH) return one;
      const inner = indent + '  ';
      return `${prefix}{\n${entries
        .filter(([, x]) => x !== undefined)
        .map(([k, x]) => inner + write(x, inner, `${JSON.stringify(k)}: `))
        .join(',\n')}\n${indent}}`;
    }
    return one;
  };
  return write(map, '', '') + '\n';
}
