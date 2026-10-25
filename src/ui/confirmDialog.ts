/**
 * An in-game yes/no question (decision 0183), instead of the browser's `confirm()`: on Xbox that
 * box leaves fullscreen and the controller can't reach it. A real dialog, so the pad's focus
 * moves over it (decision 0163) and B or Esc answer no.
 */
export function askConfirm(q: { title: string; text: string; ok: string }): Promise<boolean> {
  const dialog = document.getElementById('confirm-dialog') as HTMLDialogElement | null;
  if (!dialog || typeof dialog.showModal !== 'function') return Promise.resolve(false);
  dialog.querySelector('#confirm-title')!.textContent = q.title;
  dialog.querySelector('#confirm-text')!.textContent = q.text;
  const ok = dialog.querySelector<HTMLButtonElement>('#confirm-ok')!;
  const cancel = dialog.querySelector<HTMLButtonElement>('#confirm-cancel')!;
  ok.textContent = q.ok;
  return new Promise((resolve) => {
    const answer = (yes: boolean) => {
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      dialog.removeEventListener('close', onClose);
      if (dialog.open) dialog.close();
      resolve(yes);
    };
    const onOk = () => answer(true);
    const onCancel = () => answer(false);
    const onClose = () => answer(false);
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    dialog.addEventListener('close', onClose);
    dialog.showModal();
  });
}
