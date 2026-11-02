import { t } from '../../i18n';
import { Dialog } from '../components';
import type { ButtonVariant } from '../components';

export interface Question {
  title: string;
  text: string;
  ok: string;
}

/**
 * The game's own yes/no (decision 0183: the browser's box leaves fullscreen on Xbox and the pad
 * cannot reach it). A dialog of the components with Cancel first, so focus starts on the safe
 * answer; Esc and B say no.
 */
async function ask(q: Question, variant: ButtonVariant): Promise<boolean> {
  const dialog = new Dialog<boolean>({
    title: q.title,
    text: q.text,
    choices: [
      { label: t('confirm.cancel'), value: false },
      { label: q.ok, value: true, variant },
    ],
    cancel: false,
  });
  const yes = await dialog.ask();
  dialog.root.remove();
  return yes;
}

/** Asks before something the captain may regret: spending the last coin, giving up a race. */
export const askConfirm = (q: Question) => ask(q, 'plain');

/** Asks before something that cannot be undone: ink outline and a mark, never a red fill. */
export const askDanger = (q: Question) => ask(q, 'danger');
