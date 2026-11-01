import { t, type MessageKey } from '../../i18n';
import { raceClock, type RaceCardInfo } from '../regattaView';

/**
 * The race's finish board (decision 0274), one card in place of the three boxes a result used to
 * show: the medal won (or the course sailed, with none) and the finish order against Kestrel,
 * the one rival, your time and hers if she was first, your best, and the medal times. Places only,
 * never blame; the order is the race's own, never worked out from the medal.
 */
export type Place = 'first' | 'second' | 'retired';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const medalKey = (medal: number) => ['none', 'bronze', 'silver', 'gold'][medal] ?? 'none';
export const medalClass = (medal: number) => ['none', 'bronze', 'silver', 'gold'][medal] ?? 'none';

/** The finish order, as the race ran it: Kestrel's time is only set when she crossed first. */
export function placeOf(result: { rival?: number }): Place {
  return result.rival === undefined ? 'first' : 'second';
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
  return `<div class="race-board is-${medalClass(res.medal)}" data-place="${place}"><p class="race-board-place"><span class="race-medal" aria-hidden="true"></span><span><b>${esc(t(`regatta.result.${medalKey(res.medal)}.title` as MessageKey))}</b><br>${esc(placeLine(place))}</span></p><ul class="race-board-rows">${rows}</ul><p class="race-label">${esc(r.label)}</p><ul class="race-times">${times}</ul></div>`;
}
