import { History } from './model';
import { h, row, textInput } from './quest/form';
import {
  type FieldsDoc,
  addKind,
  docField,
  docFields,
  kindsOf,
  removeKind,
  setDocField,
} from './fieldsDoc';

/**
 * A data page of the editors for one small JSON file (the Sea life page, the Town folk page):
 * every field by section, with the same edits and checks as the file's `npm run` tool
 * (`fieldsDoc.ts`). The working copy stays in this browser; Export gives the file to commit.
 */
export class FieldsPage<Doc extends object> {
  private root!: HTMLElement;
  private onClose = () => {};
  private isOpen = false;
  private doc: Doc;
  private chosen: string;
  private readonly history = new History<Doc>();

  constructor(private readonly spec: FieldsDoc<Doc>) {
    this.doc = this.loadDoc();
    this.chosen = spec.sections(this.doc)[0]!;
    document.addEventListener('keydown', (e) => this.onKey(e));
  }

  get open() {
    return this.isOpen;
  }

  private loadDoc(): Doc {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(this.spec.storageKey) ?? 'null');
      if (this.spec.isDoc(saved)) return saved;
    } catch {
      /* Nothing saved, or private mode. */
    }
    return this.spec.shipped();
  }

  /** Builds the page into `#lp`; `close` brings the map back. */
  setup(close: () => void) {
    const { spec } = this;
    this.onClose = close;
    this.root = document.getElementById('lp')!;
    this.root.innerHTML = `
    <header class="ed-top">
      <h1>${spec.about}</h1>
      <span class="ed-file">${spec.file} <span class="cp-edited" hidden>· ● edited</span></span>
      <nav class="ed-actions">
        <button data-act="back" title="Back to the map (Esc)">← Map</button>
        <button data-act="undo" title="Undo (Ctrl+Z)">↶ Undo</button>
        <button data-act="redo" title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
        <button data-act="add" title="A new ${spec.kinds.name}, a copy of the chosen one">+ ${
          spec.kinds.name[0]!.toUpperCase() + spec.kinds.name.slice(1)
        }</button>
        <button data-act="remove" title="Remove the chosen ${spec.kinds.name}">Remove</button>
        <button data-act="reset" title="Back to the file shipped with the game">Reset</button>
        <button data-act="export" class="primary">Export ${this.fileName}</button>
      </nav>
    </header>
    <main class="cp-main">
      <nav class="cp-sections"></nav>
      <section class="cp-form"></section>
      <aside class="cp-side"><h2>Checks</h2><ul class="ed-checks cp-checks"></ul></aside>
    </main>`;
    const acts: Record<string, () => void> = {
      back: () => this.closePage(),
      undo: () => this.undo(),
      redo: () => this.redo(),
      add: () => this.add(),
      remove: () => this.remove(),
      reset: () => this.reset(),
      export: () => this.exportFile(),
    };
    this.root.querySelector('.ed-actions')!.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (act) acts[act]?.();
    });
  }

  openPage() {
    this.isOpen = true;
    document.getElementById('ed-top')!.hidden = true;
    document.getElementById('ed-main')!.hidden = true;
    this.root.hidden = false;
    this.render();
  }

  private closePage() {
    this.isOpen = false;
    this.root.hidden = true;
    document.getElementById('ed-top')!.hidden = false;
    document.getElementById('ed-main')!.hidden = false;
    this.onClose();
  }

  private get fileName() {
    return this.spec.file.slice(this.spec.file.lastIndexOf('/') + 1);
  }

  // --- Edits ----------------------------------------------------------------------------------

  private edit(change: () => void) {
    this.history.record(this.doc);
    change();
    this.commit();
  }

  private get edited() {
    return this.spec.text(this.doc) !== this.spec.text(this.spec.shipped());
  }

  private commit() {
    try {
      if (this.edited) localStorage.setItem(this.spec.storageKey, JSON.stringify(this.doc));
      else localStorage.removeItem(this.spec.storageKey);
    } catch {
      /* Private mode: the edits last while the page is open. */
    }
    const sections = this.spec.sections(this.doc);
    if (!sections.includes(this.chosen)) this.chosen = sections[0]!;
    this.render();
  }

  private undo() {
    const prior = this.history.undo(this.doc);
    if (prior) {
      this.doc = prior;
      this.commit();
    }
  }

  private redo() {
    const next = this.history.redo(this.doc);
    if (next) {
      this.doc = next;
      this.commit();
    }
  }

  /** The chosen section's kind id, when it is one of the kinds. */
  private get chosenKind() {
    const prefix = `${this.spec.kinds.key}.`;
    return this.chosen.startsWith(prefix) ? this.chosen.slice(prefix.length) : undefined;
  }

  private add() {
    const id = prompt(`Id of the new ${this.spec.kinds.name} (lower-case, digits, -)`)?.trim();
    if (!id) return;
    const from = this.chosenKind;
    this.edit(() => {
      const problem = addKind(this.spec, this.doc, id, from);
      if (problem) alert(problem);
      else this.chosen = `${this.spec.kinds.key}.${id}`;
    });
  }

  private remove() {
    const id = this.chosenKind;
    if (!id) return alert(`Choose a ${this.spec.kinds.name} to remove.`);
    if (!confirm(`Remove the ${this.spec.kinds.name} ${id}?`)) return;
    this.edit(() => removeKind(this.spec, this.doc, id));
  }

  private reset() {
    if (!confirm('Throw away every edit and go back to the shipped file?')) return;
    this.history.record(this.doc);
    this.doc = this.spec.shipped();
    this.commit();
  }

  private exportFile() {
    const a = document.createElement('a');
    const blob = new Blob([this.spec.text(this.doc)], { type: 'application/json' });
    a.href = URL.createObjectURL(blob);
    a.download = this.fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  private onKey(e: KeyboardEvent) {
    if (!this.isOpen) return;
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (e.key === 'Escape') this.closePage();
  }

  // --- Drawing --------------------------------------------------------------------------------

  private render() {
    const { spec, root } = this;
    root.querySelector<HTMLElement>('.cp-edited')!.hidden = !this.edited;
    root.querySelector('.cp-sections')!.replaceChildren(
      ...spec.sections(this.doc).map((id) => {
        const b = h('button', { type: 'button', 'aria-pressed': String(id === this.chosen) }, id);
        b.addEventListener('click', () => {
          this.chosen = id;
          this.render();
        });
        return b;
      }),
    );
    root.querySelector('.cp-form')!.replaceChildren(...this.drawSection(this.chosen));
    const problems = spec.problems(this.doc);
    root
      .querySelector('.cp-checks')!
      .replaceChildren(
        ...(problems.length
          ? problems.map((p) => h('li', { class: 'error' }, `✕ ${p}`))
          : [h('li', { class: 'ok' }, `✓ ${spec.about} passes every check`)]),
      );
  }

  private drawSection(section: string): Element[] {
    const { spec } = this;
    const set = (path: string) => (v: string) =>
      this.edit(() => {
        const problem = setDocField(this.doc, path, v, spec.tool);
        if (problem) alert(problem);
      });
    const fields = docFields(this.doc)
      .filter((f) => f.path.startsWith(`${section}.`))
      .map(({ path }) =>
        row(path.slice(section.length + 1), textInput(docField(this.doc, path), set(path))),
      );
    const kinds = Object.keys(kindsOf(spec, this.doc));
    return [
      h(
        'div',
        { class: 'cp-head' },
        h('h2', {}, section),
        h('p', {}, spec.sectionAbout[section.split('.')[0]!] ?? ''),
        h('p', {}, kinds.length ? `${spec.names}` : spec.names),
      ),
      ...fields,
    ];
  }
}
