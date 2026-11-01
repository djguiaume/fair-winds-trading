import { History } from '../model';
import { h, row, textInput } from '../quest/form';
import type { Theme } from '../../ui/theme/model';
import {
  EDITED_THEME_KEY,
  THEME_FILE,
  type Token,
  groupOf,
  parseTheme,
  sameTheme,
  setToken,
  shippedTheme,
  themeProblems,
  themeText,
  tokens,
} from './doc';
import { previewStrips, previewStyle } from './preview';
import './theme.css';

/**
 * The editors' Theme page (decisions 0153, 0269): every token of `src/data/ui/theme.json` by
 * group, a live preview of the eight components by day and night, and the theme's checks, with
 * the same edits as `npm run theme`. The working copy stays in this browser; Export gives the
 * file to commit.
 */

let root: HTMLElement;
let onClose = () => {};
let open = false;
let doc: Theme = loadDoc();
let group = 'colour';
const history = new History<Theme>();
const style = document.createElement('style');

function loadDoc(): Theme {
  try {
    const saved = localStorage.getItem(EDITED_THEME_KEY);
    const parsed = saved ? parseTheme(saved) : null;
    if (parsed && typeof parsed !== 'string') return parsed;
  } catch {
    /* Nothing saved, or private mode. */
  }
  return shippedTheme();
}

export const themeOpen = () => open;

export function setupThemePage(close: () => void) {
  onClose = close;
  root = document.getElementById('th')!;
  root.innerHTML = `
    <header class="ed-top">
      <h1>Theme</h1>
      <span class="ed-file">${THEME_FILE} <span class="cp-edited" hidden>· ● edited</span></span>
      <nav class="ed-actions">
        <button data-act="back" title="Back to the map (Esc)">← Map</button>
        <button data-act="undo" title="Undo (Ctrl+Z)">↶ Undo</button>
        <button data-act="redo" title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
        <button data-act="reset" title="Back to the theme shipped with the game">Reset</button>
        <button data-act="import" title="Read a theme.json file">Import</button>
        <button data-act="export" class="primary">Export theme.json</button>
      </nav>
    </header>
    <main class="cp-main th-main">
      <nav class="cp-sections"></nav>
      <section class="cp-form"></section>
      <aside class="cp-side"><h2>Checks</h2><ul class="ed-checks cp-checks"></ul></aside>
    </main>
    <section class="th-strips"></section>`;
  document.head.append(style);
  root.querySelector('.th-strips')!.append(...previewStrips());
  const acts: Record<string, () => void> = {
    back: closePage,
    undo,
    redo,
    reset,
    import: importFile,
    export: exportFile,
  };
  root.querySelector('.ed-actions')!.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest('button')?.dataset.act;
    if (act) acts[act]?.();
  });
}

export function openTheme() {
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

function edit(change: () => string | null) {
  const before = structuredClone(doc);
  const problem = change();
  if (problem) {
    alert(problem);
    return;
  }
  history.record(before);
  commit();
}

function commit() {
  try {
    if (sameTheme(doc, shippedTheme())) localStorage.removeItem(EDITED_THEME_KEY);
    else localStorage.setItem(EDITED_THEME_KEY, themeText(doc));
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
  if (!confirm('Throw away every theme edit and go back to the shipped theme?')) return;
  history.record(doc);
  doc = shippedTheme();
  commit();
}

function exportFile() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([themeText(doc)], { type: 'application/json' }));
  a.download = 'theme.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importFile() {
  const input = h('input', { type: 'file', accept: '.json,application/json' });
  input.addEventListener('change', async () => {
    const text = await input.files?.[0]?.text();
    if (text === undefined) return;
    const parsed = parseTheme(text);
    if (typeof parsed === 'string') return alert(parsed);
    history.record(doc);
    doc = parsed;
    commit();
  });
  input.click();
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
  style.textContent = previewStyle(doc);
  root.querySelector<HTMLElement>('.cp-edited')!.hidden = sameTheme(doc, shippedTheme());
  const all = tokens(doc);
  const groups = [...new Set(all.map((t) => groupOf(t.path)))];
  root.querySelector('.cp-sections')!.replaceChildren(
    ...groups.map((g) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(g === group) }, g);
      b.addEventListener('click', () => {
        group = g;
        render();
      });
      return b;
    }),
  );
  root
    .querySelector('.cp-form')!
    .replaceChildren(
      h('h2', {}, group),
      ...all.filter((t) => groupOf(t.path) === group).map(field),
    );
  const problems = themeProblems(doc);
  root
    .querySelector('.cp-checks')!
    .replaceChildren(
      ...(problems.length
        ? problems.map((p) => h('li', { class: 'error' }, `✕ ${p}`))
        : [h('li', { class: 'ok' }, '✓ The theme passes every check')]),
    );
}

/** One token's input: a colour picker beside the text for colours, else the typed value. */
function field(token: Token): HTMLElement {
  const set = (v: string) => edit(() => setToken(doc, token.path, v));
  const text = textInput(String(token.value), set);
  const name = token.path.slice(groupOf(token.path).length + 1);
  if (token.kind !== 'colour') return row(name, text);
  const picker = h('input', { type: 'color', class: 'th-swatch' });
  picker.value = String(token.value);
  picker.addEventListener('change', () => set(picker.value));
  return row(name, h('span', { class: 'th-colour' }, picker, text));
}
