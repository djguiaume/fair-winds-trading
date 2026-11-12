import type { QuestPoint } from '../../sim/questLibrary';
import { addPlace, addQuestMark, getAt, round1, setAt, setStepMove } from './doc';
import { h } from './form';
import { addRaceStorm, moveRaceStorm, shapeRaceStorm } from './raceStormDoc';
import { TOOLS, drawChartView, drawnPlaces, layers, setTool, svg, zoom } from './chartView';
import { $, commit, edit, history, qb, quest, step } from './state';

/* The quest builder chart's tools, toggles and pointer: click to add, drag to move, pan, zoom. */

type Drag =
  | { kind: 'place'; i: number; dx: number; dy: number }
  | { kind: 'radius'; i: number }
  | { kind: 'storm'; i: number; dx: number; dy: number }
  | { kind: 'stormSize'; i: number }
  | { kind: 'pan'; sx: number; sy: number; cx: number; cy: number };
let drag: Drag | null = null;

export function setupChart() {
  setupToolbar();
  const el = svg();
  const { view } = qb;
  const toMap = (e: { clientX: number; clientY: number }) => {
    const rect = el.getBoundingClientRect();
    return {
      x: view.cx + (e.clientX - rect.left - rect.width / 2) * view.upp,
      y: view.cy - (e.clientY - rect.top - rect.height / 2) * view.upp,
    };
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    el.setPointerCapture(e.pointerId);
    const p = toMap(e);
    const hit = (e.target as Element).closest('[data-hit]')?.getAttribute('data-hit') ?? '';
    const [kind = '', n] = hit.split(':');
    pointerDown(p, kind, Number(n), e);
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.kind === 'pan') {
      view.cx = drag.cx - (e.clientX - drag.sx) * view.upp;
      view.cy = drag.cy + (e.clientY - drag.sy) * view.upp;
    } else dragTo(drag, toMap(e));
    drawChartView();
  });
  const end = () => {
    if (!drag) return;
    const was = drag;
    drag = null;
    if (was.kind === 'pan') return;
    history.discardIfSame(qb.doc);
    commit();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom(Math.exp(e.deltaY * 0.0015), toMap(e));
      drawChartView();
    },
    { passive: false },
  );
  setTool('select');
}

/** The tool buttons down the side, and the Names / All steps toggles. */
function setupToolbar() {
  const tools = $('.qb-tools');
  for (const [id, icon, label] of TOOLS) {
    const b = h('button', { type: 'button', title: label, 'aria-label': label }, icon);
    b.dataset.tool = id;
    b.addEventListener('click', () => setTool(qb.tool === id ? 'select' : id));
    tools.append(b);
  }
  const all = h('button', { type: 'button', 'aria-pressed': 'true' }, 'All steps');
  all.addEventListener('click', () => {
    qb.showAll = !qb.showAll;
    all.setAttribute('aria-pressed', String(qb.showAll));
    drawChartView();
  });
  const names = h('button', { type: 'button', 'aria-pressed': 'true' }, 'Names');
  names.addEventListener('click', () => {
    layers.names = !layers.names;
    names.setAttribute('aria-pressed', String(layers.names));
    drawChartView();
  });
  $('.qb-toggles').append(names, all);
}

/** A press on the chart at `p`, on the hit `kind:n` (or none): place with the tool, or start a drag. */
function pointerDown(p: QuestPoint, kind: string, n: number, e: PointerEvent) {
  const { tool, doc, view } = qb;
  const s = step();
  const q = quest();
  if (q && tool === 'buoy') {
    edit(() => addQuestMark(q, p));
    return;
  }
  if (q?.race && tool === 'storm') {
    edit(() => addRaceStorm(q, p));
    return;
  }
  const storm = q?.race?.storms?.[n];
  if (storm && (kind === 'qs' || kind === 'qz')) {
    history.record(doc);
    drag =
      kind === 'qs'
        ? { kind: 'storm', i: n, dx: storm.x - p.x, dy: storm.y - p.y }
        : { kind: 'stormSize', i: n };
    return;
  }
  if (s && tool !== 'select' && !kind.startsWith('q')) {
    if (tool === 'compass') edit(() => (s.compass = { x: round1(p.x), y: round1(p.y) }));
    else if (tool === 'move') edit(() => setStepMove(s, p));
    else {
      history.record(doc);
      if (addPlace(s, p.x, p.y)) commit();
      else {
        history.discardIfSame(doc);
        alert(
          'This step has no reach or timed goal to add a place to. Pick “reach” in its goal first.',
        );
      }
    }
    return;
  }
  if (s && kind === 'qp') {
    const place = drawnPlaces()[n]!;
    history.record(doc);
    drag = { kind: 'place', i: n, dx: place.x - p.x, dy: place.y - p.y };
  } else if (s && kind === 'qr') {
    history.record(doc);
    drag = { kind: 'radius', i: n };
  } else drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, cx: view.cx, cy: view.cy };
}

/** Moves or sizes what is dragged (a place or a race storm) to the pointer at `p`. */
function dragTo(d: Exclude<Drag, { kind: 'pan' }>, p: QuestPoint) {
  if (d.kind === 'storm' || d.kind === 'stormSize') {
    const q = quest()!;
    const at = q.race?.storms?.[d.i];
    if (!at) return;
    if (d.kind === 'storm') moveRaceStorm(q, d.i, { x: p.x + d.dx, y: p.y + d.dy });
    else shapeRaceStorm(q, d.i, { radius: Math.hypot(p.x - at.x, p.y - at.y) });
    return;
  }
  const s = step();
  const place = drawnPlaces()[d.i];
  if (!s || !place) return;
  if (d.kind === 'place') {
    const target = getAt(s, place.path) as QuestPoint;
    target.x = round1(p.x + d.dx);
    target.y = round1(p.y + d.dy);
  } else if (place.radiusPath)
    setAt(s, place.radiusPath, Math.max(1, Math.round(Math.hypot(p.x - place.x, p.y - place.y))));
}
