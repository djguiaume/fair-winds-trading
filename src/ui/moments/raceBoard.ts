import { t, type MessageKey } from '../../i18n';
import type { MedalRank } from '../../sim/regatta';
import { raceClock, type RaceCardInfo } from '../regattaView';

/**
 * The race's finish board (decision 0274), one card in place of the three boxes a result used to
 * show: the medal and the place line, your time and Kestrel's if she was first, your best, and
 * the medal times. Places only, never blame: with Kestrel ahead you are second, or third and home
 * safe without a medal.
 */
export type Place = 'first' | 'second' | 'third' | 'retired';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
export const medalClass = (medal: number) => ['none', 'bronze', 'silver', 'gold'][medal] ?? 'none';

/** Where the finish put the captain. */
export function placeOf(result: { medal: MedalRank; rival?: number }): Place {
  if (result.rival === undefined) return 'first';
  return result.medal > 0 ? 'second' : 'third';
}

export const placeLine = (place: Place) => t(`regatta.board.${place}` as MessageKey);

/** The board for a race just sailed (`r.result` set); `times` is the card's medal times list. */
export function raceBoardHtml(r: RaceCardInfo, times: string): string {
  const res = r.result!;
  const place = placeOf(res);
  const rows = [
    `<li class="is-you"><span>${esc(t('regatta.yourTime'))}</span><b>${raceClock(res.sec)}</b></li>`,
    res.rival !== undefined
      ? `<li><span>${esc(t('regatta.board.kestrel'))}</span><b>${raceClock(res.rival)}</b></li>`
      : '',
    r.best !== undefined
      ? `<li><span>${esc(t('regatta.board.best'))}</span><b>${raceClock(r.best)}</b></li>`
      : '',
  ].join('');
  return `<div class="race-board is-${medalClass(res.medal)}" data-place="${place}"><p class="race-board-place"><span class="race-medal" aria-hidden="true"></span>${esc(placeLine(place))}</p><ul class="race-board-rows">${rows}</ul><p class="race-label">${esc(r.label)}</p><ul class="race-times">${times}</ul></div>`;
}
