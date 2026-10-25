import { SHIP_CLASSES } from '../../sim/ship';
import { FLAG_SHAPES, MEDALS } from '../../sim/regatta';
import { History } from '../model';
import { h, numberInput, row, select, textInput } from '../quest/form';
import {
  EDITED_REGATTA_KEY,
  type RegattaDoc,
  flagSvg,
  flagsText,
  isFlagShape,
  isRegattaDoc,
  regattaProblems,
  regattaText,
  removeFlag,
  setFlag,
  setSeries,
  shippedRegattaDoc,
} from './doc';
import '../controls/controls.css';

/**
 * The Regatta page of the editors (decision 0217): everything in `src/data/regatta.json` (the
 * horn, the medals, the lines, Kestrel, the series) and `src/data/flags.json` (pennants and
 * burgees, drawn as the game draws them), with the same checks as `npm run check`. Each race's
 * course, gold and pars are in the quest builder. The working copy stays in this browser; Export
 * gives the files to commit. `npm run race -- rules|set|series|flag` makes the same edits.
 */

type Section = 'rules' | 'rival' | 'series' | 'flags';
const SECTIONS: [Section, string][] = [
  ['rules', 'Rules'],
  ['rival', 'Kestrel'],
  ['series', 'Series'],
  ['flags', 'Flags'],
];

let root: HTMLElement;
let onClose = () => {};
let open = false;
let section: Section = 'rules';
let doc: RegattaDoc = loadDoc();
const history = new History<RegattaDoc>();

function loadDoc(): RegattaDoc {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(EDITED_REGATTA_KEY) ?? 'null');
    if (isRegattaDoc(saved)) return saved;
  } catch {
    /* Nothing saved, or private mode. */
  }
  return shippedRegattaDoc();
}

const edited = () => {
  const shipped = shippedRegattaDoc();
  return regattaText(doc) !== regattaText(shipped) || flagsText(doc) !== flagsText(shipped);
};

export const regattaOpen = () => open;

export function setupRegattaPage(close: () => void) {
  onClose = close;
  root = document.getElementById('rg')!;
  root.innerHTML = `
    <header class="ed-top">
      <h1>Regatta</h1>
      <span class="ed-file">src/data/regatta.json, flags.json <span class="cp-edited" hidden>· ● edited</span></span>
      <nav class="ed-actions">
        <button data-act="back" title="Back to the map (Esc)">← Map</button>
        <button data-act="undo" title="Undo (Ctrl+Z)">↶ Undo</button>
        <button data-act="redo" title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
        <button data-act="reset" title="Back to the files shipped with the game">Reset</button>
        <button data-act="flags">Export flags.json</button>
        <button data-act="export" class="primary">Export regatta.json</button>
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
    export: () => download('regatta.json', regattaText(doc)),
    flags: () => download('flags.json', flagsText(doc)),
  };
  root.querySelector('.ed-actions')!.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.act;
    if (act) acts[act]?.();
  });
}

export function openRegatta() {
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
  try {
    if (edited()) localStorage.setItem(EDITED_REGATTA_KEY, JSON.stringify(doc));
    else localStorage.removeItem(EDITED_REGATTA_KEY);
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
  if (!confirm('Throw away every regatta edit and go back to the shipped files?')) return;
  history.record(doc);
  doc = shippedRegattaDoc();
  commit();
}

function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
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

function render() {
  root.querySelector<HTMLElement>('.cp-edited')!.hidden = !edited();
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
  root.querySelector('.cp-form')!.replaceChildren(...drawSection());
  const problems = regattaProblems(doc);
  root
    .querySelector('.cp-checks')!
    .replaceChildren(
      ...(problems.length
        ? problems.map((p) => h('li', { class: 'error' }, `✕ ${p}`))
        : [h('li', { class: 'ok' }, '✓ The regatta files pass every check')]),
    );
}

function drawSection(): HTMLElement[] {
  if (section === 'rival') return drawRival();
  if (section === 'series') return drawSeries();
  if (section === 'flags') return drawFlags();
  return drawRules();
}

function heading(text: string, about = '') {
  return h('div', { class: 'cp-head' }, h('h2', {}, text), about ? h('p', {}, about) : '');
}

const num = (value: number, set: (v: number) => void) =>
  numberInput(value, (v) => v !== undefined && edit(() => set(v)));

const flagIds = () => doc.flags.flags.map((f) => f.id);

function colour(value: string, set: (v: string) => void): HTMLElement {
  const pick = h('input', { type: 'color' });
  pick.value = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
  pick.addEventListener('change', () => edit(() => set(pick.value)));
  const text = textInput(value, (v) => edit(() => set(v)));
  return h('span', { class: 'rg-colour' }, pick, text);
}

function drawRules(): HTMLElement[] {
  const r = doc.regatta;
  return [
    heading(
      'Rules',
      "How a race starts and what a medal takes. A medal's time is the race's par × its share (gold 1). Each race's course, gold and pars are in the quest builder.",
    ),
    row(
      'horn countdown (s)',
      num(r.countdownSec, (v) => (r.countdownSec = v)),
    ),
    row(
      'mark rounded within',
      num(r.within, (v) => (r.within = v)),
    ),
    row(
      'shortest line',
      num(r.minLine, (v) => (r.minLine = v)),
    ),
    ...MEDALS.map((m) =>
      row(
        `${m} × par`,
        num(r.medals[m], (v) => (r.medals[m] = v)),
      ),
    ),
    row(
      'series won with',
      select([...MEDALS], r.winMedal, (v) => edit(() => (r.winMedal = v as typeof r.winMedal))),
    ),
  ];
}

function drawRival(): HTMLElement[] {
  const k = doc.regatta.rival;
  return [
    heading(
      'Kestrel',
      "The rival boat: her ship, her colours and burgee, the medal time she sails to on the captain's ship and level, and the room she keeps at the line and past the finish.",
    ),
    row(
      'name',
      textInput(k.name, (v) => edit(() => (k.name = v))),
    ),
    row(
      'ship',
      select(Object.keys(SHIP_CLASSES), k.ship, (v) => edit(() => (k.ship = v))),
    ),
    row(
      'sail number',
      textInput(k.sailNumber, (v) => edit(() => (k.sailNumber = v))),
    ),
    row(
      'hull',
      colour(k.hull, (v) => (k.hull = v)),
    ),
    row(
      'band',
      colour(k.band, (v) => (k.band = v)),
    ),
    row(
      'burgee',
      select(flagIds(), k.flag, (v) => edit(() => (k.flag = v))),
    ),
    row(
      'sails to',
      select([...MEDALS], k.pace, (v) => edit(() => (k.pace = v as typeof k.pace))),
    ),
    row(
      'speed at least ×',
      num(k.paceRange[0], (v) => (k.paceRange[0] = v)),
    ),
    row(
      'speed at most ×',
      num(k.paceRange[1], (v) => (k.paceRange[1] = v)),
    ),
    row(
      'room at the line',
      num(k.berth, (v) => (k.berth = v)),
    ),
    row(
      'sails on past finish',
      num(k.runOut, (v) => (k.runOut = v)),
    ),
  ];
}

function drawSeries(): HTMLElement[] {
  const out: HTMLElement[] = [
    heading(
      'Series',
      'Each series is won with the winning medal in every race of it; its pennant then flies at the masthead (the latest series won). A race names its series in the quest builder.',
    ),
  ];
  for (const s of doc.regatta.series) {
    const f = doc.flags.flags.find((x) => x.id === s.pennant);
    const preview = h('span', { class: 'rg-flag' });
    if (f) preview.innerHTML = flagSvg(f, 60);
    out.push(
      h(
        'section',
        { class: 'cp-brand' },
        h('h3', {}, s.id),
        row(
          'name',
          textInput(s.name, (v) => edit(() => setSeries(doc, s.id, { name: v }))),
        ),
        row(
          'pennant',
          select(flagIds(), s.pennant, (v) => edit(() => setSeries(doc, s.id, { pennant: v }))),
          preview,
        ),
      ),
    );
  }
  return out;
}

function drawFlags(): HTMLElement[] {
  const out: HTMLElement[] = [
    heading(
      'Flags',
      'Masthead flags: the pennants a series won flies and Kestrel’s burgee. Bands run from the mast to the fly. The stock pennant is 1 by 0.5.',
    ),
  ];
  for (const f of doc.flags.flags) {
    const preview = h('div', { class: 'rg-flag' });
    preview.innerHTML = flagSvg(f);
    const bands = h('div', { class: 'rg-bands' });
    f.bands.forEach((c, i) => {
      const band = colour(c, (v) => (f.bands[i] = v));
      const drop = h('button', { type: 'button', title: 'Remove this band' }, '×');
      drop.addEventListener('click', () => edit(() => f.bands.splice(i, 1)));
      band.append(drop);
      bands.append(band);
    });
    const add = h('button', { type: 'button' }, '+ band');
    add.addEventListener('click', () => edit(() => f.bands.push('#f4f1e8')));
    bands.append(add);
    const remove = h('button', { type: 'button' }, 'Remove flag');
    remove.addEventListener('click', () => edit(() => removeFlag(doc, f.id)));
    out.push(
      h(
        'section',
        { class: 'cp-brand' },
        h('h3', {}, f.id),
        preview,
        row(
          'shape',
          select([...FLAG_SHAPES], f.shape, (v) => isFlagShape(v) && edit(() => (f.shape = v))),
        ),
        row(
          'length',
          num(f.length, (v) => (f.length = v)),
        ),
        row(
          'height',
          num(f.height, (v) => (f.height = v)),
        ),
        row('bands', bands),
        remove,
      ),
    );
  }
  const id = textInput('', () => {});
  id.placeholder = 'new-flag-id';
  const add = h('button', { type: 'button' }, '+ Add flag');
  add.addEventListener('click', () => {
    const name = id.value.trim();
    if (name && !flagIds().includes(name)) edit(() => setFlag(doc, name, {}));
  });
  out.push(h('div', { class: 'rg-add' }, id, add));
  return out;
}
