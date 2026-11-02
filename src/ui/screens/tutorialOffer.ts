import { t } from '../../i18n';
import { Dialog } from '../components';
import { el } from '../components/dom';
import { icon } from '../icons';
import './tutorialOffer.css';

export type OfferAnswer = 'start' | 'skip';

/** What the first voyage teaches, in order: an icon of the sprite and a `tutorial.theme*` word. */
const THEMES = [
  ['sail', 'themeSails'],
  ['compass', 'themeWind'],
  ['chart-boat', 'themeRescue'],
  ['anchor', 'themeDock'],
  ['coin', 'themeDeliver'],
] as const;

/**
 * The first voyage's offer (decision 0127): what the hints cover, then Start tutorial or Skip the
 * lessons. Esc and B skip, as they always did.
 */
export function tutorialOfferDialog(): Dialog<OfferAnswer> {
  const body = el('div', 'offer-body');
  const list = el('ul', 'offer-steps');
  for (const [id, word] of THEMES) {
    const item = el('li', '');
    item.innerHTML = `${icon(id)}<span>${t(`tutorial.${word}`)}</span>`;
    list.append(item);
  }
  body.append(list, el('p', 'offer-note', t('tutorial.offerNote')));
  const dialog = new Dialog<OfferAnswer>({
    title: t('tutorial.offerTitle'),
    text: t('tutorial.offerCopy'),
    body,
    choices: [
      { label: t('tutorial.start'), value: 'start', variant: 'primary' },
      { label: t('tutorial.skipLessons'), value: 'skip' },
    ],
    cancel: 'skip',
  });
  dialog.root.id = 'tutorial-offer';
  [dialog.buttons[0]!.id, dialog.buttons[1]!.id] = ['tutorial-start', 'tutorial-free'];
  return dialog;
}
