import { t } from '../../i18n';
import { Dialog } from '../components';

/**
 * The game's own yes/no for something that cannot be undone (decision 0183: the browser's box
 * leaves fullscreen on Xbox and the pad cannot reach it). A dialog of the components: Cancel and
 * an ink-outlined danger button, never a red fill; Esc and B say no.
 */
export async function askDanger(q: { title: string; text: string; ok: string }): Promise<boolean> {
  const dialog = new Dialog<boolean>({
    title: q.title,
    text: q.text,
    choices: [
      { label: t('confirm.cancel'), value: false },
      { label: q.ok, value: true, variant: 'danger' },
    ],
    cancel: false,
  });
  const yes = await dialog.ask();
  dialog.root.remove();
  return yes;
}
