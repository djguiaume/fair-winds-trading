import { GAME_MAP } from '../../data/maps';
import { SHIP_FILES } from '../../data/ships';
import { WEATHER_KINDS } from '../../sim/wind';
import { History } from '../model';
import { h, row, select, textInput } from '../quest/form';
import {
  EDITED_FREE_KEY,
  type FreeSailingDoc,
  PRESET_FIELDS,
  addPreset,
  findPreset,
  freeProblems,
  isFreeDoc,
  presetField,
  presetFiles,
  presetText,
  removePreset,
  setPresetField,
  shippedFreeDoc,
} from './doc';

/**
 * The editors' Free Sailing page (decision 0266): every preset in `src/data/free-sailing/`, its
 * names, place (typed or clicked on the small chart), hour, weather and ship, with the same
 * checks and edits as `npm run free`. The working copy stays in this browser; Export gives the
 * chosen preset's file to commit.
 */

let root: HTMLElement;
let onClose = () => {};
let open = false;
let doc: FreeSailingDoc = loadDoc();
let chosen = doc.presets[0]?.id ?? '';
const history = new History<FreeSailingDoc>();
const docText = (d: FreeSailingDoc) =>
  presetFiles(d)
    .map((f) => f.text)
    .join('');

function loadDoc(): FreeSailingDoc {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(EDITED_FREE_KEY) ?? 'null');
    if (isFreeDoc(saved)) return saved;
  } catch {
    /* Nothing saved, or private mode. */
  }
  return shippedFreeDoc();
}

export const freeSailingOpen = () => open;

export function setupFreeSailingPage(close: () => void) {
  onClose = close;
  root = document.getElementById('fp')!;
  root.innerHTML = `
    <header class="ed-top">
      <h1>Free Sailing</h1>
      <span class="ed-file">src/data/free-sailing/ <span class="cp-edited" hidden>· ● edited</span></span>
      <nav class="ed-actions">
        <button data-act="back" title="Back to the map (Esc)">← Map</button>
        <button data-act="undo" title="Undo (Ctrl+Z)">↶ Undo</button>
        <button data-act="redo" title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
        <button data-act="add" title="A new preset, a copy of the chosen one">+ Preset</button>
        <button data-act="remove" title="Remove the chosen preset">Remove</button>
        <button data-act="reset" title="Back to the presets shipped with the game">Reset</button>
        <button data-act="export" class="primary">Export preset</button>
      </nav>
    </header>
    <main class="cp-main">
      <nav class="cp-sections"></nav>
      <section class="cp-form"></section>
      <aside class="cp-side"><h2>Checks</h2><ul class="ed-checks cp-checks"></ul></aside>
    </main>`;
  const acts: Record<string, () => void> = {
    back: closePage,
    undo,
    redo,
    add,
    remove,
    reset,
    export: exportPreset,
  };
  root.querySelector('.ed-actions')!.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.act;
    if (act) acts[act]?.();
  });
}

export function openFreeSailing() {
  open = true;
  document.getElementById('ed-top')!.hidden = true;
  document.getElementById('ed-main')!.hidden = true;
  root.hidden = false;
  render();
}

function closePage() {
  open = false;
  root.hidden = true;
  document.getElementById('ed-top')!.hidden = false;
  document.getElementById('ed-main')!.hidden = false;
  onClose();
}

// --- Edits ------------------------------------------------------------------------------------

function edit(change: () => void) {
  history.record(doc);
  change();
  commit();
}

function commit() {
  const edited = docText(doc) !== docText(shippedFreeDoc());
  try {
    if (edited) localStorage.setItem(EDITED_FREE_KEY, JSON.stringify(doc));
    else localStorage.removeItem(EDITED_FREE_KEY);
  } catch {
    /* Private mode: the edits last while the page is open. */
  }
  if (!findPreset(doc, chosen)) chosen = doc.presets[0]?.id ?? '';
  render();
}

function undo() {
  const prior = history.undo(doc);
  if (prior) {
    doc = prior;
    commit();
  }
}
function redo() {
  const next = history.redo(doc);
  if (next) {
    doc = next;
    commit();
  }
}
function add() {
  const id = prompt('Id of the new preset (lower-case, digits, -)')?.trim();
  if (!id) return;
  edit(() => {
    const made = addPreset(doc, id, chosen || undefined);
    if (typeof made === 'string') alert(made);
    else chosen = made.id;
  });
}
function remove() {
  if (!chosen || !confirm(`Remove the preset ${chosen}?`)) return;
  edit(() => removePreset(doc, chosen));
}
function reset() {
  if (!confirm('Throw away every Free Sailing edit and go back to the shipped presets?')) return;
  history.record(doc);
  doc = shippedFreeDoc();
  commit();
}

function exportPreset() {
  const preset = findPreset(doc, chosen);
  if (!preset) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([presetText(preset)], { type: 'application/json' }));
  a.download = `${preset.id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.addEventListener('keydown', (e) => {
  if (!open) return;
  if ((e.target as HTMLElement).closest('input, select, textarea')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (e.key === 'Escape') closePage();
});

// --- Drawing ----------------------------------------------------------------------------------

function render() {
  root.querySelector<HTMLElement>('.cp-edited')!.hidden =
    docText(doc) === docText(shippedFreeDoc());
  root.querySelector('.cp-sections')!.replaceChildren(
    ...doc.presets.map((p) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(p.id === chosen) }, p.id);
      b.addEventListener('click', () => {
        chosen = p.id;
        render();
      });
      return b;
    }),
  );
  const preset = findPreset(doc, chosen);
  root.querySelector('.cp-form')!.replaceChildren(...(preset ? drawPreset(chosen) : []));
  const problems = freeProblems(doc);
  root
    .querySelector('.cp-checks')!
    .replaceChildren(
      ...(problems.length
        ? problems.map((p) => h('li', { class: 'error' }, `✕ ${p}`))
        : [h('li', { class: 'ok' }, '✓ Every preset passes every check')]),
    );
}

/** The value lists of the fields that have one; the others are typed. */
const CHOICES: Record<string, string[]> = {
  weather: [...WEATHER_KINDS],
  'ship.class': SHIP_FILES.map((s) => s.id),
  'ship.sails': ['1', '2', '3'],
  'ship.hold': ['1', '2', '3'],
  'ship.hull': ['1', '2', '3'],
};

function drawPreset(id: string): Element[] {
  const preset = findPreset(doc, id)!;
  const set = (path: string) => (v: string) =>
    edit(() => {
      const problem = setPresetField(doc, id, path, v);
      if (problem) alert(problem);
    });
  const fields = Object.keys(PRESET_FIELDS).map((path) => {
    const value = presetField(preset, path);
    const input = CHOICES[path]
      ? select(CHOICES[path], value, set(path))
      : textInput(value, set(path));
    return row(path, input);
  });
  return [
    h(
      'div',
      { class: 'cp-head' },
      h('h2', {}, id),
      h('p', {}, 'Click the chart to move the start.'),
    ),
    chart(id),
    ...fields,
  ];
}

/** The game's sea as island discs, every preset's start, the chosen one's heading; click moves it. */
function chart(id: string): Element {
  const r = GAME_MAP.boundsRadius;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `${-r} ${-r} ${2 * r} ${2 * r}`);
  svg.setAttribute('class', 'fp-chart');
  const shapes = [
    `<circle r="${r}" fill="#2f6f8f"/>`,
    ...GAME_MAP.islands.map(
      (i) => `<circle cx="${i.x}" cy="${-i.y}" r="${i.radius}" fill="#d8c79a"/>`,
    ),
    ...doc.presets.map((p) => {
      const { x, y, headingDeg } = p.place;
      const a = (headingDeg * Math.PI) / 180;
      const mine = p.id === id;
      return `<g><circle cx="${x}" cy="${-y}" r="${mine ? 22 : 14}" fill="${mine ? '#f3d37e' : '#fffdf6'}" stroke="#123246" stroke-width="5"/>${mine ? `<line x1="${x}" y1="${-y}" x2="${x + Math.sin(a) * 60}" y2="${-y - Math.cos(a) * 60}" stroke="#123246" stroke-width="8"/>` : ''}</g>`;
    }),
  ];
  svg.innerHTML = shapes.join('');
  svg.addEventListener('click', (e) => {
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    const at = point.matrixTransform(svg.getScreenCTM()!.inverse());
    edit(() => {
      setPresetField(doc, id, 'place.x', String(Math.round(at.x)));
      setPresetField(doc, id, 'place.y', String(Math.round(-at.y)));
    });
  });
  return svg;
}
