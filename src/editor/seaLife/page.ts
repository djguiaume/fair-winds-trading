import { History } from '../model';
import { h, row, textInput } from '../quest/form';
import {
  EDITED_LIFE_KEY,
  LIFE_FILE,
  LIFE_SEAS,
  type SeaLifeDoc,
  addBird,
  isLifeDoc,
  lifeField,
  lifeFields,
  lifeProblems,
  lifeText,
  removeBird,
  setLifeField,
  shippedLifeDoc,
} from './doc';

/**
 * The editors' Sea life page (issue #476): every field of `src/data/sea-life.json` (the birds by
 * kind, the dolphins, the whale, the shoals, the quality shares), with the same edits and checks
 * as `npm run life`. The working copy stays in this browser; Export gives the file to commit.
 */

let root: HTMLElement;
let onClose = () => {};
let open = false;
let doc: SeaLifeDoc = loadDoc();
/** The chosen section: `quality`, `birds.<id>`, `dolphins`, `whale` or `shoals`. */
let chosen = 'birds.gull';
const history = new History<SeaLifeDoc>();

/** What each section is about, shown over its fields. */
const ABOUT: Record<string, string> = {
  quality: 'Share of every count drawn at each quality level (0 to 1); Ultra-low draws none.',
  birds:
    'A flock circling its home near the boat: harbour (the nearest pier head), reef or wake (astern of her near a coast). Spans are "low, high".',
  dolphins: 'A pod now and then in its waters: rides abeam of the boat, leaping in turn.',
  whale: 'Surfaces now and then off the bow in deep water: rises, blows, dives flukes up.',
  shoals: 'Dark fish just under the surface, placed round the boat where fish live.',
};

function loadDoc(): SeaLifeDoc {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(EDITED_LIFE_KEY) ?? 'null');
    if (isLifeDoc(saved)) return saved;
  } catch {
    /* Nothing saved, or private mode. */
  }
  return shippedLifeDoc();
}

export const seaLifeOpen = () => open;

export function setupSeaLifePage(close: () => void) {
  onClose = close;
  root = document.getElementById('lp')!;
  root.innerHTML = `
    <header class="ed-top">
      <h1>Sea life</h1>
      <span class="ed-file">${LIFE_FILE} <span class="cp-edited" hidden>· ● edited</span></span>
      <nav class="ed-actions">
        <button data-act="back" title="Back to the map (Esc)">← Map</button>
        <button data-act="undo" title="Undo (Ctrl+Z)">↶ Undo</button>
        <button data-act="redo" title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
        <button data-act="add" title="A new bird kind, a copy of the chosen one">+ Bird kind</button>
        <button data-act="remove" title="Remove the chosen bird kind">Remove</button>
        <button data-act="reset" title="Back to the file shipped with the game">Reset</button>
        <button data-act="export" class="primary">Export sea-life.json</button>
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
    export: exportFile,
  };
  root.querySelector('.ed-actions')!.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.act;
    if (act) acts[act]?.();
  });
}

export function openSeaLife() {
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
  const edited = lifeText(doc) !== lifeText(shippedLifeDoc());
  try {
    if (edited) localStorage.setItem(EDITED_LIFE_KEY, JSON.stringify(doc));
    else localStorage.removeItem(EDITED_LIFE_KEY);
  } catch {
    /* Private mode: the edits last while the page is open. */
  }
  if (!sections().includes(chosen)) chosen = sections()[0]!;
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
  const id = prompt('Id of the new bird kind (lower-case, digits, -)')?.trim();
  if (!id) return;
  const from = chosen.startsWith('birds.') ? chosen.slice(6) : undefined;
  edit(() => {
    const problem = addBird(doc, id, from);
    if (problem) alert(problem);
    else chosen = `birds.${id}`;
  });
}
function remove() {
  if (!chosen.startsWith('birds.')) return alert('Choose a bird kind to remove.');
  const id = chosen.slice(6);
  if (!confirm(`Remove the bird kind ${id}?`)) return;
  edit(() => removeBird(doc, id));
}
function reset() {
  if (!confirm('Throw away every sea-life edit and go back to the shipped file?')) return;
  history.record(doc);
  doc = shippedLifeDoc();
  commit();
}

function exportFile() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lifeText(doc)], { type: 'application/json' }));
  a.download = 'sea-life.json';
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

const sections = () => [
  ...Object.keys(doc.birds).map((id) => `birds.${id}`),
  'dolphins',
  'whale',
  'shoals',
  'quality',
];

function render() {
  root.querySelector<HTMLElement>('.cp-edited')!.hidden =
    lifeText(doc) === lifeText(shippedLifeDoc());
  root.querySelector('.cp-sections')!.replaceChildren(
    ...sections().map((id) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(id === chosen) }, id);
      b.addEventListener('click', () => {
        chosen = id;
        render();
      });
      return b;
    }),
  );
  root.querySelector('.cp-form')!.replaceChildren(...drawSection(chosen));
  const problems = lifeProblems(doc);
  root
    .querySelector('.cp-checks')!
    .replaceChildren(
      ...(problems.length
        ? problems.map((p) => h('li', { class: 'error' }, `✕ ${p}`))
        : [h('li', { class: 'ok' }, '✓ Sea life passes every check')]),
    );
}

function drawSection(section: string): Element[] {
  const set = (path: string) => (v: string) =>
    edit(() => {
      const problem = setLifeField(doc, path, v);
      if (problem) alert(problem);
    });
  const fields = lifeFields(doc)
    .filter((f) => f.path.startsWith(`${section}.`))
    .map(({ path }) =>
      row(path.slice(section.length + 1), textInput(lifeField(doc, path), set(path))),
    );
  return [
    h(
      'div',
      { class: 'cp-head' },
      h('h2', {}, section),
      h('p', {}, ABOUT[section.split('.')[0]!] ?? ''),
      h('p', {}, `Seas: ${LIFE_SEAS.join(', ')}. Models are prop recipes (life-*).`),
    ),
    ...fields,
  ];
}
