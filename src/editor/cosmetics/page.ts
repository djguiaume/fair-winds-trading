import { SHIP_CLASSES } from '../../sim/ship';
import { type Item, type Slot, APPEARANCE_SLOTS, type Appearance } from '../../sim/cosmetics';
import { History } from '../model';
import { h, select, textInput } from '../quest/form';
import {
  type CosmeticsDoc,
  EDITED_COSMETICS_KEY,
  SLOT_FOLDERS,
  addItem,
  bundleText,
  cosmeticsProblems,
  importBundle,
  removeItem,
  setField,
  shippedCosmeticsDoc,
} from './doc';
import { bindFields, slotRows, text, unlockRows } from './fields';
import { lookSvg } from './preview';
import '../controls/controls.css';

/**
 * The Cosmetics page of the editors (decision 0261): every boat cosmetic in `src/data/cosmetics`
 * (sail colours and patterns, emblems, hull colours, figureheads, flags, wakes and sets) with a
 * flat preview on any ship class and the same checks as `npm run check`. The working copy stays
 * in this browser; Export gives one bundle, which `npm run cosmetics -- import` writes as files.
 */

type Section = Slot | 'set';
const LABELS: Record<Section, string> = {
  'sail-colour': 'Sail colours',
  'sail-pattern': 'Patterns',
  'sail-logo': 'Emblems',
  'hull-colour': 'Hull colours',
  figurehead: 'Figureheads',
  flag: 'Flags',
  wake: 'Wakes',
  set: 'Sets',
};

let root: HTMLElement;
let onClose = () => {};
let open = false;
let section: Section = 'sail-colour';
let shipClass = 'sloop';
let doc: CosmeticsDoc = loadDoc();
const history = new History<CosmeticsDoc>();

function loadDoc(): CosmeticsDoc {
  try {
    const saved = JSON.parse(
      localStorage.getItem(EDITED_COSMETICS_KEY) ?? 'null',
    ) as CosmeticsDoc | null;
    if (saved && Array.isArray(saved.items) && saved.logos) return saved;
  } catch {
    /* Nothing saved, or private mode. */
  }
  return shippedCosmeticsDoc();
}

const edited = () => bundleText(doc) !== bundleText(shippedCosmeticsDoc());

export const cosmeticsOpen = () => open;

export function setupCosmeticsPage(close: () => void) {
  onClose = close;
  bindFields({ doc: () => doc, edit, setIn });
  root = document.getElementById('cs')!;
  root.innerHTML = `
    <header class="ed-top">
      <h1>Cosmetics</h1>
      <span class="ed-file">src/data/cosmetics <span class="cp-edited" hidden>· ● edited</span></span>
      <nav class="ed-actions">
        <button data-act="back" title="Back to the map (Esc)">← Map</button>
        <button data-act="undo" title="Undo (Ctrl+Z)">↶ Undo</button>
        <button data-act="redo" title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
        <button data-act="reset" title="Back to the files shipped with the game">Reset</button>
        <button data-act="import">Import bundle</button>
        <button data-act="export" class="primary">Export bundle</button>
        <input type="file" accept=".json,application/json" hidden />
      </nav>
    </header>
    <main class="cp-main">
      <nav class="cp-sections"></nav>
      <section class="cp-form"></section>
      <aside class="cp-side"><h2>Checks</h2><ul class="ed-checks cp-checks"></ul></aside>
    </main>`;
  const file = root.querySelector<HTMLInputElement>('input[type=file]')!;
  file.addEventListener('change', async () => {
    const text = await file.files?.[0]?.text();
    file.value = '';
    if (text === undefined) return;
    history.record(doc);
    const problem = importBundle(doc, text);
    if (problem) alert(problem);
    commit();
  });
  const acts: Record<string, () => void> = {
    back: closePage,
    undo,
    redo,
    reset,
    import: () => file.click(),
    export: () => download('cosmetics.json', bundleText(doc)),
  };
  root.querySelector('.ed-actions')!.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.act;
    if (act) acts[act]?.();
  });
}

export function openCosmetics() {
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

/** A field edited through the shared `setField`, so the page and the command agree. */
const setIn = (item: Item, path: string) => (text: string) => {
  const problem = setField(item, path, text);
  if (problem) alert(problem);
  commit();
};

function commit() {
  try {
    if (edited()) localStorage.setItem(EDITED_COSMETICS_KEY, JSON.stringify(doc));
    else localStorage.removeItem(EDITED_COSMETICS_KEY);
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
  if (!confirm('Throw away every cosmetics edit and go back to the shipped files?')) return;
  history.record(doc);
  doc = shippedCosmeticsDoc();
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
    ...SLOT_FOLDERS.map((id) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(id === section) }, LABELS[id]);
      b.addEventListener('click', () => {
        section = id;
        render();
      });
      return b;
    }),
  );
  root.querySelector('.cp-form')!.replaceChildren(...drawSection());
  const problems = cosmeticsProblems(doc);
  root
    .querySelector('.cp-checks')!
    .replaceChildren(
      ...(problems.length
        ? problems.map((p) => h('li', { class: 'error' }, `✕ ${p}`))
        : [h('li', { class: 'ok' }, '✓ The cosmetics pass every check')]),
    );
}

function drawSection(): HTMLElement[] {
  const classPick = select(Object.keys(SHIP_CLASSES), shipClass, (v) => {
    shipClass = v;
    render();
  });
  const out: HTMLElement[] = [
    h(
      'div',
      { class: 'cp-head' },
      h('h2', {}, LABELS[section]),
      h('p', {}, 'Cosmetics are pride, never power. Preview on: '),
      classPick,
    ),
  ];
  for (const item of doc.items.filter((i) => i.slot === section)) out.push(drawItem(item));
  const id = textInput('', () => {});
  id.placeholder = 'new-item-id';
  const add = h('button', { type: 'button' }, '+ Add item');
  add.addEventListener('click', () => {
    const name = id.value.trim();
    if (!name) return;
    const result = addItem(doc, section, name);
    if (typeof result === 'string') alert(result);
    else commit();
  });
  out.push(h('div', { class: 'rg-add' }, id, add));
  return out;
}

/** What wearing this item alone looks like: its slot filled, the rest stock; a set fills several. */
function wearing(item: Item): Partial<Appearance> {
  const slots = item.slot === 'set' ? item.items : { [item.slot]: item.id };
  return Object.fromEntries(
    Object.entries(slots).map(([slot, id]) => [
      Object.keys(APPEARANCE_SLOTS).find((k) => APPEARANCE_SLOTS[k as keyof Appearance] === slot),
      id,
    ]),
  ) as Partial<Appearance>;
}

function drawItem(item: Item): HTMLElement {
  const preview = h('div', { class: 'rg-flag' });
  preview.innerHTML = lookSvg(doc, wearing(item), shipClass);
  const remove = h('button', { type: 'button' }, 'Remove item');
  remove.addEventListener('click', () => {
    if (confirm(`Remove ${item.slot}/${item.id}? Saves that own it keep the id.`))
      edit(() => void removeItem(doc, item.slot, item.id));
  });
  return h(
    'section',
    { class: 'cp-brand' },
    h('h3', {}, item.id),
    preview,
    text(item, 'name (EN)', 'name.en', item.name.en),
    text(item, 'name (FR)', 'name.fr', item.name.fr),
    ...unlockRows(item),
    ...(item.slot !== 'set'
      ? [
          text(
            item,
            'classes (blank: all)',
            'classes',
            (item as { classes?: string[] }).classes?.join(',') ?? '',
          ),
        ]
      : []),
    ...slotRows(item),
    remove,
  );
}
