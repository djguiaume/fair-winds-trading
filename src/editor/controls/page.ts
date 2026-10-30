import { PAD_AXES, PAD_BUTTONS } from '../../input/gamepad';
import { QUALITY_LEVELS, type QualityLevel } from '../../render/quality';
import { History } from '../model';
import { h, numberInput, row, select, textInput } from '../quest/form';
import {
  type ControlsDoc,
  EDITED_CONTROLS_KEY,
  PAD_PLACES,
  PLACE_NAMES,
  type PadPlace,
  controlsProblems,
  controlsText,
  isControlsDoc,
  padNumbers,
  placeFields,
  shippedControls,
  toggleButton,
} from './doc';
import './controls.css';

/**
 * The controls page of the editors (decision 0189): everything in `src/data/controls.json`, the
 * pad's numbers and which buttons do what in each place, TV mode and each pad maker's button
 * names, with the same checks as `npm run check -- --only controls`. The working copy stays in
 * this browser; Export gives the file to commit.
 */

type Section = 'pad' | PadPlace | 'tv' | 'brands';
const SECTIONS: [Section, string][] = [
  ['pad', 'Pad'],
  ...PAD_PLACES.map((p): [Section, string] => [p, PLACE_NAMES[p]]),
  ['tv', 'TV mode'],
  ['brands', 'Pad makers'],
];
/** Buttons an action can take: every standard button but Home, which the browser keeps. */
const ACTION_BUTTONS = PAD_BUTTONS.filter((b) => b !== 'home');
/** Languages a pad maker's names can be overridden in. */
const LANGS = ['fr'];

let root: HTMLElement;
let onClose = () => {};
let open = false;
let section: Section = 'pad';
let doc: ControlsDoc = loadDoc();
const history = new History<ControlsDoc>();

function loadDoc(): ControlsDoc {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(EDITED_CONTROLS_KEY) ?? 'null');
    if (isControlsDoc(saved)) return saved;
  } catch {
    /* Nothing saved, or private mode. */
  }
  return shippedControls();
}

export const controlsOpen = () => open;

export function setupControlsPage(close: () => void) {
  onClose = close;
  root = document.getElementById('cp')!;
  root.innerHTML = `
    <header class="ed-top">
      <h1>Controls</h1>
      <span class="ed-file">src/data/controls.json <span class="cp-edited" hidden>· ● edited</span></span>
      <nav class="ed-actions">
        <button data-act="back" title="Back to the map (Esc)">← Map</button>
        <button data-act="undo" title="Undo (Ctrl+Z)">↶ Undo</button>
        <button data-act="redo" title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
        <button data-act="reset" title="Back to the controls shipped with the game">Reset</button>
        <button data-act="export" class="primary">Export controls.json</button>
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
    reset,
    export: exportDoc,
  };
  root.querySelector('.ed-actions')!.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.act;
    if (act) acts[act]?.();
  });
}

export function openControls() {
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
  const edited = controlsText(doc) !== controlsText(shippedControls());
  try {
    if (edited) localStorage.setItem(EDITED_CONTROLS_KEY, JSON.stringify(doc));
    else localStorage.removeItem(EDITED_CONTROLS_KEY);
  } catch {
    /* Private mode: the edits last while the page is open. */
  }
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
function reset() {
  if (!confirm('Throw away every controls edit and go back to the shipped file?')) return;
  history.record(doc);
  doc = shippedControls();
  commit();
}

function exportDoc() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([controlsText(doc)], { type: 'application/json' }));
  a.download = 'controls.json';
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
  } else if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
  } else if (e.key === 'Escape') closePage();
});

// --- Drawing ----------------------------------------------------------------------------------

/** "panPxPerSec" → "pan px per sec": the file's names, readable. */
const words = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

function render() {
  const edited = controlsText(doc) !== controlsText(shippedControls());
  root.querySelector<HTMLElement>('.cp-edited')!.hidden = !edited;
  const nav = root.querySelector('.cp-sections')!;
  nav.replaceChildren(
    ...SECTIONS.map(([id, label]) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(id === section) }, label);
      b.addEventListener('click', () => {
        section = id;
        render();
      });
      return b;
    }),
  );
  const form = root.querySelector('.cp-form')!;
  form.replaceChildren(...drawSection());
  const problems = controlsProblems(doc);
  root
    .querySelector('.cp-checks')!
    .replaceChildren(
      ...(problems.length
        ? problems.map((p) => h('li', { class: 'error' }, `✕ ${p}`))
        : [h('li', { class: 'ok' }, '✓ The controls file passes every check')]),
    );
}

function drawSection(): HTMLElement[] {
  if (section === 'pad') return drawPad();
  if (section === 'tv') return drawTv();
  if (section === 'brands') return drawBrands();
  return drawPlace(section);
}

function heading(text: string, about = '') {
  return h('div', { class: 'cp-head' }, h('h2', {}, text), about ? h('p', {}, about) : '');
}

function drawPad(): HTMLElement[] {
  const g = doc.gamepad as unknown as Record<string, number>;
  return [
    heading(
      'Pad',
      'Numbers for every place: how far a stick moves before it counts, how often the buttons are read between frames, when a held button repeats.',
    ),
    ...padNumbers(doc).map((k) =>
      row(
        words(k),
        numberInput(g[k], (v) => v !== undefined && edit(() => (g[k] = v))),
      ),
    ),
  ];
}

function drawPlace(place: PadPlace): HTMLElement[] {
  const p = doc.gamepad[place] as unknown as Record<string, unknown> & {
    actions: Record<string, string[]>;
  };
  const { axes, numbers } = placeFields(doc, place);
  const out: HTMLElement[] = [
    heading(PLACE_NAMES[place], 'The sticks and numbers here, then which buttons do each action.'),
  ];
  for (const k of axes)
    out.push(
      row(
        words(k),
        select([...PAD_AXES], p[k] as string, (v) => edit(() => (p[k] = v))),
      ),
    );
  for (const k of numbers)
    out.push(
      row(
        words(k),
        numberInput(p[k] as number, (v) => v !== undefined && edit(() => (p[k] = v))),
      ),
    );
  out.push(h('h3', {}, 'Actions'));
  for (const [action, list] of Object.entries(p.actions)) {
    const chips = h('span', { class: 'cp-chips' });
    for (const b of ACTION_BUTTONS) {
      const chip = h(
        'button',
        { type: 'button', class: 'cp-chip', 'aria-pressed': String(list.includes(b)) },
        b,
      );
      chip.addEventListener('click', () =>
        edit(() => (p.actions[action] = toggleButton(p.actions[action]!, b))),
      );
      chips.append(chip);
    }
    out.push(h('div', { class: 'cp-action' }, h('span', {}, words(action)), chips));
  }
  return out;
}

function drawTv(): HTMLElement[] {
  const tv = doc.tv;
  const stay = h('input', { type: 'checkbox' });
  stay.checked = tv.stayOnBack;
  stay.addEventListener('change', () => edit(() => (tv.stayOnBack = stay.checked)));
  return [
    heading(
      'TV mode',
      'A console browser on a TV (Edge on Xbox): the words in its user agent, what it does with the pad, the margin kept clear of overscan, the highest graphics level (Ultra blanked the sea on the Xbox, decision 0244). ?tv forces it on any browser.',
    ),
    row(
      'user agents',
      textInput(tv.userAgents.join(', '), (v) =>
        edit(() => (tv.userAgents = v.split(',').map((w) => w.trim()))),
      ),
    ),
    row(
      'pad emulation',
      textInput(tv.gamepadInputEmulation, (v) => edit(() => (tv.gamepadInputEmulation = v))),
    ),
    row(
      'margin x',
      numberInput(tv.safeMargin.x, (v) => v !== undefined && edit(() => (tv.safeMargin.x = v))),
    ),
    row(
      'margin y',
      numberInput(tv.safeMargin.y, (v) => v !== undefined && edit(() => (tv.safeMargin.y = v))),
    ),
    row('Back stays', stay),
    row(
      'highest graphics',
      select([...QUALITY_LEVELS], tv.maxQuality, (v) =>
        edit(() => (tv.maxQuality = v as QualityLevel)),
      ),
    ),
  ];
}

function drawBrands(): HTMLElement[] {
  const out: HTMLElement[] = [
    heading(
      'Pad makers',
      "Each maker's names for the buttons, shown in texts ({pad:a}) and on the button glyphs. A pad whose id holds one of the match words gets that maker's names; the first maker is the default. A language line overrides a name in that language.",
    ),
  ];
  const named = PAD_BUTTONS.filter((b) => !['up', 'down', 'left', 'right', 'home'].includes(b));
  for (const [name, brand] of Object.entries(doc.padBrands)) {
    const grid = h('div', { class: 'cp-names' }, h('span'), h('b', {}, 'name'));
    for (const lang of LANGS) grid.append(h('b', {}, lang));
    for (const b of named) {
      grid.append(h('code', {}, b));
      grid.append(
        textInput(brand.names[b] ?? '', (v) =>
          edit(() => {
            if (v) brand.names[b] = v;
            else delete brand.names[b];
          }),
        ),
      );
      for (const lang of LANGS) {
        const input = textInput(brand.lang?.[lang]?.[b] ?? '', (v) =>
          edit(() => {
            const langs = (brand.lang ??= {});
            const names = (langs[lang] ??= {});
            if (v) names[b] = v;
            else delete names[b];
            if (!Object.keys(names).length) delete langs[lang];
            if (!Object.keys(langs).length) delete brand.lang;
          }),
        );
        input.placeholder = brand.names[b] ?? '';
        grid.append(input);
      }
    }
    out.push(
      h(
        'section',
        { class: 'cp-brand' },
        h('h3', {}, name),
        row(
          'match',
          textInput(brand.match.join(', '), (v) =>
            edit(() => (brand.match = v ? v.split(',').map((w) => w.trim()) : [])),
          ),
        ),
        grid,
      ),
    );
  }
  return out;
}
