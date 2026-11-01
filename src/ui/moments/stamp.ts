import { type MessageKey, t } from '../../i18n';
import { uiSound } from '../uiSound';
import { motionMode } from '../motionMode';
import { playEnter } from '../motion';
import { TUNING } from '../../data/tuning';
import { el } from '../components/dom';
import type { QuestCardModel } from '../questView';

/**
 * The quest stamp (decision 0274): a step done or a quest complete is stamped in ink on its card
 * (and on the note at sea), with a thump. Each moment stamps once. With Motion off nothing is
 * drawn (the thump still sounds); Reduced draws it without the press.
 */
const stamped = new Set<string>();

/** The stamp's word for this card, or null when it is not a step done or a quest complete. */
export function stampWord(card: QuestCardModel): MessageKey | null {
  if (card.race) return null;
  if (card.kind === 'finished') return 'moments.stamp.complete';
  if ((card.kind === 'step' || card.kind === 'choice') && card.stepNo > 1)
    return 'moments.stamp.step';
  return null;
}

/** Stamps `host` for this card, the first time only. */
export function stampCard(host: HTMLElement | null, card: QuestCardModel): void {
  const word = stampWord(card);
  const key = `${card.quest}:${card.kind}:${card.stepNo}`;
  if (!host || !word || stamped.has(key)) return;
  stamped.add(key);
  stampOn(host, t(word));
}

export function stampOn(host: HTMLElement, word: string): void {
  uiSound('stamp');
  if (motionMode() === 'off') return;
  const mark = el('span', 'moment-stamp', word);
  mark.setAttribute('aria-hidden', 'true');
  mark.style.setProperty('--stamp-ms', `${TUNING.ui.stampMs}ms`);
  host.append(mark);
  playEnter(mark, 'stamp');
}

/** For tests: forget what was stamped. */
export const forgetStamps = () => stamped.clear();
