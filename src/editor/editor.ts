import './editor.css';
import { EDITED_MAP_KEY, isMapShape } from '../data/editedMap';
import { ISLAND_DESIGNS, useIslandDesign } from '../data/islands';
import { PHASE1_MAP, PHASE1_SOURCE, prepareMap } from '../data/maps';
import type { MapDef } from '../sim/map';
import { type MapCheck, distanceChanges, quickChecks } from '../sim/mapChecks';
import { type Layers, type View, drawChart, drawCompass } from './chart';
import {
  History,
  type Selection,
  addIsland,
  addShape,
  deleteSelection,
  findIsland,
  findShape,
  formatMapJson,
  insertPoint,
  moveIsland,
  movePoint,
  moveShape,
  moveStart,
  moveWaypoint,
} from './model';
import { renderPanel } from './panel';
import { hasIslandFile, islandOpen, openIsland, setupIslandBuilder } from './island/builder';
import { giveIslandFile } from './island/fromLook';

/**
 * Map editor page (decision 0095), published next to the game like the model sheet. It edits the
 * authored map JSON, keeps the working copy in this browser, runs the map checks the tests run,
 * opens the game on the edited map and exports the file to commit.
 */

const $ = <T extends Element = HTMLElement>(id: string) =>
  document.getElementById(id) as unknown as T;
const svg = $<SVGSVGElement>('ed-map');
const props = $('ed-props');

type Tool = 'move' | 'island' | 'reef' | 'sandbank' | 'ridge' | 'start';
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
    id: 'ridge',
    icon: '⛰️',
    label: 'Add barrier island',
    hint: 'Click the sea to add a long barrier island, then drag its points',
  },
  {
    id: 'start',
    icon: '⛵',
    label: 'Move the start',
    hint: 'Click the sea to put the start there',
  },
];

// --- State ---------------------------------------------------------------------------------

function loadDraft(): MapDef {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(EDITED_MAP_KEY) ?? 'null');
    if (isMapShape(raw)) return raw;
  } catch {
    /* No storage or an unreadable draft: start from the shipped map. */
  }
  return structuredClone(PHASE1_SOURCE);
}

let map = loadDraft();
let prepared = prepareMap(map);
let selection: Selection = null;
let tool: Tool = 'move';
const history = new History();
const layers: Layers = { names: true, course: true, harbours: true, grid: false };
const view: View = { cx: 0, cy: 0, upp: 1 };
const shippedText = JSON.stringify(PHASE1_SOURCE);

/** True while the view is the whole map: it then follows the window's size. */
let fitted = true;
function fit() {
  fitted = true;
  const rect = svg.getBoundingClientRect();
  view.cx = 0;
  view.cy = 0;
  view.upp = ((map.boundsRadius + 20) * 2) / Math.max(1, Math.min(rect.width, rect.height));
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
  drawChart(svg, { map, prepared, shipped: PHASE1_SOURCE, selection, layers, view });
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
  });
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
svg.addEventListener('dblclick', (e) => {
  const hit = (e.target as Element).closest('[data-hit]')?.getAttribute('data-hit') ?? '';
  const [kind, id] = hit.split(':');
  if ((kind === 'island' || kind === 'shape') && id) editIsland(id);
});

/** After any edit: redraw, save the working copy for "Play this map", rerun the checks. */
function commit(rebuildPanel = true) {
  prepared = prepareMap(map);
  drawMap();
  if (rebuildPanel) drawPanel();
  $<HTMLButtonElement>('ed-undo').disabled = !history.canUndo;
  $<HTMLButtonElement>('ed-redo').disabled = !history.canRedo;
  $('ed-map-name').textContent = map.name;
  const edited = JSON.stringify(map) !== shippedText;
  $('ed-edited').hidden = !edited;
  try {
    if (edited) localStorage.setItem(EDITED_MAP_KEY, JSON.stringify(map));
    else localStorage.removeItem(EDITED_MAP_KEY);
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
  quick = [...quickChecks(prepared), distanceChanges(prepared, PHASE1_MAP)];
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
  | { kind: 'start' }
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
  const [kind, id = '', arg] = hit.split(':');
  if (tool !== 'move' && kind === 'sea') {
    history.record(map);
    if (tool === 'island') selection = { kind: 'island', id: addIsland(map, p.x, p.y) };
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
  if (kind === 'sea') {
    if (selection) select(null);
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, cx: view.cx, cy: view.cy };
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
  } else if (kind === 'waypoint') {
    drag = { kind: 'waypoint', index: Number(id) };
    selection = { kind: 'waypoint', index: Number(id) };
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
  } else moveStart(map, map.start.x + dx, map.start.y + dy);
  commit();
}

document.addEventListener('keydown', (e) => {
  if (islandOpen()) return;
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

function setTool(next: Tool) {
  tool = next;
  for (const b of $('ed-tools').querySelectorAll('button'))
    b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  $('ed-hint').textContent = TOOLS.find((t) => t.id === tool)!.hint;
}
for (const t of TOOLS) {
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
];
for (const [key, label] of LAYER_NAMES) {
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
    (selection?.kind === 'waypoint' && !map.course[selection.index])
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
  replaceMap(structuredClone(PHASE1_SOURCE));
});
$('ed-export').addEventListener('click', () => {
  const blob = new Blob([formatMapJson(map)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'phase1-map.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('ed-play').addEventListener('click', () => {
  window.open('./?map=edited', 'fwt-playtest');
});
const fileInput = $<HTMLInputElement>('ed-file');
$('ed-import').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;
  try {
    const raw: unknown = JSON.parse(await file.text());
    if (!isMapShape(raw)) throw new Error('not a map');
    history.record(map);
    selection = null;
    replaceMap(raw);
  } catch {
    alert(`${file.name} is not a map file.`);
  }
});

new ResizeObserver(() => {
  if (fitted) fit();
  drawMap();
}).observe(svg);
setTool('move');
fit();
commit();
