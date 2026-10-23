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
  type Level,
  addProp,
  deleteProp,
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
let level: Level = 4;
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
const view: IslandView = { cx: 0, cz: 0, upp: 0.01 };
let fitted = true;

const svg = $<SVGSVGElement>('ib-svg');
const canvas = $<HTMLCanvasElement>('ib-canvas');
const viewBox = $('ib-view');
let top: TopView | null = null;
let preview: Preview | null = null;
let geometry: THREE.BufferGeometry | null = null;

export const islandOpen = () => open;

export function setupIslandBuilder(h: Host) {
  host = h;
}

/** Opens the builder on a port island of the map (its file id is `look.design`). */
export function openIsland(target: IslandDef) {
  const id = target.look?.design;
  if (!id || !ISLAND_DESIGNS[id]) return;

  design = structuredClone(ISLAND_DESIGNS[id]!);
  R = target.radius / ISLAND_SCALE;
  selection = null;
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
  placePreview();
  fit();
  commit(false);
  svg.focus();
}

function close() {
  open = false;
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

/** Builds the island at the level and shows it in both views. */
function rebuild(without?: number) {
  let parts;
  try {
    const shown =
      without === undefined
        ? design
        : { ...design, props: design.props.filter((_, i) => i !== without) };
    parts = designedTownParts(shown, R, level as TownLevel);
  } catch (error) {
    hint(`The island does not build: ${String(error)}`);
    return;
  }
  const next = mergeParts(parts);
  top!.setGeometry(next);
  preview!.setGeometry(next);
  geometry?.dispose();
  geometry = next;
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
      local = islandCheckKit(design, R).footprint!({ ...p, x: 0, z: 0 });
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
  const { now, later } = propsAt(design, level);
  drawOverlay(svg, {
    design,
    level,
    view,
    width,
    height,
    now,
    later: showLater ? later : [],
    showLater,
    outlines,
    selection,
    hull,
    issues,
    drop,
  });
}

function drawPanel() {
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
  drawSelectionBar();
}

/** In portrait, the selected prop's quick actions above the palette (the mockup's card). */
function drawSelectionBar() {
  const bar = $('ib-selbar');
  bar.replaceChildren();
  const p = selection !== null ? design.props[selection] : undefined;
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
  const edited = !sameDesign(design, SHIPPED[design.id]!);
  $('ib-edited').hidden = !edited;
  $<HTMLButtonElement>('ib-undo').disabled = !history.canUndo;
  $<HTMLButtonElement>('ib-redo').disabled = !history.canRedo;
  if (storage && record) {
    const drafts = Object.values(ISLAND_DESIGNS).filter(
      (d) => SHIPPED[d.id] && !sameDesign(d, SHIPPED[d.id]!),
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

function hint(text?: string) {
  $('ib-hint').textContent =
    text ??
    (armed
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
    const id = ++checkId;
    worker.addEventListener(
      'message',
      (e: MessageEvent<{ id: number; issues: IslandIssue[]; triangles: number[] }>) => {
        if (e.data.id !== checkId) return;
        issues = e.data.issues;
        triangles = e.data.triangles;
        checking = false;
        worker?.terminate();
        worker = null;
        showChecks();
        draw();
        drawPanel();
      },
    );
    worker.postMessage({ id, design, R });
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
      `✓ 3D: ${triangles[3]!.toLocaleString('en')} of ${TRIANGLE_BUDGET.toLocaleString('en')} triangles at level 4`,
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
  for (const l of [1, 2, 3, 4] as const) {
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
  const p = index !== null ? design.props[index]! : newProp(design, type!, x, z, level);
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
  const p = newProp(design, type, x, z, level);
  let fit = 0.05;
  try {
    fit = islandCheckKit(design, R).fit(p);
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
  const p = newProp(design, type, x, z, level);
  const hullAt = (() => {
    try {
      return islandCheckKit(design, R).footprint!({ ...p, x: 0, z: 0 }).map(
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
  const [kind, arg] = hit.split(':');
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
  if (!pointers.has(e.pointerId)) return;
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
    remove();
  } else if (e.key === 'Escape') {
    if (armed) arm(null);
    else if (selection !== null) select(null);
    else close();
  } else if (key === 'r' && !mod && selection !== null) {
    history.record(design);
    turnProp(design, selection, (design.props[selection]!.turn ?? 0) + (e.shiftKey ? -15 : 15));
    commit();
  } else if (['1', '2', '3', '4'].includes(e.key) && !mod) {
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
  if (!confirm(`Throw away your edits to ${design.name} and go back to the shipped island?`))
    return;
  history.record(design);
  selection = null;
  replaceDesign(structuredClone(SHIPPED[design.id]!));
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
for (const b of $('ib-tabs').querySelectorAll<HTMLElement>('button'))
  b.addEventListener('click', () => {
    (document.querySelector('.ib-main') as HTMLElement).dataset.tab = b.dataset.tab!;
    preview?.render();
  });

new ResizeObserver(() => {
  if (!open) return;
  if (fitted) fit();
  draw();
  preview?.render();
}).observe(viewBox);

hint();
