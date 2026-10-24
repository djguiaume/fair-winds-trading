import type { SeaExport } from './seas';

/**
 * The sea editor's export (decision 0156): every file the sea is made of, each marked changed or
 * unchanged, with a download for each changed one (and all of them at once). The files are
 * formatted like the repository's, so only real edits show in the diff.
 */
export function showSeaExport(files: SeaExport[]) {
  let dialog = document.querySelector<HTMLDialogElement>('dialog.ed-export');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'ed-export';
    dialog.setAttribute('aria-label', 'Export the sea files');
    document.body.append(dialog);
  }
  const node = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Record<string, string | boolean> = {},
    parent: HTMLElement = dialog!,
  ) => {
    const el = Object.assign(document.createElement(tag), props);
    parent.append(el);
    return el;
  };
  dialog.replaceChildren();
  node('h2', { textContent: 'Export the sea files' });
  const changed = files.filter((f) => f.changed);
  node('p', {
    className: 'ed-note',
    textContent: changed.length
      ? `${changed.length} of ${files.length} files changed. Put each one at its path in the repository (or drop them in the chat): the others are the same as shipped.`
      : 'Nothing changed: every file is the same as shipped.',
  });
  const list = node('ul', { className: 'ed-export-files' });
  for (const file of files) {
    const li = node('li', { className: file.changed ? 'changed' : '' }, list);
    node('code', { textContent: file.path }, li);
    node('span', { textContent: file.changed ? '● changed' : 'same' }, li);
    const b = node('button', { textContent: '⤓', title: `Download ${file.path}` }, li);
    b.addEventListener('click', () => download(file));
  }
  const actions = node('div', { className: 'ed-export-actions' });
  const close = node('button', { textContent: 'Close' }, actions);
  close.addEventListener('click', () => dialog!.close());
  if (changed.length) {
    const all = node(
      'button',
      { className: 'primary', textContent: `Download ${changed.length} changed` },
      actions,
    );
    all.addEventListener('click', () =>
      changed.forEach((f, i) => setTimeout(() => download(f), i * 250)),
    );
  }
  dialog.showModal();
}

function download(file: SeaExport) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([file.text], { type: 'application/json' }));
  a.download = file.path.split('/').pop()!;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
