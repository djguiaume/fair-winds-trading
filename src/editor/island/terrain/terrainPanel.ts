import './terrain.css';
import depthView from '../../../data/depth-view.json';
import type { SculptOp } from '../../../data/islands';
import {
  LANGUAGES,
  language,
  setLanguage,
  t,
  type LanguageId,
  type MessageKey,
} from '../../../i18n';
import { TERRAIN_TOOLS, brushRanges, strengthKey } from './brush';
import type { TerrainTool } from './terrainTool';

/**
 * The island builder's Terrain tab (issue #271): the five tools and the brush's size and strength
 * in the tool column (so a phone has them beside the island), the rest in the panel: the view,
 * the target height, terrace protection, the strokes saved, warnings and Reset. All text is in
 * `en.json` / `fr.json` and a switch changes language, since the builder's own labels are English.
 */
const ICONS: Record<SculptOp, string> = {
  raise: '⛰️',
  lower: '🕳️',
  flatten: '▭',
  smooth: '〰️',
  slope: '◢',
};

type Props = Record<string, string | boolean | number>;
function node<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  props: Props = {},
): HTMLElementTagNameMap[K] {
  const el = Object.assign(document.createElement(tag), props);
  parent.append(el);
  return el;
}

/** A labelled slider whose number shows beside it; `set` gets each value as it is dragged. */
function slider(
  parent: HTMLElement,
  label: string,
  range: { min: number; max: number; step: number },
  value: number,
  show: (v: number) => string,
  set: (v: number) => void,
) {
  const row = node(parent, 'label', { className: 'ed-row' });
  node(row, 'span', { textContent: label });
  // Range first, then the value: a slider clamps the value to the range it has when it is set.
  const input = node(row, 'input', {
    type: 'range',
    min: String(range.min),
    max: String(range.max),
    step: String(range.step),
  });
  input.value = String(value);
  const out = node(row, 'output', { textContent: show(value) });
  input.addEventListener('input', () => {
    out.textContent = show(input.valueAsNumber);
    set(input.valueAsNumber);
  });
}

/** The tool buttons, and the size and strength of the brush, in the tool column. */
export function renderTerrainTools(box: HTMLElement, tool: TerrainTool) {
  box.replaceChildren();
  const { brush } = tool;
  const heading = node(box, 'h3', { textContent: t('editor.terrain.tab') });
  heading.title = t('editor.terrain.tabHint');
  const tools = node(box, 'div', { className: 'ib-terrain-tools' });
  for (const op of TERRAIN_TOOLS) {
    const b = node(tools, 'button', { className: 'ib-tool' });
    b.dataset.tool = op;
    b.setAttribute('aria-pressed', String(brush.tool === op));
    b.innerHTML = '<span></span><span><b></b><small></small></span>';
    b.querySelector('span')!.textContent = ICONS[op];
    b.querySelector('b')!.textContent = t(`editor.terrain.tool.${op}` as MessageKey);
    b.querySelector('small')!.textContent = t(`editor.terrain.hint.${op}` as MessageKey);
    b.addEventListener('click', () => {
      tool.set({ tool: op });
      tool.picking = false;
      tool.cancel();
      renderTerrainTools(box, tool);
      tool.refreshPanel();
    });
  }
  const { radius, raise, share, falloff } = brushRanges();
  const unit = tool.unit;
  const world = (v: number) => t('editor.terrain.units', { value: (v * unit).toFixed(1) });
  const settings = node(box, 'div', { className: 'ib-terrain-settings' });
  slider(settings, t('editor.terrain.size'), radius, brush.radius, world, (v) =>
    tool.set({ radius: v }),
  );
  const key = strengthKey(brush.tool);
  slider(
    settings,
    t('editor.terrain.strength'),
    key === 'lift' ? raise : share,
    brush[key],
    key === 'lift'
      ? (v) => t('editor.terrain.units', { value: (v * unit).toFixed(2) })
      : (v) => `${Math.round(v * 100)}%`,
    (v) => tool.set({ [key]: v }),
  );
  slider(
    settings,
    t('editor.terrain.soft'),
    falloff,
    brush.falloff,
    (v) => `${Math.round(v * 100)}%`,
    (v) => tool.set({ falloff: v }),
  );
}

/** The panel beside the island: view, target, protection, strokes, warnings, reset, language. */
export function renderTerrainPanel(
  root: HTMLElement,
  tool: TerrainTool,
  host: { reset(): void; setView(view: 'ground' | 'depth'): void; language(id: LanguageId): void },
) {
  root.replaceChildren();
  const { brush } = tool;

  const view = node(root, 'div', { className: 'ed-row' });
  node(view, 'span', { textContent: t('editor.terrain.view') });
  const seg = node(view, 'div', { className: 'ib-seg small' });
  for (const id of ['ground', 'depth'] as const) {
    const b = node(seg, 'button', { textContent: t(`editor.terrain.view.${id}` as MessageKey) });
    b.setAttribute('aria-pressed', String(tool.view === id));
    b.addEventListener('click', () => host.setView(id));
  }
  if (tool.view === 'depth') legend(root);

  if (brush.tool === 'flatten' || brush.tool === 'slope') target(root, tool);

  const protect = node(root, 'label', { className: 'ed-row ib-row-check' });
  const check = node(protect, 'input', { type: 'checkbox', checked: !brush.override });
  node(protect, 'span', { textContent: t('editor.terrain.protect') });
  protect.title = t('editor.terrain.protectHint');
  check.addEventListener('change', () => tool.set({ override: !check.checked }));

  node(root, 'p', {
    className: 'ed-note',
    textContent: tool.strokes
      ? t('editor.terrain.strokes', { n: tool.strokes })
      : t('editor.terrain.noStrokes'),
  });
  if (tool.full) node(root, 'p', { className: 'ed-note', textContent: t('editor.terrain.full') });
  warnings(root, tool);
  const actions = node(root, 'div', { className: 'ed-row' });
  const cancel = node(actions, 'button', { textContent: t('editor.terrain.cancel') });
  cancel.disabled = !tool.stroking;
  cancel.addEventListener('click', () => tool.cancel());
  const reset = node(actions, 'button', { textContent: t('editor.terrain.reset') });
  reset.disabled = !tool.strokes;
  reset.addEventListener('click', host.reset);

  node(root, 'p', { className: 'ed-note', textContent: t('editor.terrain.help') });
  const lang = node(root, 'div', { className: 'ed-row' });
  node(lang, 'span', { textContent: t('editor.terrain.language') });
  const langs = node(lang, 'div', { className: 'ib-seg small' });
  for (const l of LANGUAGES) {
    const b = node(langs, 'button', { textContent: l.id.toUpperCase(), title: l.name });
    b.setAttribute('aria-pressed', String(language() === l.id));
    b.addEventListener('click', () => {
      setLanguage(l.id);
      host.language(l.id);
    });
  }
}

/** The target height of flatten, or the top of a slope: typed, picked from the ground, or auto. */
function target(root: HTMLElement, tool: TerrainTool) {
  const { brush } = tool;
  const { height } = brushRanges();
  const row = node(root, 'div', { className: 'ed-row ib-row-target' });
  node(row, 'span', {
    textContent: t(brush.tool === 'slope' ? 'editor.terrain.targetEnd' : 'editor.terrain.target'),
  });
  const input = node(row, 'input', {
    type: 'number',
    value: brush.height === null ? '' : (brush.height * tool.unit).toFixed(1),
    placeholder: t('editor.terrain.targetAuto'),
  });
  input.step = '0.5';
  input.min = String(height.min * tool.unit);
  input.max = String(height.max * tool.unit);
  input.addEventListener('change', () =>
    tool.set({ height: input.value === '' ? null : Number(input.value) / tool.unit }),
  );
  const pick = node(row, 'button', {
    textContent: '⌖',
    title: tool.picking ? t('editor.terrain.picking') : t('editor.terrain.pick'),
  });
  pick.setAttribute('aria-pressed', String(tool.picking));
  pick.addEventListener('click', () => {
    tool.picking = !tool.picking;
    tool.refreshPanel();
  });
  if (tool.picking)
    node(root, 'p', { className: 'ed-note', textContent: t('editor.terrain.picking') });
}

function legend(root: HTMLElement) {
  const box = node(root, 'div', { className: 'ib-depth-legend' });
  for (const band of depthView.bands) {
    const swatch = node(box, 'i');
    swatch.style.background = band.color;
  }
  node(root, 'p', { className: 'ed-note', textContent: t('editor.terrain.legend') });
}

function warnings(root: HTMLElement, tool: TerrainTool) {
  const list = node(root, 'ul', { className: 'ed-checks' });
  if (!tool.strokes) return;
  if (!tool.warnings.length) {
    node(list, 'li', { className: 'ok', textContent: `✓ ${t('editor.terrain.warn.none')}` });
    return;
  }
  for (const kind of ['coast-raised', 'coast-sunk', 'berth'] as const) {
    const n = tool.warnings.filter((w) => w.kind === kind).length;
    if (n)
      node(list, 'li', {
        className: 'warning',
        textContent: `⚠ ${t(`editor.terrain.warn.${kind}` as MessageKey, { n })}`,
      });
  }
}
