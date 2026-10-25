import './editor.css';
import { EDITED_MAP_KEY, EDITED_SEAS_KEY, isMapShape } from '../data/editedMap';
import { SEAS } from '../data/grownMap';
import grownFile from '../data/seas/grown.json';
import { ISLAND_DESIGNS, useIslandDesign } from '../data/islands';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../data/maps';
import phase1Text from '../data/phase1-map.json?raw';
import type { MapDef } from '../sim/map';
import { type MapCheck, distanceChanges, questTagsCheck, quickChecks } from '../sim/mapChecks';
import { type Sectors, sectorChecks } from '../sim/seaSectors';
import { seaReach, seaShape } from '../sim/seaEdge';
import { QUESTS } from '../sim/quests';
import { type Layers, type View, drawChart, drawCompass } from './chart';
import {
  History,
  type Selection,
  addAreaCurrent,
  addChartArea,
  addSeaEdge,
  addIsland,
  addLanePoint,
  addMark,
  addShape,
  addZone,
  beginLane,
  deleteSelection,
  findArea,
  findEdge,
  findCurrent,
  findIsland,
  findShape,
  findZone,
  finishLane,
  formatMapJson,
  insertFlowPoint,
  insertPoint,
  moveFlow,
  moveFlowPoint,
  moveIsland,
  moveMark,
  movePoint,
  moveShape,
  moveStart,
  moveWaypoint,
  setLaneWidth,
} from './model';
import { animateCrests } from './flowChart';
import { TUNING } from '../data/tuning';
import { renderPanel } from './panel';
import {
  builderSelectForShots,
  hasIslandFile,
  islandOpen,
  openIsland,
  setupIslandBuilder,
} from './island/builder';
import { giveIslandFile } from './island/fromLook';
import { openQuests, questsOpen, setupQuestBuilder } from './quest/builder';
import { controlsOpen, openControls, setupControlsPage } from './controls/page';
import {
  type GrownDef,
  type SeaDoc,
  RING,
  addSea,
  claimNew,
  importSeaFile,
  isSeaDoc,
  mergeSeas,
  moveToSea,
  ownerOf,
  seaExports,
  seaIds,
  seaName,
  selected,
  splitSeas,
} from './seas';
import { showSeaExport } from './seaExport';

/**
 * Map editor page (decision 0095), published next to the game like the model sheet. It edits the
 * authored map JSON, keeps the working copy in this browser, runs the map checks the tests run,
 * opens the game on the edited map and exports the file to commit.
 */

const $ = <T extends Element = HTMLElement>(id: string) =>
  document.getElementById(id) as unknown as T;
const svg = $<SVGSVGElement>('ed-map');
const props = $('ed-props');

type Tool =
  | 'move'
  | 'island'
  | 'reef'
  | 'sandbank'
  | 'shallows'
  | 'ice'
  | 'bergs'
  | 'ridge'
  | 'mark'
  | 'start'
  | 'current'
  | 'area'
  | 'zone'
  | 'chartArea'
  | 'seaEdge';
const TOOLS: { id: Tool; icon: string; label: string; hint: string }[] = [
  {
    id: 'move',
    icon: '✥',
    label: 'Select and move',
    hint: 'Drag islands, shapes, waypoints and the start · drag the sea to pan, wheel or pinch to zoom · Delete removes the selection',
  },
  { id: 'island', icon: '🏝️', label: 'Add island', hint: 'Click the sea to add a small island' },
  { id: 'reef', icon: '🪸', label: 'Add reef', hint: 'Click the sea to add a reef' },
  { id: 'sandbank', icon: '🏖️', label: 'Add sandbank', hint: 'Click the sea to add a sandbank' },
  {
    id: 'shallows',
    icon: '🫧',
    label: 'Add shallows',
    hint: 'Click the sea to add shallows, then set the deepest draft that gets through',
  },
  {
    id: 'ice',
    icon: '🧊',
    label: 'Add ice',
    hint: 'Click the sea to add pack ice or grounded floes (solid to every ship)',
  },
  {
    id: 'bergs',
    icon: '🏔️',
    label: 'Add drifting icebergs',
    hint: 'Click the sea to add a field where icebergs drift, then set how many',
  },
  {
    id: 'ridge',
    icon: '⛰️',
    label: 'Add barrier island',
    hint: 'Click the sea to add a long barrier island, then drag its points',
  },
  {
    id: 'mark',
    icon: '🛟',
    label: 'Add sea mark',
    hint: 'Click the sea to add a buoy, then pick its type (cardinal marks, lights, boats) and name',
  },
  {
    id: 'start',
    icon: '⛵',
    label: 'Move the start',
    hint: 'Click the sea to put the start there',
  },
  {
    id: 'current',
    icon: '🌊',
    label: 'Add current',
    hint: 'Click to lay the current’s points in the direction it flows · double-click or Enter to finish',
  },
  {
    id: 'area',
    icon: '〰️',
    label: 'Add area current',
    hint: 'Click the sea to add an area of drifting water, then drag its points and set its direction',
  },
  {
    id: 'zone',
    icon: '🌬️',
    label: 'Add wind zone',
    hint: 'Click the sea to add a wind zone, then drag its points and pick its kind',
  },
  {
    id: 'chartArea',
    icon: '🗺️',
    label: 'Add chart area',
    hint: 'Click the sea to add a chart area (fog of war): sailing into it charts all of it',
  },
  {
    id: 'seaEdge',
    icon: '⭕',
    label: 'Add sea edge',
    hint: 'Click over the rim to add open water joined to the sea, then drag its points: the edge buoys follow the outer edge',
  },
];

// --- State ---------------------------------------------------------------------------------

/**
 * Which sea the editor works on: the game's grown sea, the ring and every sea file round it
 * (decisions 0161, 0198), or with `?sea=ring` the Windward Ring alone (`phase1-map.json`).
 */
const SEA_MODE = new URLSearchParams(location.search).get('sea') !== 'ring';
const DRAFT_KEY = SEA_MODE ? EDITED_SEAS_KEY : EDITED_MAP_KEY;
const shippedSea = (): SeaDoc => mergeSeas(PHASE1_SOURCE, SEAS, grownFile as GrownDef);
/** The map as shipped, for Reset, the dashed outlines and "edited". */
const SHIPPED: MapDef = SEA_MODE ? shippedSea() : PHASE1_SOURCE;
const SHIPPED_PREPARED = SEA_MODE ? prepareMap(SHIPPED) : PHASE1_MAP;

/** The shipped text of every file the sea editor writes, to export only what changed. */
const SHIPPED_FILES: Record<string, string> = {
  'src/data/phase1-map.json': phase1Text,
  ...Object.fromEntries(
    Object.entries(
      import.meta.glob<string>('../data/seas/*.json', {
        query: '?raw',
        import: 'default',
        eager: true,
      }),
    ).map(([path, text]) => [path.replace('../', 'src/'), text]),
  ),
};

function loadDraft(): MapDef {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
    if (SEA_MODE ? isSeaDoc(raw) : isMapShape(raw)) return raw as MapDef;
  } catch {
    /* No storage or an unreadable draft: start from the shipped map. */
  }
  return structuredClone(SHIPPED);
}

let map = loadDraft();
/** The sea editor's document: the same object as `map`, in sea mode only. */
const seaDoc = () => (SEA_MODE ? (map as SeaDoc) : null);
let prepared = prepareMap(map);
let selection: Selection = null;
let tool: Tool = 'move';
const history = new History();
const layers: Layers = {
  names: true,
  course: true,
  harbours: true,
  grid: false,
  flow: true,
  marks: true,
  areas: true,
};
/** The lane current being laid with the Add current tool, point by point. */
let laying: string | null = null;
let lastLayClick: { t: number; x: number; y: number } | null = null;
const view: View = { cx: 0, cy: 0, upp: 1 };
const shippedText = JSON.stringify(SHIPPED);

/** True while the view is the whole map: it then follows the window's size. */
let fitted = true;
function fit() {
  fitted = true;
  const rect = svg.getBoundingClientRect();
  view.cx = 0;
  view.cy = 0;
  view.upp = ((seaReach(seaShape(map)) + 20) * 2) / Math.max(1, Math.min(rect.width, rect.height));
}

// --- Drawing -------------------------------------------------------------------------------

const compassBox = document.createElement('div');
compassBox.style.cssText =
  'position:absolute;top:10px;left:10px;text-align:center;font:700 13px var(--display);cursor:pointer';
const compass = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
compass.setAttribute('width', '72');
compass.setAttribute('height', '72');
const compassText = document.createElement('div');
compassBox.append(compass, compassText);
compassBox.title = 'Base wind: select nothing to edit it';
compassBox.addEventListener('click', () => select(null));
svg.parentElement!.append(compassBox);
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function drawMap() {
  drawChart(svg, {
    map,
    prepared,
    shipped: SHIPPED,
    selection,
    layers,
    view,
    ringRadius: SEA_MODE ? PHASE1_SOURCE.boundsRadius : undefined,
    sectors: SEA_MODE
      ? ((map as SeaDoc).seaEditor.grown.sectors as Sectors | undefined)
      : undefined,
  });
  drawCompass(compass, map.wind.fromDeg);
  compassText.textContent = `from ${COMPASS[Math.round(map.wind.fromDeg / 45) % 8]} · ${map.wind.speedKn} kn`;
}

function drawPanel() {
  renderPanel(props, {
    map,
    selection,
    change: (edit, rebuild) => {
      history.record(map);
      edit(map);
      commit(rebuild);
    },
    select,
    remove,
    editIsland,
    seas: seaPanel(),
  });
}

/** The sea editor's part of the panel (decision 0161): which file, the active sea, new seas. */
function seaPanel() {
  const doc = seaDoc();
  if (!doc) return undefined;
  const change = (edit: (d: SeaDoc) => void) => {
    history.record(map);
    edit(doc);
    commit(true);
  };
  return {
    seas: [RING, ...seaIds(doc)].map((id): [string, string] => [id, seaName(doc, id)]),
    active: doc.seaEditor.active,
    owner: ownerOf(selected(doc, selection)),
    radius: doc.boundsRadius,
    ringRadius: PHASE1_SOURCE.boundsRadius,
    setActive: (id: string) => {
      // Not an edit of any file: no undo step.
      doc.seaEditor.active = id;
      commit(true);
    },
    moveTo: (id: string) => change((d) => moveToSea(d, selection, id)),
    rename: (id: string, name: string) =>
      change((d) => {
        const sea = d.seaEditor.seas.find((s) => s.values.id === id);
        if (sea && name) sea.values.name = name;
      }),
    sectors: { ...(doc.seaEditor.grown.sectors as Record<string, [number, number]> | undefined) },
    setSector: (id: string, sector: [number, number] | null) =>
      change((d) => {
        const sectors = { ...(d.seaEditor.grown.sectors as Record<string, [number, number]>) };
        if (sector) sectors[id] = sector;
        else delete sectors[id];
        d.seaEditor.grown.sectors = sectors;
      }),
    add: () => {
      const id = prompt(
        'File name of the new sea (lower case, e.g. "north"): it is saved as src/data/seas/<name>.json',
      );
      if (!id) return;
      const name = prompt('Its name on the chart', id) ?? id;
      history.record(map);
      if (!addSea(doc, id, name)) {
        history.discardIfSame(map);
        alert(`"${id}" is taken or not a usable file name.`);
        return;
      }
      commit(true);
    },
  };
}

/**
 * Opens the island builder (decision 0105) on an island. One without a file, or a ridge, first
 * gets one made from how it is drawn now (decision 0110), as an edit of the map.
 */
function editIsland(id: string) {
  const existing = findIsland(map, id);
  if (!existing || !hasIslandFile(existing)) {
    const before = structuredClone(map);
    const design = giveIslandFile(map, id);
    if (!design) return;
    history.record(before);
    useIslandDesign(design);
    selection = { kind: 'island', id };
    commit(true);
  }
  const island = findIsland(map, id);
  if (island && hasIslandFile(island)) openIsland(island);
}
setupIslandBuilder({
  mapName: () => map.name,
  close: () => {
    // Island edits can move coasts the chart and the checks use.
    commit(true);
  },
});
setupQuestBuilder({
  map: () => map,
  prepared: () => prepared,
  shipped: () => PHASE1_SOURCE,
  mapName: () => map.name,
  close: () => commit(true),
});
setupSeaSwitch();
$('ed-quests').addEventListener('click', openQuests);
setupControlsPage(() => commit(true));
$('ed-controls').addEventListener('click', openControls);
svg.addEventListener('dblclick', (e) => {
  if (laying) return finishLaying();
  const hit = (e.target as Element).closest('[data-hit]')?.getAttribute('data-hit') ?? '';
  const [kind, id] = hit.split(':');
  if ((kind === 'island' || kind === 'shape') && id) editIsland(id);
});

/** After any edit: redraw, save the working copy for "Play this map", rerun the checks. */
function commit(rebuildPanel = true) {
  const doc = seaDoc();
  if (doc) claimNew(doc);
  prepared = prepareMap(map);
  drawMap();
  if (rebuildPanel) drawPanel();
  $<HTMLButtonElement>('ed-undo').disabled = !history.canUndo;
  $<HTMLButtonElement>('ed-redo').disabled = !history.canRedo;
  $('ed-map-name').textContent = map.name;
  const edited = JSON.stringify(map) !== shippedText;
  $('ed-edited').hidden = !edited;
  try {
    if (edited) localStorage.setItem(DRAFT_KEY, JSON.stringify(map));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* Private mode: the editor still works, Play this map then plays the shipped map. */
  }
  runChecks();
}

function select(next: Selection) {
  selection = next;
  drawMap();
  drawPanel();
}

function remove() {
  if (!selection || selection.kind === 'start') return;
  history.record(map);
  selection = deleteSelection(map, selection);
  commit();
}

// --- Checks --------------------------------------------------------------------------------

let worker: Worker | null = null;
let checkId = 0;
let routeTimer = 0;
let quick: MapCheck[] = [];
let routes: MapCheck[] | null = null;

function showChecks() {
  const list = $('ed-checks');
  list.replaceChildren();
  const rows = [...quick, ...(routes ?? [])];
  for (const check of rows) {
    const li = document.createElement('li');
    li.className = check.ok ? 'ok' : check.severity;
    li.textContent = `${check.ok ? '✓' : check.severity === 'error' ? '✗' : '⚠'} ${check.message}`;
    list.append(li);
  }
  if (!routes) {
    const li = document.createElement('li');
    li.className = 'pending';
    li.textContent = '⋯ checking sailing routes';
    list.append(li);
  }
}

function runChecks() {
  quick = [
    ...quickChecks(prepared),
    questTagsCheck(
      prepared,
      QUESTS.map((q) => q.id),
    ),
    distanceChanges(prepared, SHIPPED_PREPARED),
    // Each sea in its own slice of the outer ring (decision 0179).
    ...(SEA_MODE
      ? sectorChecks(
          splitSeas(map as SeaDoc).seas,
          (map as SeaDoc).seaEditor.grown.sectors as Sectors | undefined,
        )
      : []),
  ];
  routes = null;
  showChecks();
  // Route finding takes a few seconds: wait for the edits to settle, run it off the page thread
  // and drop a run that a newer edit made stale.
  clearTimeout(routeTimer);
  routeTimer = window.setTimeout(() => {
    worker?.terminate();
    worker = new Worker(new URL('./checks.worker.ts', import.meta.url), { type: 'module' });
    const id = ++checkId;
    worker.addEventListener('message', (e: MessageEvent<{ id: number; checks: MapCheck[] }>) => {
      if (e.data.id !== checkId) return;
      routes = e.data.checks;
      showChecks();
      worker?.terminate();
      worker = null;
    });
    const designs = prepared.islands.flatMap((i) => {
      const design = i.look?.design && ISLAND_DESIGNS[i.look.design];
      return design ? [design] : [];
    });
    worker.postMessage({ id, map: prepared, designs });
  }, 600);
}

// --- Chart interaction ---------------------------------------------------------------------

type Drag =
  | { kind: 'island'; id: string; dx: number; dy: number }
  | { kind: 'radius'; id: string }
  | { kind: 'shape'; id: string; x: number; y: number }
  | { kind: 'point'; id: string; index: number }
  | { kind: 'waypoint'; index: number }
  | { kind: 'mark'; index: number; dx: number; dy: number }
  | { kind: 'start' }
  | { kind: 'flow'; x: number; y: number }
  | { kind: 'fpoint'; index: number }
  | { kind: 'cwidth'; id: string; index: number }
  | { kind: 'pan'; sx: number; sy: number; cx: number; cy: number };
let drag: Drag | null = null;
const pointers = new Map<number, { x: number; y: number }>();
let pinch: { distance: number; upp: number } | null = null;

function toMap(e: { clientX: number; clientY: number }) {
  const rect = svg.getBoundingClientRect();
  return {
    x: view.cx + (e.clientX - rect.left - rect.width / 2) * view.upp,
    y: view.cy - (e.clientY - rect.top - rect.height / 2) * view.upp,
  };
}

svg.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  svg.focus();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  svg.setPointerCapture(e.pointerId);
  if (pointers.size === 2) {
    // Second finger: pinch zoom instead of whatever the first one started.
    const [a, b] = [...pointers.values()];
    pinch = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y), upp: view.upp };
    if (drag && drag.kind !== 'pan') history.discardIfSame(map);
    drag = null;
    return;
  }
  const p = toMap(e);
  const hit = (e.target as Element).closest('[data-hit]')?.getAttribute('data-hit') ?? 'sea';
  const [hitKind, id = '', arg] = hit.split(':');
  // Adding on top of a zone or a current's water is adding on the sea.
  const kind =
    tool !== 'move' &&
    (hitKind === 'zone' || hitKind === 'current' || hitKind === 'area' || hitKind === 'edge')
      ? 'sea'
      : hitKind;
  if (tool === 'current') {
    // Every click lays the next point, wherever it lands. The chart is redrawn after each one, so
    // the browser's dblclick (two clicks on one element) never fires: a quick second click on the
    // same spot finishes the lane.
    const last = lastLayClick;
    lastLayClick = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    if (
      laying &&
      last &&
      e.timeStamp - last.t < 400 &&
      Math.hypot(e.clientX - last.x, e.clientY - last.y) < 8
    )
      return finishLaying();
    history.record(map);
    if (laying && findCurrent(map, laying)) {
      const point = addLanePoint(map, laying, p.x, p.y)!;
      selection = { kind: 'current', id: laying, point };
    } else {
      laying = beginLane(map, p.x, p.y);
      selection = { kind: 'current', id: laying, point: 0 };
    }
    commit();
    return;
  }
  if (tool !== 'move' && kind === 'sea') {
    history.record(map);
    if (tool === 'island') selection = { kind: 'island', id: addIsland(map, p.x, p.y) };
    else if (tool === 'mark')
      selection = { kind: 'mark', index: addMark(map, p.x, p.y, 'buoy-red') };
    else if (tool === 'area') selection = { kind: 'current', id: addAreaCurrent(map, p.x, p.y) };
    else if (tool === 'seaEdge') selection = { kind: 'edge', id: addSeaEdge(map, p.x, p.y) };
    else if (tool === 'chartArea') {
      const id = addChartArea(map, p.x, p.y);
      selection = id ? { kind: 'area', id } : null;
    } else if (tool === 'zone')
      selection = {
        kind: 'zone',
        id: addZone(map, p.x, p.y, Object.keys(TUNING.weather.zones.kinds)[0]!),
      };
    else if (tool === 'start') {
      moveStart(map, p.x, p.y);
      selection = { kind: 'start' };
    } else
      selection = {
        kind: 'shape',
        id: addShape(map, tool === 'ridge' ? 'island' : tool, p.x, p.y),
      };
    setTool('move');
    commit();
    return;
  }
  const pan = () =>
    (drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, cx: view.cx, cy: view.cy });
  if (kind === 'sea') {
    if (selection) select(null);
    pan();
    return;
  }
  if (kind === 'zone' || kind === 'current' || kind === 'area' || kind === 'edge') {
    // A first press selects a zone or current and pans (zones can cover much of the sea); once
    // selected, a press drags it.
    if (selection?.kind !== kind || selection.id !== id) {
      select({ kind, id });
      pan();
      return;
    }
    history.record(map);
    drag = { kind: 'flow', x: p.x, y: p.y };
    selection = { kind, id };
    drawMap();
    drawPanel();
    return;
  }
  history.record(map);
  if (kind === 'island') {
    const island = findIsland(map, id)!;
    drag = { kind: 'island', id, dx: island.x - p.x, dy: island.y - p.y };
    selection = { kind: 'island', id };
  } else if (kind === 'radius') drag = { kind: 'radius', id };
  else if (kind === 'shape') {
    drag = { kind: 'shape', id, x: p.x, y: p.y };
    selection = { kind: 'shape', id };
  } else if (kind === 'point' || kind === 'insert') {
    const index = kind === 'insert' ? insertPoint(map, id, Number(arg))! : Number(arg);
    drag = { kind: 'point', id, index };
    selection = { kind: 'shape', id, point: index };
  } else if (/^[czae](point|insert)$/.test(kind!)) {
    const flow = { c: 'current', z: 'zone', a: 'area', e: 'edge' } as const;
    const sel = { kind: flow[kind![0] as 'c' | 'z' | 'a' | 'e'], id };
    const index = kind!.endsWith('insert') ? insertFlowPoint(map, sel, Number(arg)) : Number(arg);
    if (index === undefined) return;
    drag = { kind: 'fpoint', index };
    selection = { ...sel, point: index };
  } else if (kind === 'cwidth') {
    drag = { kind: 'cwidth', id, index: Number(arg) };
    selection = { kind: 'current', id, point: Number(arg) };
  } else if (kind === 'waypoint') {
    drag = { kind: 'waypoint', index: Number(id) };
    selection = { kind: 'waypoint', index: Number(id) };
  } else if (kind === 'mark') {
    const mark = map.marks![Number(id)]!;
    drag = { kind: 'mark', index: Number(id), dx: mark.x - p.x, dy: mark.y - p.y };
    selection = { kind: 'mark', index: Number(id) };
  } else if (kind === 'start') {
    drag = { kind: 'start' };
    selection = { kind: 'start' };
  }
  prepared = prepareMap(map);
  drawMap();
  drawPanel();
});

svg.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    view.upp = clampZoom((pinch.upp * pinch.distance) / Math.max(1, d));
    fitted = false;
    drawMap();
    return;
  }
  if (!drag) return;
  const p = toMap(e);
  switch (drag.kind) {
    case 'pan':
      fitted = false;
      view.cx = drag.cx - (e.clientX - drag.sx) * view.upp;
      view.cy = drag.cy + (e.clientY - drag.sy) * view.upp;
      drawMap();
      return;
    case 'island':
      moveIsland(map, drag.id, p.x + drag.dx, p.y + drag.dy);
      break;
    case 'radius': {
      const island = findIsland(map, drag.id)!;
      island.radius = Math.max(
        3,
        Math.round(Math.hypot(p.x - island.x, p.y - island.y) - 6 * view.upp),
      );
      break;
    }
    case 'shape': {
      const [dx, dy] = [Math.round(p.x - drag.x), Math.round(p.y - drag.y)];
      if (!dx && !dy) return;
      moveShape(map, drag.id, dx, dy);
      drag.x += dx;
      drag.y += dy;
      break;
    }
    case 'point':
      movePoint(map, drag.id, drag.index, p.x, p.y);
      break;
    case 'waypoint':
      moveWaypoint(map, drag.index, p.x, p.y);
      break;
    case 'mark':
      moveMark(map, drag.index, p.x + drag.dx, p.y + drag.dy);
      break;
    case 'flow': {
      const [dx, dy] = [Math.round(p.x - drag.x), Math.round(p.y - drag.y)];
      if (!dx && !dy) return;
      moveFlow(map, selection, dx, dy);
      drag.x += dx;
      drag.y += dy;
      break;
    }
    case 'fpoint':
      moveFlowPoint(map, selection, drag.index, p.x, p.y);
      break;
    case 'cwidth': {
      const point = findCurrent(map, drag.id)?.path?.[drag.index];
      if (point)
        setLaneWidth(map, drag.id, drag.index, 2 * Math.hypot(p.x - point[0], p.y - point[1]));
      break;
    }
    case 'start':
      moveStart(map, p.x, p.y);
      break;
  }
  prepared = prepareMap(map);
  drawMap();
});

function endPointer(e: PointerEvent) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (!drag) return;
  const was = drag;
  drag = null;
  if (was.kind === 'pan') return;
  history.discardIfSame(map);
  commit();
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);

const clampZoom = (upp: number) => Math.min(4, Math.max(0.08, upp));
function zoom(factor: number, at?: { x: number; y: number }) {
  const p = at ?? { x: view.cx, y: view.cy };
  const upp = clampZoom(view.upp * factor);
  const k = upp / view.upp;
  fitted = false;
  view.cx = p.x - (p.x - view.cx) * k;
  view.cy = p.y - (p.y - view.cy) * k;
  view.upp = upp;
  drawMap();
}
svg.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    zoom(Math.exp(e.deltaY * 0.0015), toMap(e));
  },
  { passive: false },
);
$('ed-zoom-in').addEventListener('click', () => zoom(1 / 1.4));
$('ed-zoom-out').addEventListener('click', () => zoom(1.4));
$('ed-zoom-fit').addEventListener('click', () => {
  fit();
  drawMap();
});

// --- Keyboard ------------------------------------------------------------------------------

function nudge(dx: number, dy: number) {
  if (!selection) return;
  history.record(map);
  if (selection.kind === 'island') {
    const island = findIsland(map, selection.id)!;
    moveIsland(map, island.id, island.x + dx, island.y + dy);
  } else if (selection.kind === 'shape') {
    const shape = findShape(map, selection.id)!;
    if (selection.point !== undefined) {
      const [x, y] = shape.outline[selection.point]!;
      movePoint(map, shape.id, selection.point, x + dx, y + dy);
    } else moveShape(map, shape.id, dx, dy);
  } else if (selection.kind === 'waypoint') {
    const wp = map.course[selection.index]!;
    moveWaypoint(map, selection.index, wp.x + dx, wp.y + dy);
  } else if (selection.kind === 'mark') {
    const mark = map.marks?.[selection.index];
    if (mark) moveMark(map, selection.index, mark.x + dx, mark.y + dy);
  } else if (
    selection.kind === 'current' ||
    selection.kind === 'zone' ||
    selection.kind === 'area' ||
    selection.kind === 'edge'
  ) {
    const c = selection.kind === 'current' ? findCurrent(map, selection.id) : undefined;
    const points = c
      ? (c.path ?? c.outline)
      : selection.kind === 'zone'
        ? findZone(map, selection.id)?.outline
        : selection.kind === 'area'
          ? findArea(map, selection.id)?.outline
          : findEdge(map, selection.id)?.outline;
    const point = selection.point !== undefined ? points?.[selection.point] : undefined;
    if (point) moveFlowPoint(map, selection, selection.point!, point[0] + dx, point[1] + dy);
    else moveFlow(map, selection, dx, dy);
  } else moveStart(map, map.start.x + dx, map.start.y + dy);
  commit();
}

document.addEventListener('keydown', (e) => {
  if (islandOpen() || questsOpen() || controlsOpen()) return;
  const target = e.target as HTMLElement;
  if (target.closest('input, select, textarea')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    remove();
  } else if (e.key === 'Enter' && laying) {
    e.preventDefault();
    finishLaying();
  } else if (e.key === 'Escape') {
    setTool('move');
    select(null);
  } else if (e.key.startsWith('Arrow') && selection) {
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const [dx, dy] = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }[e.key] ?? [0, 0];
    nudge(dx!, dy!);
  }
});

// --- Tools, layers and the top bar ---------------------------------------------------------

/** Ends laying a lane: one with a single point is dropped. */
function finishLaying() {
  const id = laying;
  laying = null;
  if (!id) return;
  const kept = finishLane(map, id);
  selection = kept ? { kind: 'current', id } : null;
  history.discardIfSame(map);
  setTool('move');
  commit();
}

function setTool(next: Tool) {
  if (laying && next !== 'current') return finishLaying();
  tool = next;
  for (const b of $('ed-tools').querySelectorAll('button'))
    b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  $('ed-hint').textContent = TOOLS.find((t) => t.id === tool)!.hint;
}
// Chart areas belong to the sea files: the ring alone has no fog of war (decision 0156).
for (const t of TOOLS.filter((t) => SEA_MODE || t.id !== 'chartArea')) {
  const b = document.createElement('button');
  b.textContent = t.icon;
  b.title = t.label;
  b.setAttribute('aria-label', t.label);
  b.dataset.tool = t.id;
  b.addEventListener('click', () => setTool(tool === t.id ? 'move' : t.id));
  $('ed-tools').append(b);
}

const LAYER_NAMES: [keyof Layers, string][] = [
  ['names', 'Names'],
  ['course', 'Waypoints'],
  ['harbours', 'Harbour ranges'],
  ['grid', 'Grid 50'],
  ['flow', 'Currents and zones'],
  ['marks', 'Sea marks'],
  ['areas', 'Chart areas'],
];
for (const [key, label] of LAYER_NAMES.filter(([k]) => SEA_MODE || k !== 'areas')) {
  const b = document.createElement('button');
  b.textContent = label;
  b.setAttribute('aria-pressed', String(layers[key]));
  b.addEventListener('click', () => {
    layers[key] = !layers[key];
    b.setAttribute('aria-pressed', String(layers[key]));
    drawMap();
  });
  $('ed-toggles').append(b);
}

function replaceMap(next: MapDef) {
  map = next;
  if (
    (selection?.kind === 'island' && !findIsland(map, selection.id)) ||
    (selection?.kind === 'shape' && !findShape(map, selection.id)) ||
    (selection?.kind === 'waypoint' && !map.course[selection.index]) ||
    (selection?.kind === 'mark' && !map.marks?.[selection.index]) ||
    (selection?.kind === 'current' && !findCurrent(map, selection.id)) ||
    (selection?.kind === 'zone' && !findZone(map, selection.id)) ||
    (selection?.kind === 'area' && !findArea(map, selection.id)) ||
    (selection?.kind === 'edge' && !findEdge(map, selection.id))
  )
    selection = null;
  commit();
}
function undo() {
  const prior = history.undo(map);
  if (prior) replaceMap(prior);
}
function redo() {
  const next = history.redo(map);
  if (next) replaceMap(next);
}
$('ed-undo').addEventListener('click', undo);
$('ed-redo').addEventListener('click', redo);
$('ed-reset').addEventListener('click', () => {
  if (!confirm('Throw away your edits and go back to the map shipped with the game?')) return;
  history.record(map);
  selection = null;
  replaceMap(structuredClone(SHIPPED));
});
$('ed-export').addEventListener('click', () => {
  const doc = seaDoc();
  if (doc) return showSeaExport(seaExports(doc, SHIPPED_FILES));
  const blob = new Blob([formatMapJson(map)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'phase1-map.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('ed-play').addEventListener('click', () => {
  window.open(SEA_MODE ? './?map=edited&sea=phase4' : './?map=edited', 'fwt-playtest');
});
const fileInput = $<HTMLInputElement>('ed-file');
$('ed-import').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;
  try {
    const raw: unknown = JSON.parse(await file.text());
    const doc = seaDoc();
    if (doc) {
      // A sea file, or the ring's map file: it replaces that file's things (decision 0161).
      const next = structuredClone(doc);
      if (!importSeaFile(next, raw)) throw new Error('not a sea');
      history.record(map);
      selection = null;
      replaceMap(next);
      return;
    }
    if (!isMapShape(raw)) throw new Error('not a map');
    history.record(map);
    selection = null;
    replaceMap(raw);
  } catch {
    alert(`${file.name} is not a ${SEA_MODE ? 'sea or map' : 'map'} file.`);
  }
});

/** The top bar's sea picker: the ring alone or the whole Phase 4 sea (decision 0161). */
function setupSeaSwitch() {
  const pick = $<HTMLSelectElement>('ed-sea');
  pick.value = SEA_MODE ? 'phase4' : 'ring';
  pick.addEventListener('change', () => {
    location.search = pick.value === 'phase4' ? '' : '?sea=ring';
  });
  $('ed-export').textContent = SEA_MODE ? 'Export files' : 'Export map.json';
  $('ed-play').textContent = SEA_MODE ? '▶ Play this sea' : '▶ Play this map';
  if (SEA_MODE) $('ed-file-name').textContent = `ring + ${seaIds(map as SeaDoc).length} sea files`;
}

new ResizeObserver(() => {
  if (fitted) fit();
  drawMap();
}).observe(svg);
setTool('move');
fit();
commit();

// The current crests drift downstream, a few times a second (cheap: a few hundred short paths).
let lastCrests = 0;
function tickCrests(now: number) {
  if (now - lastCrests > 80 && layers.flow && map.currents?.length && !drag) {
    lastCrests = now;
    animateCrests(svg, map);
  }
  requestAnimationFrame(tickCrests);
}
requestAnimationFrame(tickCrests);

// `?debug`: a handle for `npm run shots -- --editor` (decision 0161) to frame and select.
if (new URLSearchParams(location.search).has('debug'))
  (window as unknown as { fwtEditor: unknown }).fwtEditor = {
    focus(x: number, y: number, upp?: number) {
      fitted = false;
      [view.cx, view.cy] = [x, y];
      if (upp) view.upp = clampZoom(upp);
      drawMap();
    },
    /** The island builder on an island, at a tab, a shape and a point picked (`--builder`). */
    builder(id: string, tab = 'props', shape?: string, point?: number) {
      editIsland(id);
      builderSelectForShots(tab as Parameters<typeof builderSelectForShots>[0], shape, point);
    },
    /** A chart hit as the chart tags it: "island:sunreach", "area:sugar-bar", "mark:3", "start". */
    select(hit: string) {
      const [kind, id = ''] = hit.split(':');
      const index = Number(id);
      select(
        kind === 'mark' || kind === 'waypoint'
          ? { kind, index }
          : kind === 'start'
            ? { kind }
            : kind === 'island' ||
                kind === 'shape' ||
                kind === 'current' ||
                kind === 'zone' ||
                kind === 'area' ||
                kind === 'edge'
              ? { kind, id }
              : null,
      );
    },
  };
