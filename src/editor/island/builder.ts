import './island.css';
import * as THREE from 'three';
import { editedIslands, saveEditedIslands } from '../../data/editedMap';
import {
  ISLAND_DESIGNS,
  isIslandShape,
  useIslandDesign,
  type IslandDesign,
} from '../../data/islands';
import { ISLAND_SCALE } from '../../render/models/highlandIslands';
import { isGlowing } from '../../render/models/geometry';
import { PROP_TYPES, type PropGroup } from '../../render/models/props';
import {
  designedTownParts,
  islandCheckKit,
  propParts,
  standHeight,
  type TownLevel,
} from '../../render/models/towns';
import { coastDistance } from '../../sim/coast';
import { type IslandIssue, TRIANGLE_BUDGET } from '../../sim/islandChecks';
import { islandLayout, layoutGround } from '../../sim/islandLayout';
import type { IslandDef } from '../../sim/map';
import { History, formatIslandJson } from '../model';
import {
  LEVEL_NAMES,
  LEVELS,
  TOP_LEVEL,
  type Level,
  addProp,
  deleteProp,
  deleteSpot,
  moveSpot,
  duplicateProp,
  moveProp,
  newProp,
  propName,
  propsAt,
  sameDesign,
  tidyDesign,
  turnProp,
} from './doc';
import { drawOverlay } from './overlay';
import { renderIslandPanel } from './panel';
import { renderShapePanel } from './shapePanel';
import { type SpotShow, renderSpotPanel } from './spotPanel';
import { homeView } from '../../sim/home';
import {
  type Shape,
  addLake,
  addLane,
  addRiver,
  addRamp,
  addMountain,
  addPlateau,
  deletePoint,
  deleteShape,
  insertPoint,
  movePoint,
  paintWoods,
  pointsOf,
  toggleSlopeEdge,
} from './shapes';
import { Preview, TopView, mergeParts, thumbnails, type IslandView } from './scene';

/**
 * The island builder (decision 0105, planned in 0096 §3): opened from the map editor on a port
 * island with an island file. A live top-down render of the island at a level with an SVG
 * overlay, the prop palette, the selected prop's panel, a small 3D preview and the island checks
 * the tests run. Edits are kept in this browser next to the edited map, played with "Play this
 * island" and exported as the island's JSON file.
 */

const $ = <T extends Element = HTMLElement>(id: string) =>
  document.getElementById(id) as unknown as T;

// The shipped files, before this browser's edited islands replace them for the editor's page.
const SHIPPED: Record<string, IslandDesign> = structuredClone(ISLAND_DESIGNS);
/** Island files made in the editor, as they were made (what Reset goes back to). */
const MADE: Record<string, IslandDesign> = {};
const original = (id: string) => SHIPPED[id] ?? MADE[id];
const storage: Storage | null = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
if (storage) for (const design of editedIslands(storage)) useIslandDesign(design);

const GROUPS: [PropGroup | 'all', string][] = [
  ['all', 'All'],
  ['homes', 'Homes'],
  ['town', 'Town'],
  ['timber', 'Timber'],
  ['fish', 'Fish'],
  ['farm', 'Farm'],
  ['stone', 'Stone'],
  ['nature', 'Nature'],
  ['rocks', 'Rocks and springs'],
  ['landmarks', 'Landmarks'],
];

/** Is an island built from an island file, so the builder can open it? */
export const hasIslandFile = (island: IslandDef) =>
  !!island.look?.design && !!ISLAND_DESIGNS[island.look.design];

interface Host {
  /** Shows the map editor again. */
  close(): void;
  mapName(): string;
}

let host: Host;
let open = false;
let design: IslandDesign;
let R = 1;
let level: Level = TOP_LEVEL;
/** Whether the island has a harbour (a port's); others have no levels (decision 0110). */
let harbour = true;
/** What new things belong to: the level on show, or every level on an island with no port. */
const placeLevel = (): Level => (harbour ? level : 1);
let selection: number | null = null;
let history = new History<IslandDesign>();
let showLater = true;
let outlines = false;
let issues: IslandIssue[] = [];
let triangles: number[] = [];
let checking = false;
let thumbs: Record<string, string> = {};
let thumbStyle = '';
let group: PropGroup | 'all' = 'all';
/** A palette prop waiting for a tap on the island (touch), or being dragged in (mouse). */
let armed: string | null = null;
/** The tools out: props, or ground (with woods) and lanes (part 2 of decision 0105). */
type Mode = 'props' | 'ground' | 'lanes' | 'spots';
let mode: Mode = 'props';
/** Build spots (decisions 0126, 0128): the selected one, and what the island shows. */
let spotSel: number | null = null;
let showHome: SpotShow = 'all';
let chosen: Record<string, string> = {};
let shapeSel: { shape: Shape; point?: number } | null = null;
type ShapeTool =
  | 'plateau'
  | 'mountain'
  | 'lake'
  | 'ramp'
  | 'grow'
  | 'clear'
  | 'lane'
  | 'path'
  | 'stairs'
  | 'river'
  | 'lava';
let tool: ShapeTool | null = null;
/** A lane being drawn (with heights for stairs), and the pointer while drawing or painting. */
let drawing: number[][] | null = null;
let hover: [number, number] | undefined;
let brush = 0.12;
const view: IslandView = { cx: 0, cz: 0, upp: 0.01 };
let fitted = true;

const svg = $<SVGSVGElement>('ib-svg');
const canvas = $<HTMLCanvasElement>('ib-canvas');
const viewBox = $('ib-view');
let top: TopView | null = null;
let preview: Preview | null = null;
let geometry: THREE.BufferGeometry | null = null;
let previewLand: THREE.BufferGeometry | null = null;
let previewGlass: THREE.BufferGeometry | null = null;

export const islandOpen = () => open;

export function setupIslandBuilder(h: Host) {
  host = h;
}

/** Opens the builder on an island of the map with a file (its id is `look.design`). */
export function openIsland(target: IslandDef) {
  const id = target.look?.design;
  if (!id || !ISLAND_DESIGNS[id]) return;

  design = structuredClone(ISLAND_DESIGNS[id]!);
  // A file made in this browser (decision 0110): Reset goes back to how it was made.
  if (!SHIPPED[id]) MADE[id] ??= structuredClone(design);
  R = target.radius / ISLAND_SCALE;
  harbour = !!target.look?.dock;
  if (!harbour) level = TOP_LEVEL;
  $('ib-levels').parentElement!.hidden = !harbour;
  selection = null;
  shapeSel = null;
  spotSel = null;
  showHome = 'all';
  chosen = {};
  tool = null;
  drawing = null;
  history = new History<IslandDesign>();
  issues = [];
  triangles = [];
  open = true;
  $('ed-top').hidden = true;
  $('ed-main').hidden = true;
  $('ib').hidden = false;
  top ??= new TopView(canvas);
  preview ??= new Preview($<HTMLCanvasElement>('ib-preview-canvas'));
  preview.yaw = 0;
  $('ib-map-name').textContent = host.mapName();
  $('ib-name').textContent = design.name;
  $('ib-file').textContent = `· islands/${design.id}.json`;
  $('ib-export').textContent = `Export ${design.id}.json`;
  if (thumbStyle !== design.style) {
    thumbs = thumbnails(design.style, R);
    thumbStyle = design.style;
  }
  drawPalette();
  drawLevels();
  setMode(mode);
  placePreview();
  fit();
  // A file just made from the map is saved at once: the edited map already refers to it.
  commit(!SHIPPED[id]);
  svg.focus();
}

function close() {
  open = false;
  expandPreview(false);
  armed = null;
  $('ib').hidden = true;
  $('ed-top').hidden = false;
  $('ed-main').hidden = false;
  host.close();
}

// --- Rebuilding and drawing ---------------------------------------------------------------

function size() {
  const rect = viewBox.getBoundingClientRect();
  return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
}

function fit() {
  fitted = true;
  const { width, height } = size();
  const xs = design.coasts.flat().map((p) => p[0]),
    zs = design.coasts.flat().map((p) => p[1]);
  const [x0, x1, z0, z1] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...zs),
    Math.max(...zs, 1.6),
  ];
  view.cx = (x0 + x1) / 2;
  view.cz = (z0 + z1) / 2;
  view.upp = Math.max((x1 - x0 + 0.3) / width, (z1 - z0 + 0.3) / height);
}

/**
 * The island as shown: the whole file, or a home state (first look, or the buildings chosen in
 * Spots), with each shown prop's index in the file and whether it was moved to a spare spot.
 */
function displayed() {
  if (showHome === 'all' || !design.homeSpots?.length) {
    const all = design.props.map((_, i) => i);
    return { design, from: all, moved: all.map(() => false) };
  }
  if (showHome === 'first') return homeView(design, {});
  // A plot with no building picked shows staked, as the captain sees a plot given (0210).
  const staked: Record<string, string> = {};
  for (const spot of design.homeSpots) if (spot.pair) staked[spot.id] = 'plot:open';
  return homeView(design, { ...staked, ...chosen });
}

/** Builds the island at the level and shows it in both views. */
function rebuild(without?: number) {
  let parts;
  try {
    const view = displayed();
    const shown =
      without === undefined
        ? view.design
        : { ...view.design, props: view.design.props.filter((_, i) => view.from[i] !== without) };
    parts = designedTownParts(shown, R, level as TownLevel, harbour);
  } catch (error) {
    hint(`The island does not build: ${String(error)}`);
    return;
  }
  // The preview draws the glass apart, tinted by day or night like the game.
  const glass = parts.filter(isGlowing);
  const land = mergeParts(parts.filter((g) => !isGlowing(g)).map((g) => g.clone()));
  const windows = mergeParts(glass.map((g) => g.clone()));
  const next = mergeParts(parts);
  top!.setGeometry(next);
  preview!.setGeometry(land, windows);
  // The game's lamps on this island: harbour toward +z, as the builder's model is drawn.
  preview!.setLamps(
    {
      id: design.id,
      x: 0,
      y: 0,
      radius: R * ISLAND_SCALE,
      look: { design: design.id, harbourBearing: Math.PI, dock: harbour },
    },
    level,
  );
  for (const g of [geometry, previewLand, previewGlass]) g?.dispose();
  [geometry, previewLand, previewGlass] = [next, land, windows];
  $('ib-preview-title').textContent = `3D preview · level ${level}`;
}

const hulls = new Map<string, [number, number][]>();
/** A prop's plan outline where it stands, from its model (cached by everything but place). */
function hull(index: number): [number, number][] {
  const p = design.props[index]!;
  const key = JSON.stringify([
    p.type,
    p.turn,
    p.size,
    p.variant,
    p.shape,
    p.length,
    design.style,
    R,
  ]);
  let local = hulls.get(key);
  if (!local) {
    try {
      local = islandCheckKit(design, R, harbour).footprint!({ ...p, x: 0, z: 0 });
    } catch {
      local = [
        [-0.03, -0.03],
        [0.03, -0.03],
        [0.03, 0.03],
        [-0.03, 0.03],
      ];
    }
    hulls.set(key, local);
  }
  return local.map(([x, z]) => [x + p.x, z + p.z]);
}

let drop: { hull: [number, number][]; ok: boolean; label: string } | undefined;

function draw() {
  if (!open) return;
  const { width, height } = size();
  top!.resize(width, height);
  top!.render(view, R);
  // Props hidden or moved by the home state shown are not outlined (they are edited in Everything).
  const { from, moved } = displayed();
  const editable = new Set(from.filter((_, i) => !moved[i]));
  const { now, later } = propsAt(design, level);
  drawOverlay(svg, {
    spots: { list: design.homeSpots ?? [], selected: spotSel },
    design,
    harbour,
    level,
    view,
    width,
    height,
    now: now.filter((i) => editable.has(i)),
    later: showLater ? later.filter((i) => editable.has(i)) : [],
    showLater,
    outlines,
    selection,
    hull,
    issues,
    drop,
    mode,
    shape: shapeSel,
    drawing: drawing ? { points: drawing, hover } : undefined,
    brush:
      hover && (tool === 'grow' || tool === 'clear')
        ? { x: hover[0], z: hover[1], r: brush, mode: tool }
        : undefined,
  });
}

function drawPanel() {
  drawSelectionBar();
  if (mode === 'spots')
    return renderSpotPanel($('ib-panel'), {
      design,
      selected: spotSel,
      show: showHome,
      chosen,
      select: selectSpot,
      setShow: (show) => {
        showHome = show;
        commit(false);
      },
      setChosen: (spot, building) => {
        if (building) chosen[spot] = building;
        else delete chosen[spot];
        commit(false);
      },
      change: (edit) => {
        history.record(design);
        edit(design);
        commit();
      },
      remove: (index) => {
        history.record(design);
        deleteSpot(design, index);
        spotSel = null;
        commit();
      },
    });
  if (mode !== 'props')
    return renderShapePanel($('ib-panel'), {
      design,
      mode,
      shape: shapeSel,
      brush,
      setBrush: (r) => {
        brush = r;
        draw();
      },
      change: (edit) => {
        history.record(design);
        edit(design);
        commit();
      },
      remove: removeShape,
      heightAt,
    });
  renderIslandPanel($('ib-panel'), {
    design,
    selection,
    level,
    issues,
    triangles,
    thumbs,
    change: (edit) => {
      history.record(design);
      edit(design);
      commit();
    },
    select,
    duplicate,
    remove,
    groundOf,
  });
}

/** The ground's height at a point (the beach is 0), at the level shown. */
function heightAt(x: number, z: number) {
  return layoutGround(islandLayout(design, level), x, z, 0) ?? 0;
}

/** In portrait, the selected prop's quick actions above the palette (the mockup's card). */
function drawSelectionBar() {
  const bar = $('ib-selbar');
  bar.replaceChildren();
  const p = selection !== null && mode === 'props' ? design.props[selection] : undefined;
  bar.hidden = !p;
  if (!p) return;
  const img = document.createElement('img');
  img.src = thumbs[p.type] ?? '';
  img.alt = '';
  const text = document.createElement('div');
  text.innerHTML = '<b></b><small></small>';
  text.querySelector('b')!.textContent = propName(p.type);
  text.querySelector('small')!.textContent = `from level ${p.from} · ${groundOf(selection!)}`;
  bar.append(img, text);
  const action = (label: string, title: string, run: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.addEventListener('click', run);
    bar.append(b);
  };
  const turnBy = (deg: number) => () => {
    history.record(design);
    turnProp(design, selection!, (design.props[selection!]!.turn ?? 0) + deg);
    commit();
  };
  action('⟲', 'Turn 15° left', turnBy(-15));
  action('⟳', 'Turn 15° right', turnBy(15));
  action('⧉', 'Duplicate', duplicate);
  action('🗑', 'Delete', remove);
}

function groundOf(index: number) {
  const p = design.props[index]!;
  if (PROP_TYPES[p.type]?.water) return 'in the sea';
  if (p.y !== undefined) return `set at ${p.y}`;
  const layout = islandLayout(design, Math.max(level, p.from ?? 1));
  const h = layoutGround(layout, p.x, p.z, 0);
  if (h !== null) {
    const s = layout.surfaces.find((g) => g.height === h);
    const lowest = Math.min(...layout.surfaces.map((g) => g.height));
    if (s?.material === 'rock') return `on rock (height ${h})`;
    return h === lowest ? 'on the low ground' : `on raised ground (height ${h})`;
  }
  return layout.coasts.some((c) => coastDistance(p.x, p.z, c).distance < 0)
    ? 'on the sand'
    : 'off the island';
}

/** After any edit: a fresh copy (layout caches key on the object), save, rebuild, recheck. */
function commit(record = true) {
  design = structuredClone(design);
  useIslandDesign(design);
  if (selection !== null && !design.props[selection]) selection = null;
  if (spotSel !== null && !design.homeSpots?.[spotSel]) spotSel = null;
  if (shapeSel && !shapeExists(shapeSel.shape)) shapeSel = null;
  if (shapeSel?.point !== undefined && !pointsOf(design, shapeSel.shape)?.[shapeSel.point])
    delete shapeSel.point;
  const edited = !SHIPPED[design.id] || !sameDesign(design, SHIPPED[design.id]!);
  $('ib-edited').hidden = !edited;
  $<HTMLButtonElement>('ib-undo').disabled = !history.canUndo;
  $<HTMLButtonElement>('ib-redo').disabled = !history.canRedo;
  if (storage && record) {
    // Edited shipped files, and every file made here (the map refers to it).
    const drafts = Object.values(ISLAND_DESIGNS).filter(
      (d) => !SHIPPED[d.id] || !sameDesign(d, SHIPPED[d.id]!),
    );
    try {
      saveEditedIslands(storage, drafts);
    } catch {
      /* Private mode: the builder still works, Play this island then plays the shipped one. */
    }
  }
  rebuild();
  draw();
  drawPanel();
  runChecks();
}

function selectSpot(next: number | null) {
  spotSel = next;
  draw();
  drawPanel();
}

function select(next: number | null) {
  selection = next;
  draw();
  drawPanel();
}

function remove() {
  if (selection === null) return;
  history.record(design);
  deleteProp(design, selection);
  selection = null;
  commit();
}

function duplicate() {
  if (selection === null) return;
  history.record(design);
  selection = duplicateProp(design, selection);
  commit();
}

const shapeExists = (shape: Shape) =>
  shape.kind === 'coast'
    ? !!design.coasts[shape.index]
    : shape.kind === 'ground'
      ? !!design.ground[shape.index]
      : shape.kind === 'lake'
        ? !!design.lake
        : shape.kind === 'ramp'
          ? !!design.ramps?.[shape.index]
          : shape.kind === 'river'
            ? !!design.rivers?.[shape.index]
            : !!design.lanes[shape.index];

function removeShape() {
  if (!shapeSel) return;
  history.record(design);
  if (shapeSel.point !== undefined) {
    if (!deletePoint(design, shapeSel.shape, shapeSel.point)) history.discardIfSame(design);
    delete shapeSel.point;
  } else if (deleteShape(design, shapeSel.shape)) shapeSel = null;
  commit();
}

const TOOL_HINTS: Record<ShapeTool, string> = {
  plateau: 'Click the island to add raised ground there · Esc cancels',
  mountain: 'Click the island to add a mountain · Esc cancels',
  lake: 'Click the island to add the lake · Esc cancels',
  ramp: 'Click the foot of the ramp, then its bends, then its top; click the top again or press Enter · Esc cancels',
  grow: 'Paint where trees may grow · Esc stops',
  clear: 'Paint where trees are cleared · Esc stops',
  lane: 'Click to add bends; click the last point again or press Enter to finish · Esc cancels',
  path: 'Click to add bends; click the last point again or press Enter to finish · Esc cancels',
  stairs: 'Click the foot and the top of a cliff (and any bends); Enter finishes · Esc cancels',
  river:
    'Click the source, then bends down to the mouth (past the coast it falls into the sea); Enter finishes · Esc cancels',
  lava: 'Click the source, then bends down to the mouth (past the coast it steams in the sea); Enter finishes · Esc cancels',
};

function hint(text?: string) {
  $('ib-hint').textContent =
    text ??
    (tool
      ? TOOL_HINTS[tool]
      : mode === 'spots'
        ? 'Drag a spot to move it · pick its kind and what it shows in the panel · Delete removes it'
        : mode === 'ground'
          ? 'Click the coast, raised ground, a ramp, a mountain or the lake · drag a square to move a point, a ring to add one · click an edge: cliff ↔ slope · Delete removes'
          : mode === 'lanes'
            ? 'Click a lane or river to edit it · drag a square to move a point, a ring to add one · Delete removes'
            : armed
              ? `Click the island to place a ${propName(armed).toLowerCase()} from level ${level} · Esc cancels`
              : 'Drag a prop from the palette · drag props to move them · R / Shift+R turn 15° · Delete removes · a prop belongs to the level it first appears');
}

// --- Checks --------------------------------------------------------------------------------

let worker: Worker | null = null;
let checkId = 0;
let checkTimer = 0;

function runChecks() {
  checking = true;
  showChecks();
  clearTimeout(checkTimer);
  checkTimer = window.setTimeout(() => {
    worker?.terminate();
    worker = new Worker(new URL('./checks.worker.ts', import.meta.url), { type: 'module' });
    // The island as shown (a home state hides buildings); marks map back to the file's props.
    const { design: shown, from, moved } = displayed();
    const id = ++checkId;
    worker.addEventListener(
      'message',
      (e: MessageEvent<{ id: number; issues: IslandIssue[]; triangles: number[] }>) => {
        if (e.data.id !== checkId) return;
        issues = e.data.issues;
        for (const issue of issues)
          if (issue.prop !== undefined) {
            const index = from[issue.prop];
            // A plot's stakes are drawn, not in the file (-1).
            if (index === undefined || index < 0 || moved[issue.prop]) delete issue.prop;
            else issue.prop = index;
          }
        triangles = e.data.triangles;
        checking = false;
        worker?.terminate();
        worker = null;
        showChecks();
        draw();
        drawPanel();
      },
    );
    worker.postMessage({ id, design: shown, R, harbour });
  }, 400);
}

function showChecks() {
  const list = $('ib-checks');
  list.replaceChildren();
  const li = (cls: string, text: string, sub?: string) => {
    const item = document.createElement('li');
    item.className = cls;
    item.textContent = text;
    if (sub) {
      const small = document.createElement('small');
      small.textContent = sub;
      item.append(document.createElement('br'), small);
    }
    list.append(item);
    return item;
  };
  if (checking) li('pending', '⋯ checking the island');
  const has = (check: string) => issues.some((i) => i.check === check);
  if (!checking) {
    if (!has('land') && !has('water') && !has('cliff'))
      li('ok', '✓ every prop on its ground, none in the lake or on a cliff edge');
    if (!has('approach') && !has('pier')) li('ok', '✓ clear of the piers and the harbour approach');
    if (!has('growth')) li('ok', '✓ each level only adds: no home is removed');
  }
  for (const issue of issues) {
    const item = li(
      issue.severity,
      `${issue.severity === 'error' ? '✗' : '⚠'} ${issue.message}`,
      issue.level ? `level ${issue.level}` : undefined,
    );
    if (issue.prop !== undefined || issue.level !== undefined) {
      item.classList.add('link');
      item.addEventListener('click', () => {
        if (issue.level && issue.level !== level) setLevel(issue.level as Level);
        if (issue.prop !== undefined) select(issue.prop);
      });
    }
  }
  if (!checking && triangles.length && !has('budget'))
    li(
      'ok',
      `✓ 3D: ${triangles[TOP_LEVEL - 1]!.toLocaleString('en')} of ${TRIANGLE_BUDGET.toLocaleString('en')} triangles at level ${TOP_LEVEL}`,
    );
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  $('ib-tab-count').textContent = errors ? `✗${errors}` : warnings ? `⚠${warnings}` : '';
}

// --- Levels, palette and toggles -------------------------------------------------------------

function setLevel(next: Level) {
  level = next;
  drawLevels();
  rebuild();
  draw();
  drawPanel();
  hint();
}

function drawLevels() {
  const seg = $('ib-levels');
  seg.replaceChildren();
  for (const l of LEVELS) {
    const b = document.createElement('button');
    b.innerHTML = `<b>${l}</b> <span>${LEVEL_NAMES[l - 1]}</span>`;
    b.title = `Level ${l} (key ${l})`;
    b.setAttribute('aria-pressed', String(l === level));
    b.addEventListener('click', () => setLevel(l));
    seg.append(b);
  }
}

function drawPalette() {
  const groups = $('ib-groups');
  groups.replaceChildren();
  for (const [id, label] of GROUPS) {
    const b = document.createElement('button');
    b.textContent = label;
    b.setAttribute('aria-pressed', String(group === id));
    b.addEventListener('click', () => {
      group = id;
      drawPalette();
    });
    groups.append(b);
  }
  const query = $<HTMLInputElement>('ib-search').value.trim().toLowerCase();
  const tiles = $('ib-tiles');
  tiles.replaceChildren();
  let heading = '';
  for (const [type, def] of Object.entries(PROP_TYPES)) {
    if (group !== 'all' && def.group !== group) continue;
    if (query && !`${type} ${propName(type)}`.toLowerCase().includes(query)) continue;
    if (group === 'all' && def.group !== heading) {
      heading = def.group;
      const h = document.createElement('h3');
      h.textContent = GROUPS.find((g) => g[0] === def.group)![1];
      tiles.append(h);
    }
    const b = document.createElement('button');
    b.className = 'ib-tile';
    b.dataset.type = type;
    b.title = `${propName(type)}: drag onto the island, or tap it then tap the island`;
    b.setAttribute('aria-pressed', String(armed === type));
    const img = document.createElement('img');
    img.src = thumbs[type] ?? '';
    img.alt = '';
    img.draggable = false;
    const label = document.createElement('span');
    label.textContent = propName(type);
    b.append(img, label);
    b.addEventListener('pointerdown', (e) => startPaletteDrag(e, type));
    tiles.append(b);
  }
}
$('ib-search').addEventListener('input', drawPalette);

function arm(type: string | null) {
  armed = type;
  for (const b of $('ib-tiles').querySelectorAll<HTMLElement>('.ib-tile'))
    b.setAttribute('aria-pressed', String(b.dataset.type === armed));
  svg.classList.toggle('armed', !!armed);
  hint();
}

// --- Modes and the ground and lane tools ----------------------------------------------------

function setMode(next: Mode) {
  mode = next;
  setTool(null);
  shapeSel = null;
  if (mode !== 'props') {
    selection = null;
    arm(null);
  }
  for (const b of document.querySelectorAll<HTMLElement>('#ib-modes button, #ib-tabs [data-mode]'))
    b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  syncTabs();
  $('ib-prop-tools').hidden = mode !== 'props';
  $('ib-shape-tools').hidden = mode === 'props' || mode === 'spots';
  drawTools();
  draw();
  drawPanel();
  hint();
}
for (const b of $('ib-modes').querySelectorAll<HTMLElement>('button'))
  b.addEventListener('click', () => setMode(b.dataset.mode as Mode));

function setTool(next: ShapeTool | null) {
  tool = next;
  drawing = null;
  hover = undefined;
  svg.classList.toggle('tool', !!tool);
  for (const b of $('ib-shape-tools').querySelectorAll<HTMLElement>('.ib-tool'))
    b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  hint();
}

const TOOLS: Record<'ground' | 'lanes', [string, string | ShapeTool, string, string][]> = {
  ground: [
    ['Ground', 'coast', '🏝️', 'Coast: Drag a point, or a ring on an edge to add one'],
    ['Ground', 'plateau', '⛰️', 'Raised ground: A plateau or terrace, with cliff or slope edges'],
    ['Ground', 'mountain', '🗻', 'Mountain: A rocky peak'],
    ['Ground', 'lake', '💧', 'Lake: Inland water, kept clear of homes'],
    [
      'Ground',
      'ramp',
      '↗️',
      'Ramp: Draw its path; it climbs evenly from its start to its end height',
    ],
    ['Woods', 'grow', '🌲', 'Grow woods: Paint the woods; once painted, trees grow only there'],
    ['Woods', 'clear', '🪓', 'Clear trees: Paint where none grow'],
  ],
  lanes: [
    ['Lanes', 'lane', '〰️', 'Lane: Shows near the homes standing at each level'],
    ['Lanes', 'path', '┈', 'Path: Always shown'],
    ['Lanes', 'stairs', '🪜', 'Stairs: Climb a cliff between two ground levels'],
    ['Rivers', 'river', '🏞️', 'River: Water down the land, falls at cliffs and into the sea'],
    ['Rivers', 'lava', '🌋', 'Lava river: Glows at night, steams where it meets the sea'],
  ],
};

function drawTools() {
  const box = $('ib-shape-tools');
  box.replaceChildren();
  if (mode === 'props' || mode === 'spots') return;
  let heading = '';
  for (const [group, id, icon, text] of TOOLS[mode]) {
    if (group !== heading) {
      heading = group;
      const h = document.createElement('h3');
      h.textContent = group;
      box.append(h);
    }
    const [name, rest] = text.split(': ');
    const b = document.createElement('button');
    b.className = 'ib-tool';
    b.dataset.tool = id;
    b.innerHTML = '<span></span><span><b></b><small></small></span>';
    b.querySelector('span')!.textContent = icon;
    b.querySelector('b')!.textContent = name!;
    b.querySelector('small')!.textContent = rest!;
    if (id === 'lake' && design.lake) b.disabled = true;
    b.addEventListener('click', () => {
      if (id === 'coast') {
        setTool(null);
        selectShape({ kind: 'coast', index: 0 });
      } else setTool(tool === id ? null : (id as ShapeTool));
    });
    box.append(b);
  }
  setTool(tool);
}

/**
 * For `npm run shots -- --builder`: a tab and a shape picked as a click would, e.g. "lanes" and
 * "river:0" with point 2 (decision 0176).
 */
export function builderSelectForShots(tab: Mode, shape?: string, point?: number) {
  setMode(tab);
  if (!shape) return;
  const [kind, index] = shape.split(':');
  selectShape({ kind, index: Number(index) } as Shape, point);
}

function selectShape(next: Shape | null, point?: number) {
  shapeSel = next ? { shape: next, point } : null;
  draw();
  drawPanel();
}

/**
 * Ends the lane or ramp being drawn: two points or more make one. A ramp starts at the ground's
 * height at its foot and ends at the ground's height at its top.
 */
function finishDrawing() {
  const points = drawing;
  const kind = tool as 'lane' | 'path' | 'stairs' | 'ramp' | 'river' | 'lava';
  setTool(null);
  if (points && points.length >= 2) {
    history.record(design);
    if (kind === 'ramp') {
      const [x0, z0] = points[0]!,
        [x1, z1] = points[points.length - 1]!;
      const index = addRamp(design, points, heightAt(x0!, z0!), heightAt(x1!, z1!), placeLevel());
      shapeSel = { shape: { kind: 'ramp', index } };
    } else if (kind === 'river' || kind === 'lava') {
      const index = addRiver(design, kind === 'lava' ? 'lava' : 'water', points, placeLevel());
      shapeSel = { shape: { kind: 'river', index } };
    } else shapeSel = { shape: { kind: 'lane', index: addLane(design, kind, points) } };
    commit();
  } else draw();
}

/** A press on the island with the ground or lane tools out. */
function shapePointerDown(e: PointerEvent, x: number, z: number, kind: string, args: string[]) {
  if (tool === 'plateau' || tool === 'mountain' || tool === 'lake') {
    history.record(design);
    const under = heightAt(x, z);
    if (tool === 'lake') {
      if (addLake(design, x, z)) shapeSel = { shape: { kind: 'lake' } };
    } else {
      const add = tool === 'plateau' ? addPlateau : addMountain;
      shapeSel = { shape: { kind: 'ground', index: add(design, x, z, under, placeLevel()) } };
    }
    setTool(null);
    commit();
    drawTools();
    return;
  }
  if (tool === 'grow' || tool === 'clear') {
    history.record(design);
    paintWoods(design, x, z, brush, tool);
    drag = { kind: 'paint' };
    draw();
    return;
  }
  if (tool) {
    // Drawing a lane: a click on the last point finishes it.
    const last = drawing?.[drawing.length - 1];
    if (last && Math.hypot(last[0]! - x, last[1]! - z) < 10 * view.upp) return finishDrawing();
    drawing ??= [];
    drawing.push(tool === 'stairs' ? [x, z, heightAt(x, z)] : [x, z]);
    draw();
    return;
  }
  const sel = shapeSel;
  if (kind === 'pt' && sel) {
    history.record(design);
    sel.point = Number(args[0]);
    drag = { kind: 'point' };
    draw();
  } else if (kind === 'ins' && sel) {
    history.record(design);
    sel.point = insertPoint(design, sel.shape, Number(args[0]));
    drag = { kind: 'point' };
    draw();
  } else if (kind === 'edge' && sel?.shape.kind === 'ground') {
    history.record(design);
    toggleSlopeEdge(design, sel.shape.index, Number(args[0]));
    commit();
  } else if (kind === 'shape') {
    const [k, i] = args;
    selectShape(k === 'lake' ? { kind: 'lake' } : ({ kind: k, index: Number(i) } as Shape));
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, cx: view.cx, cz: view.cz };
  } else {
    if (shapeSel) selectShape(null);
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, cx: view.cx, cz: view.cz };
  }
}

const TOGGLES: [string, () => boolean, (v: boolean) => void][] = [
  ['Outlines', () => outlines, (v) => (outlines = v)],
];
for (const [label, get, set] of TOGGLES) {
  const b = document.createElement('button');
  b.textContent = label;
  b.setAttribute('aria-pressed', String(get()));
  b.addEventListener('click', () => {
    set(!get());
    b.setAttribute('aria-pressed', String(get()));
    draw();
  });
  $('ib-toggles').append(b);
}
$<HTMLInputElement>('ib-later').addEventListener('change', (e) => {
  showLater = (e.target as HTMLInputElement).checked;
  draw();
});

// --- Pointer: props, the turn handle, the palette, pan and zoom ----------------------------

type Drag =
  | { kind: 'prop'; index: number; dx: number; dz: number; sx: number; sy: number; moved: boolean }
  | { kind: 'turn'; index: number }
  | { kind: 'point' }
  | { kind: 'spot'; index: number; dx: number; dz: number }
  | { kind: 'paint' }
  | { kind: 'pan'; sx: number; sy: number; cx: number; cz: number };
let drag: Drag | null = null;
const pointers = new Map<number, { x: number; y: number }>();
let pinch: { distance: number; upp: number } | null = null;

function toIsland(e: { clientX: number; clientY: number }) {
  const rect = svg.getBoundingClientRect();
  return {
    x: view.cx + (e.clientX - rect.left - rect.width / 2) * view.upp,
    z: view.cz + (e.clientY - rect.top - rect.height / 2) * view.upp,
  };
}

/** Shows a prop's own model where it is being moved or dropped. */
function showMoving(index: number | null, type?: string, x = 0, z = 0) {
  if (index === null && !type) {
    top!.setMoving(null);
    return;
  }
  const p = index !== null ? design.props[index]! : newProp(design, type!, x, z, placeLevel());
  const scale = PROP_TYPES[p.type]!.sizedInModel ? 1 : (p.size ?? 1);
  top!.setMoving(propParts(p, design, R), 0, 0, 0, 0, scale);
  placeMoving(p, p.x, p.z);
}
function placeMoving(p: { turn?: number; y?: number; type: string }, x: number, z: number) {
  const layout = islandLayout(design, level);
  const y = p.y !== undefined ? p.y * R : standHeight(layout, x, z, R);
  top!.placeMoving(x * R, y + 0.05, z * R, ((p.turn ?? 0) * Math.PI) / 180);
}

/** A quick fit test for a prop being dropped: on land (or in the sea for boats). */
function fits(type: string, x: number, z: number) {
  const layout = islandLayout(design, level);
  const p = newProp(design, type, x, z, placeLevel());
  let fit = 0.05;
  try {
    fit = islandCheckKit(design, R, harbour).fit(p);
  } catch {
    /* Unknown models fit nowhere: the checks say why. */
  }
  const land = Math.max(...layout.coasts.map((c) => -coastDistance(x, z, c).distance));
  if (PROP_TYPES[type]?.water) return land < -fit;
  if (layout.lake && coastDistance(x, z, layout.lake).distance < fit) return false;
  if (layoutGround(layout, x, z, 0) === null)
    return land > 0 && !!PROP_TYPES[type]?.edge ? true : land > 0;
  return layoutGround(layout, x, z, fit) !== null;
}

function setDrop(type: string, x: number, z: number) {
  const p = newProp(design, type, x, z, placeLevel());
  const hullAt = (() => {
    try {
      return islandCheckKit(design, R, harbour).footprint!({ ...p, x: 0, z: 0 }).map(
        ([hx, hz]): [number, number] => [hx + x, hz + z],
      );
    } catch {
      return [
        [x - 0.03, z - 0.03],
        [x + 0.03, z - 0.03],
        [x + 0.03, z + 0.03],
        [x - 0.03, z + 0.03],
      ] as [number, number][];
    }
  })();
  const ok = fits(type, x, z);
  drop = {
    hull: hullAt,
    ok,
    label: `${propName(type)} · from level ${level}${ok ? '' : ' · does not fit here'}`,
  };
}

function place(type: string, x: number, z: number) {
  history.record(design);
  selection = addProp(design, newProp(design, type, x, z, level, !!PROP_TYPES[type]?.home));
  commit();
}

let paletteDrag: { type: string; sx: number; sy: number; moved: boolean } | null = null;
function startPaletteDrag(e: PointerEvent, type: string) {
  if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') {
    // Touch: a tap arms the prop (the palette keeps scrolling); a tap on the island drops it.
    return void (e.currentTarget as HTMLElement).addEventListener(
      'click',
      () => arm(armed === type ? null : type),
      { once: true },
    );
  }
  if (e.button !== 0) return;
  e.preventDefault();
  paletteDrag = { type, sx: e.clientX, sy: e.clientY, moved: false };
}
document.addEventListener('pointermove', (e) => {
  if (!paletteDrag) return;
  if (!paletteDrag.moved && Math.hypot(e.clientX - paletteDrag.sx, e.clientY - paletteDrag.sy) < 5)
    return;
  if (!paletteDrag.moved) {
    paletteDrag.moved = true;
    arm(null);
  }
  const rect = svg.getBoundingClientRect();
  const over =
    e.clientX > rect.left &&
    e.clientX < rect.right &&
    e.clientY > rect.top &&
    e.clientY < rect.bottom;
  if (!over) {
    drop = undefined;
    showMoving(null);
  } else {
    const p = toIsland(e);
    if (!drop) showMoving(null, paletteDrag.type, p.x, p.z);
    else placeMoving({ type: paletteDrag.type }, p.x, p.z);
    setDrop(paletteDrag.type, p.x, p.z);
  }
  draw();
});
document.addEventListener('pointerup', (e) => {
  if (!paletteDrag) return;
  const was = paletteDrag;
  paletteDrag = null;
  showMoving(null);
  const dropped = drop;
  drop = undefined;
  if (!was.moved) return arm(armed === was.type ? null : was.type);
  if (dropped) {
    const p = toIsland(e);
    place(was.type, p.x, p.z);
  } else draw();
});

svg.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  svg.focus();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  svg.setPointerCapture(e.pointerId);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { distance: Math.hypot(a!.x - b!.x, a!.y - b!.y), upp: view.upp };
    if (drag?.kind === 'prop' && drag.moved) {
      showMoving(null);
      history.discardIfSame(design);
      rebuild();
    }
    drag = null;
    return;
  }
  const p = toIsland(e);
  const hit = (e.target as Element).closest('[data-hit]')?.getAttribute('data-hit') ?? 'sea';
  const [kind, arg, ...more] = hit.split(':');
  if (mode === 'spots') {
    if (kind === 'spot') {
      const index = Number(arg);
      const spot = design.homeSpots![index]!;
      if (spotSel !== index) selectSpot(index);
      history.record(design);
      drag = { kind: 'spot', index, dx: spot.x - p.x, dz: spot.z - p.z };
    } else {
      if (spotSel !== null) selectSpot(null);
      drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, cx: view.cx, cz: view.cz };
    }
    return;
  }
  if (mode !== 'props') return shapePointerDown(e, p.x, p.z, kind!, [arg ?? '', ...more]);
  if (armed) {
    const type = armed;
    arm(null);
    place(type, p.x, p.z);
    return;
  }
  if (kind === 'prop') {
    const index = Number(arg);
    const prop = design.props[index]!;
    if (selection !== index) select(index);
    drag = {
      kind: 'prop',
      index,
      dx: prop.x - p.x,
      dz: prop.z - p.z,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
    };
  } else if (kind === 'turn' && selection !== null) {
    history.record(design);
    drag = { kind: 'turn', index: selection };
  } else {
    if (selection !== null) select(null);
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, cx: view.cx, cz: view.cz };
  }
});

svg.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) {
    // Hovering: the lane being drawn follows the pointer, and so does the woods brush.
    if (drawing || tool === 'grow' || tool === 'clear') {
      const p = toIsland(e);
      hover = [p.x, p.z];
      draw();
    }
    return;
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    view.upp = clampZoom((pinch.upp * pinch.distance) / Math.max(1, d));
    fitted = false;
    draw();
    return;
  }
  if (!drag) return;
  const p = toIsland(e);
  if (drag.kind === 'pan') {
    fitted = false;
    view.cx = drag.cx - (e.clientX - drag.sx) * view.upp;
    view.cz = drag.cz - (e.clientY - drag.sy) * view.upp;
    draw();
  } else if (drag.kind === 'prop') {
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.moved = true;
      history.record(design);
      showMoving(drag.index);
      // The island without the prop, so it does not show twice while it moves.
      const index = drag.index;
      setTimeout(() => drag?.kind === 'prop' && drag.index === index && (rebuild(index), draw()));
    }
    moveProp(design, drag.index, p.x + drag.dx, p.z + drag.dz);
    const prop = design.props[drag.index]!;
    placeMoving(prop, prop.x, prop.z);
    draw();
  } else if (drag.kind === 'point' && shapeSel?.point !== undefined) {
    const stairs = shapeSel.shape.kind === 'lane';
    movePoint(
      design,
      shapeSel.shape,
      shapeSel.point,
      p.x,
      p.z,
      stairs ? heightAt(p.x, p.z) : undefined,
    );
    draw();
  } else if (drag.kind === 'spot') {
    moveSpot(design, drag.index, p.x + drag.dx, p.z + drag.dz);
    draw();
  } else if (drag.kind === 'paint' && (tool === 'grow' || tool === 'clear')) {
    hover = [p.x, p.z];
    paintWoods(design, p.x, p.z, brush, tool);
    draw();
  } else if (drag.kind === 'turn') {
    const prop = design.props[drag.index]!;
    let deg = (Math.atan2(p.x - prop.x, p.z - prop.z) * 180) / Math.PI;
    deg = e.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
    turnProp(design, drag.index, deg);
    draw();
  }
});

function endPointer(e: PointerEvent) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (!drag) return;
  const was = drag;
  drag = null;
  if (was.kind === 'pan' || (was.kind === 'prop' && !was.moved)) return;
  showMoving(null);
  history.discardIfSame(design);
  commit();
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);

const clampZoom = (upp: number) => Math.min(0.05, Math.max(0.0008, upp));
function zoom(factor: number, at?: { x: number; z: number }) {
  const p = at ?? { x: view.cx, z: view.cz };
  const upp = clampZoom(view.upp * factor);
  const k = upp / view.upp;
  fitted = false;
  view.cx = p.x - (p.x - view.cx) * k;
  view.cz = p.z - (p.z - view.cz) * k;
  view.upp = upp;
  draw();
}
svg.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    zoom(Math.exp(e.deltaY * 0.0015), toIsland(e));
  },
  { passive: false },
);
$('ib-zoom-in').addEventListener('click', () => zoom(1 / 1.4));
$('ib-zoom-out').addEventListener('click', () => zoom(1.4));
$('ib-zoom-fit').addEventListener('click', () => {
  fit();
  draw();
});

// --- Keyboard ------------------------------------------------------------------------------

function nudge(dx: number, dz: number) {
  if (selection === null) return;
  history.record(design);
  const p = design.props[selection]!;
  moveProp(design, selection, p.x + dx, p.z + dz);
  commit();
}

document.addEventListener('keydown', (e) => {
  if (!open) return;
  const target = e.target as HTMLElement;
  if (target.closest('input, select, textarea')) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (mod && key === 'y') {
    e.preventDefault();
    redo();
  } else if (mod && key === 'd') {
    e.preventDefault();
    duplicate();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    if (mode === 'props') remove();
    else if (mode === 'spots') {
      if (spotSel !== null) {
        history.record(design);
        deleteSpot(design, spotSel);
        spotSel = null;
        commit();
      }
    } else removeShape();
  } else if (e.key === 'Enter' && drawing) {
    finishDrawing();
  } else if (e.key === 'Escape') {
    if (previewBig) expandPreview(false);
    else if (tool) {
      setTool(null);
      draw();
    } else if (shapeSel) selectShape(null);
    else if (armed) arm(null);
    else if (selection !== null) select(null);
    else close();
  } else if (key === 'r' && !mod && selection !== null) {
    history.record(design);
    turnProp(design, selection, (design.props[selection]!.turn ?? 0) + (e.shiftKey ? -15 : 15));
    commit();
  } else if (LEVELS.map(String).includes(e.key) && !mod) {
    setLevel(Number(e.key) as Level);
  } else if (e.key.startsWith('Arrow') && selection !== null) {
    e.preventDefault();
    const step = e.shiftKey ? 0.05 : 0.005;
    const [dx, dz] = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[e.key] ?? [0, 0];
    nudge(dx!, dz!);
  }
});

// --- Top bar -------------------------------------------------------------------------------

function replaceDesign(next: IslandDesign) {
  design = next;
  if (selection !== null && !design.props[selection]) selection = null;
  commit();
}
function undo() {
  const prior = history.undo(design);
  if (prior) replaceDesign(prior);
}
function redo() {
  const next = history.redo(design);
  if (next) replaceDesign(next);
}
$('ib-undo').addEventListener('click', undo);
$('ib-redo').addEventListener('click', redo);
$('ib-back').addEventListener('click', close);
$('ib-reset').addEventListener('click', () => {
  const made = !SHIPPED[design.id];
  const to = made ? 'the island as it was made' : 'the shipped island';
  if (!confirm(`Throw away your edits to ${design.name} and go back to ${to}?`)) return;
  history.record(design);
  selection = null;
  replaceDesign(structuredClone(original(design.id)!));
});
$('ib-export').addEventListener('click', () => {
  const blob = new Blob([formatIslandJson(tidyDesign(design))], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${design.id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('ib-play').addEventListener('click', () => {
  window.open('./?map=edited', 'fwt-playtest');
});
const input = $<HTMLInputElement>('ib-input');
$('ib-import').addEventListener('click', () => input.click());
input.addEventListener('change', async () => {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const raw: unknown = JSON.parse(await file.text());
    if (!isIslandShape(raw)) throw new Error('not an island');
    if (
      raw.id !== design.id &&
      !confirm(`${file.name} is the island "${raw.id}". Load it as ${design.name} (${design.id})?`)
    )
      return;
    history.record(design);
    selection = null;
    replaceDesign({ ...raw, id: design.id });
  } catch {
    alert(`${file.name} is not an island file.`);
  }
});

// --- Layout: the preview moves into the island's corner in portrait; tabs pick the panel --------

const portrait = window.matchMedia('(max-width: 900px), (orientation: portrait)');
function placePreview() {
  const slot = $(portrait.matches ? 'ib-preview-corner' : 'ib-preview-side');
  if ($('ib-preview').parentElement !== slot) slot.append($('ib-preview'));
  preview?.render();
}
portrait.addEventListener('change', () => {
  placePreview();
  if (open) {
    if (fitted) fit();
    draw();
  }
});
function syncTabs() {
  const tab = (document.querySelector('.ib-main') as HTMLElement).dataset.tab;
  for (const b of $('ib-tabs').querySelectorAll<HTMLElement>('button'))
    b.setAttribute(
      'aria-pressed',
      String(b.dataset.tab === tab && (!b.dataset.mode || b.dataset.mode === mode)),
    );
}
for (const b of $('ib-tabs').querySelectorAll<HTMLElement>('button'))
  b.addEventListener('click', () => {
    (document.querySelector('.ib-main') as HTMLElement).dataset.tab = b.dataset.tab!;
    if (b.dataset.mode && b.dataset.mode !== mode) setMode(b.dataset.mode as Mode);
    syncTabs();
    preview?.render();
  });

// --- 3D preview: bigger view and night ---------------------------------------------------------
let previewBig = false;
function expandPreview(big: boolean) {
  previewBig = big;
  $('ib-preview').classList.toggle('big', big);
  $('ib-expand').textContent = big ? '✕' : '⤢';
  $('ib-expand').title = big ? 'Back to the small view (Esc)' : 'Bigger 3D view (Esc closes)';
  $('ib-reset-view').hidden = !big;
  $('ib-preview-hint').textContent = big
    ? 'drag to turn and tilt · wheel or pinch to zoom'
    : 'drag to turn';
  if (!big) preview?.resetView();
  else preview?.render();
}
$('ib-expand').addEventListener('click', () => expandPreview(!previewBig));
$('ib-reset-view').addEventListener('click', () => preview?.resetView());
$('ib-night').addEventListener('click', () => {
  if (!preview) return;
  preview.setNight(!preview.night);
  $('ib-night').textContent = preview.night ? '☀ Day' : '☾ Night';
  $('ib-night').setAttribute('aria-pressed', String(preview.night));
  $('ib-night').title = preview.night ? 'See the island by day' : 'See the island at night';
});
new ResizeObserver(() => preview?.render()).observe($('ib-preview'));

new ResizeObserver(() => {
  if (!open) return;
  if (fitted) fit();
  draw();
  preview?.render();
}).observe(viewBox);

hint();
