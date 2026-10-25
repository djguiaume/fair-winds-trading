import type { TrafficDef, TrafficKind } from '../sim/traffic';
import type {
  CurrentDef,
  IslandDef,
  MapDef,
  PortDef,
  SeaMarkType,
  TerrainDef,
  WindZoneDef,
} from '../sim/map';

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
  | { kind: 'current'; id: string; point?: number }
  | { kind: 'zone'; id: string; point?: number }
  | { kind: 'mark'; index: number }
  | { kind: 'area'; id: string; point?: number }
  | { kind: 'edge'; id: string; point?: number }
  /** Other boats (decision 0214): a fleet, or one mark of its lane. */
  | { kind: 'fleet'; id: string; point?: number }
  | null;

export type ShapeKind = TerrainDef['kind'];

const round = (v: number) => Math.round(v);

export function findIsland(map: MapDef, id: string): IslandDef | undefined {
  return map.islands.find((i) => i.id === id);
}
export function findShape(map: MapDef, id: string): TerrainDef | undefined {
  return map.terrain?.find((t) => t.id === id);
}
export function findCurrent(map: MapDef, id: string): CurrentDef | undefined {
  return map.currents?.find((c) => c.id === id);
}
export function findZone(map: MapDef, id: string): WindZoneDef | undefined {
  return map.windZones?.find((z) => z.id === id);
}
/** A fog of war chart area (decision 0156). */
export function findArea(map: MapDef, id: string) {
  return map.fog?.areas.find((a) => a.id === id);
}
/** One of the sea's own edges: water joined to the round sea (decision 0202). */
export function findEdge(map: MapDef, id: string) {
  return map.edges?.find((e) => e.id === id);
}
/** A fleet of other boats (decision 0214). */
export function findFleet(map: MapDef, id: string): TrafficDef | undefined {
  return map.traffic?.find((f) => f.id === id);
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

export function moveMark(map: MapDef, index: number, x: number, y: number) {
  const mark = map.marks?.[index];
  if (mark) [mark.x, mark.y] = [round(x), round(y)];
}

/** A sea mark (decision 0130) where you click; returns its index. */
export function addMark(map: MapDef, x: number, y: number, type: SeaMarkType): number {
  map.marks ??= [];
  map.marks.push({ type, x: round(x), y: round(y) });
  return map.marks.length - 1;
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
  const r = kind === 'island' ? 40 : kind === 'bergs' ? 60 : 22;
  const outline: [number, number][] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    outline.push([round(x + r * Math.cos(a) * 1.4), round(y + r * Math.sin(a) * 0.6)]);
  }
  map.terrain.push(
    kind === 'island'
      ? { id, name: 'New ridge', kind, outline, look: { trees: 12, landmark: 'ruins' } }
      : kind === 'bergs'
        ? { id, kind, outline, count: 4 }
        : { id, kind, outline },
  );
  return id;
}

// --- Currents and wind zones (decision 0140) -----------------------------------------------

/** The points a current or zone is drawn by: a lane's path, else its outline. */
function flowPoints(map: MapDef, sel: Selection): number[][] | undefined {
  if (sel?.kind === 'current') {
    const c = findCurrent(map, sel.id);
    return c?.path ?? c?.outline;
  }
  if (sel?.kind === 'zone') return findZone(map, sel.id)?.outline;
  if (sel?.kind === 'area') return findArea(map, sel.id)?.outline;
  if (sel?.kind === 'edge') return findEdge(map, sel.id)?.outline;
  if (sel?.kind === 'fleet') return findFleet(map, sel.id)?.path;
}

/** Starts a lane current at (x, y); `addLanePoint` lays the rest. */
export function beginLane(map: MapDef, x: number, y: number): string {
  map.currents ??= [];
  const id = freeId(
    map.currents.map((c) => c.id),
    'current',
  );
  map.currents.push({ id, name: 'New current', speedKn: 1.5, path: [[round(x), round(y), 50]] });
  return id;
}

/** Lays the next point of a lane, as wide as the one before; returns its index. */
export function addLanePoint(map: MapDef, id: string, x: number, y: number): number | undefined {
  const path = findCurrent(map, id)?.path;
  if (!path) return;
  path.push([round(x), round(y), path[path.length - 1]?.[2] ?? 50]);
  return path.length - 1;
}

/**
 * Ends laying a lane: drops the points a double-click repeated and removes a lane left with
 * fewer than two points. True when the lane stays.
 */
export function finishLane(map: MapDef, id: string): boolean {
  const c = findCurrent(map, id);
  if (!c?.path) return false;
  c.path = c.path.filter(
    (p, i) => i === 0 || Math.hypot(p[0] - c.path![i - 1]![0], p[1] - c.path![i - 1]![1]) > 4,
  );
  if (c.path.length >= 2) return true;
  map.currents!.splice(map.currents!.indexOf(c), 1);
  return false;
}

/** An oval of `n` points centred on (x, y), `rx` across and `ry` up. */
function oval(x: number, y: number, rx: number, ry: number, n = 8): [number, number][] {
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    return [round(x + rx * Math.cos(a)), round(y + ry * Math.sin(a))] as [number, number];
  });
}

/** An area current: an oval flowing east. */
export function addAreaCurrent(map: MapDef, x: number, y: number): string {
  map.currents ??= [];
  const id = freeId(
    map.currents.map((c) => c.id),
    'current',
  );
  map.currents.push({
    id,
    name: 'New drift',
    speedKn: 0.8,
    towardDeg: 90,
    outline: oval(x, y, 90, 60),
  });
  return id;
}

/** A wind zone of the first kind in `kinds`: an oval to drag into shape. */
export function addZone(map: MapDef, x: number, y: number, kind: string): string {
  map.windZones ??= [];
  const id = freeId(
    map.windZones.map((z) => z.id),
    'zone',
  );
  map.windZones.push({ id, name: 'New zone', kind, outline: oval(x, y, 120, 80) });
  return id;
}

/**
 * A chart area (decision 0156): an oval named stretch of the new waters, charted all at once when
 * sailed into. Only a map with fog of war has them; returns null on one without.
 */
export function addChartArea(map: MapDef, x: number, y: number): string | null {
  if (!map.fog) return null;
  const id = freeId(
    map.fog.areas.map((a) => a.id),
    'area',
  );
  map.fog.areas.push({ id, name: 'New waters', outline: oval(x, y, 140, 100) });
  return id;
}

/**
 * A sea edge (decision 0202): an oval of open water round (x, y), joined to the round sea when it
 * overlaps its rim. The playable sea is the round sea and every edge together.
 */
export function addSeaEdge(map: MapDef, x: number, y: number): string {
  map.edges ??= [];
  const id = freeId(
    map.edges.map((e) => e.id),
    'edge',
  );
  map.edges.push({ id, outline: oval(x, y, 200, 140, 10) });
  return id;
}

/**
 * A fleet of other boats (decision 0214) from a port: fishing boats with grounds a little off its
 * harbour (at `x`, `y`), or coasters on a lane to the port `to`. One boat to begin with; its lane
 * runs straight until marks are added (or the planner routes it, `routeLane`).
 */
export function addFleet(
  map: MapDef,
  kind: TrafficKind,
  home: string,
  x: number,
  y: number,
  to?: string,
): string {
  map.traffic ??= [];
  const id = freeId(
    map.traffic.map((f) => f.id),
    `${home}-${kind}`,
  );
  const fleet: TrafficDef = { id, kind, home, names: ['New boat'] };
  if (kind === 'fishing') fleet.grounds = [round(x), round(y), 40];
  else fleet.to = to ?? map.ports.find((p) => p.id !== home)?.id ?? home;
  map.traffic.push(fleet);
  return id;
}

/** Moves a whole current or zone. */
export function moveFlow(map: MapDef, sel: Selection, dx: number, dy: number) {
  if (sel?.kind === 'current') {
    const c = findCurrent(map, sel.id);
    if (c?.path) c.path = c.path.map(([x, y, w]) => [round(x + dx), round(y + dy), w]);
    if (c?.outline) c.outline = c.outline.map(([x, y]) => [round(x + dx), round(y + dy)]);
  } else if (sel?.kind === 'zone' || sel?.kind === 'area' || sel?.kind === 'edge') {
    const z =
      sel.kind === 'zone'
        ? findZone(map, sel.id)
        : sel.kind === 'area'
          ? findArea(map, sel.id)
          : findEdge(map, sel.id);
    if (z) z.outline = z.outline.map(([x, y]) => [round(x + dx), round(y + dy)]);
  } else if (sel?.kind === 'fleet') {
    // A fleet moves its lane's marks and its grounds; its harbours stay with their ports.
    const f = findFleet(map, sel.id);
    if (f?.path) f.path = f.path.map(([x, y]) => [round(x + dx), round(y + dy)]);
    if (f?.grounds) f.grounds = [round(f.grounds[0] + dx), round(f.grounds[1] + dy), f.grounds[2]];
  }
}

/** Moves one point of a current or zone (a lane point keeps its width). */
export function moveFlowPoint(map: MapDef, sel: Selection, index: number, x: number, y: number) {
  const p = flowPoints(map, sel)?.[index];
  if (!p) return;
  p[0] = round(x);
  p[1] = round(y);
}

/** Sets the width of a lane at one of its points (at least 4 units; the checks want more). */
export function setLaneWidth(map: MapDef, id: string, index: number, width: number) {
  const p = findCurrent(map, id)?.path?.[index];
  if (p) p[2] = Math.max(4, round(width));
}

/**
 * Adds a point halfway between point `index` and the next (a closed outline wraps round, a lane
 * does not); returns the new point's index.
 */
export function insertFlowPoint(map: MapDef, sel: Selection, index: number): number | undefined {
  const points = flowPoints(map, sel);
  if (!points) return;
  const open =
    (sel?.kind === 'current' && !!findCurrent(map, sel.id)?.path) || sel?.kind === 'fleet';
  if (open && index >= points.length - 1) return;
  const a = points[index % points.length]!,
    b = points[(index + 1) % points.length]!;
  points.splice(
    index + 1,
    0,
    a.map((v, k) => round((v + b[k]!) / 2)),
  );
  return index + 1;
}

/** Removes a point; a lane keeps two, an outline three. */
export function deleteFlowPoint(map: MapDef, sel: Selection, index: number): boolean {
  const points = flowPoints(map, sel);
  const open =
    (sel?.kind === 'current' && !!findCurrent(map, sel.id)?.path) || sel?.kind === 'fleet';
  // A fleet's lane may lose every mark: it then runs straight between its harbours.
  const keep = sel?.kind === 'fleet' ? 0 : open ? 2 : 3;
  if (!points || points.length <= keep) return false;
  points.splice(index, 1);
  return true;
}

/** Turns a current round: a lane's points in the other order, an area's direction by 180°. */
export function reverseCurrent(map: MapDef, id: string) {
  const c = findCurrent(map, id);
  if (c?.path) c.path.reverse();
  if (c?.towardDeg !== undefined) c.towardDeg = (c.towardDeg + 180) % 360;
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
  if (sel.kind === 'mark') {
    map.marks?.splice(sel.index, 1);
    return null;
  }
  if (sel.kind === 'fleet') {
    if (sel.point !== undefined) {
      deleteFlowPoint(map, sel, sel.point);
      return { kind: 'fleet', id: sel.id };
    }
    const at = map.traffic?.findIndex((f) => f.id === sel.id) ?? -1;
    if (at >= 0) map.traffic!.splice(at, 1);
    return null;
  }
  if (sel.kind === 'current' || sel.kind === 'zone' || sel.kind === 'area' || sel.kind === 'edge') {
    if (sel.point !== undefined) {
      deleteFlowPoint(map, sel, sel.point);
      return { kind: sel.kind, id: sel.id };
    }
    const list: { id: string }[] | undefined =
      sel.kind === 'current'
        ? map.currents
        : sel.kind === 'zone'
          ? map.windZones
          : sel.kind === 'area'
            ? map.fog?.areas
            : map.edges;
    const at = list?.findIndex((x) => x.id === sel.id) ?? -1;
    if (at >= 0) list!.splice(at, 1);
    if (sel.kind === 'edge' && !map.edges?.length) delete map.edges;
    return null;
  }
  return sel;
}

// --- Undo ----------------------------------------------------------------------------------

/**
 * Snapshots of the whole map (or island file): tiny (8 to 60 KB) and impossible to get out of
 * step.
 */
export class History<T = MapDef> {
  private past: string[] = [];
  private future: string[] = [];
  constructor(private readonly limit = 200) {}
  /** Call before a change. */
  record(map: T) {
    this.past.push(JSON.stringify(map));
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  /** Drops the last snapshot when the change it guarded did nothing (a click without a drag). */
  discardIfSame(map: T) {
    if (this.past[this.past.length - 1] === JSON.stringify(map)) this.past.pop();
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  undo(map: T): T | null {
    const prior = this.past.pop();
    if (!prior) return null;
    this.future.push(JSON.stringify(map));
    return JSON.parse(prior) as T;
  }
  redo(map: T): T | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(JSON.stringify(map));
    return JSON.parse(next) as T;
  }
}

// --- Export --------------------------------------------------------------------------------

/**
 * Writes the map the way Prettier formats `phase1-map.json` (print width 100), so an exported
 * file drops into the repo and passes `npm run lint` with a clean diff: objects one key per line,
 * except small level tables; arrays on one line when they fit, except lists of points.
 */
export function formatMapJson(map: unknown, original?: string): string {
  // Level tables ({ "3": ["grain"] }) stay on one line when they fit, as in the file.
  return formatJson(
    map,
    (x) => Array.isArray(x) && x.every(isPlain),
    original ? openObjects(original) : undefined,
  );
}

/**
 * The objects a JSON file writes over several lines although they would fit on one: Prettier
 * keeps an object open when its file has a line break after the `{`, so a sea file written by a
 * script keeps its layout through the editor (decision 0161). Each is keyed by its own JSON.
 */
const SCALAR = /"(?:[^"\\]|\\.)*"|[^,\]}\s]+/y;
export function openObjects(text: string): Set<string> {
  const open = new Set<string>();
  let i = 0;
  const space = () => {
    while (/\s/.test(text[i] ?? '')) i++;
  };
  const value = (): unknown => {
    space();
    const c = text[i];
    if (c === '{') {
      i++;
      const broken = /^[ \t]*\r?\n/.test(text.slice(i, i + 80));
      const obj: Record<string, unknown> = {};
      space();
      if (text[i] === '}') i++;
      else
        for (;;) {
          space();
          const key = value() as string;
          space();
          i++; // :
          obj[key] = value();
          space();
          if (text[i++] === '}') break;
        }
      if (broken && Object.keys(obj).length) open.add(JSON.stringify(obj));
      return obj;
    }
    if (c === '[') {
      i++;
      const list: unknown[] = [];
      space();
      if (text[i] === ']') i++;
      else
        for (;;) {
          list.push(value());
          space();
          if (text[i++] === ']') break;
        }
      return list;
    }
    SCALAR.lastIndex = i;
    const m = SCALAR.exec(text)!;
    i += m[0].length;
    return JSON.parse(m[0]);
  };
  value();
  return open;
}

/**
 * Writes an island file (decision 0096) the way Prettier formats `src/data/islands/*.json`:
 * small flat objects (piers, ground on a coast, short props) on one line when they fit.
 */
export function formatIslandJson(design: unknown): string {
  return formatJson(design, isPlain);
}

const isPlain = (v: unknown) => v === null || typeof v !== 'object';

/**
 * Prettier's JSON layout at print width 100: arrays on one line when they fit, except lists of
 * two or more points or objects; objects one key per line unless every value passes `flat` and
 * the object fits.
 */
function formatJson(value: unknown, flat: (v: unknown) => boolean, keepOpen?: Set<string>): string {
  const WIDTH = 100;
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
  /**
   * Whether a value can never sit on one line: Prettier always breaks a list of two or more
   * non-empty lists or objects (the outlines), objects here break unless every value is `flat`,
   * and whatever holds a value that breaks breaks too.
   */
  const breaks = (v: unknown): boolean => {
    if (Array.isArray(v))
      return (
        (v.length > 1 &&
          v.every((x) => x && typeof x === 'object' && Object.keys(x as object).length > 1)) ||
        v.some(breaks)
      );
    if (!v || typeof v !== 'object') return false;
    const values = Object.values(v).filter((x) => x !== undefined);
    return values.length > 0 && (!values.every(flat) || values.some(breaks));
  };
  /** `tail`: the comma after it, which Prettier counts in the width. */
  const write = (v: unknown, indent: string, prefix: string, tail = 0): string => {
    const one = prefix + inline(v);
    if (Array.isArray(v)) {
      // Prettier always breaks a list of two or more non-empty lists or objects (the outlines).
      if (!v.length || (!breaks(v) && indent.length + one.length + tail <= WIDTH)) return one;
      const inner = indent + '  ';
      const items = v.map((x, i) => inner + write(x, inner, '', i < v.length - 1 ? 1 : 0));
      return `${prefix}[\n${items.join(',\n')}\n${indent}]`;
    }
    if (v && typeof v === 'object') {
      const entries = Object.entries(v);
      if (!entries.length) return `${prefix}{}`;
      if (
        !breaks(v) &&
        indent.length + one.length + tail <= WIDTH &&
        !keepOpen?.has(JSON.stringify(v))
      )
        return one;
      const inner = indent + '  ';
      const kept = entries.filter(([, x]) => x !== undefined);
      const lines = kept.map(
        ([k, x], i) =>
          inner + write(x, inner, `${JSON.stringify(k)}: `, i < kept.length - 1 ? 1 : 0),
      );
      return `${prefix}{\n${lines.join(',\n')}\n${indent}}`;
    }
    return one;
  };
  return write(value, '', '') + '\n';
}
