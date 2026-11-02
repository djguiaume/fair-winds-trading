import { goodName, t } from '../../i18n';
import { creditOffer } from '../../sim/credit';
import { findPort } from '../../sim/trade';
import type { World } from '../../sim/world';
import { button } from '../components/button';
import { el } from '../components/dom';
import { icon } from '../icons';

/**
 * Notes under the Market's detail pane: a load on credit (decision 0200), the harbour office's
 * offer while she is broke with an empty hold, or what she owes while a loan is open; and the
 * quest cargo on deck (decision 0213), not for sale and not in the hold, so whose it is.
 */
export function creditNote(
  world: World,
  hidden: boolean,
  answer: (take: boolean) => void,
): HTMLElement | null {
  const { trade, map } = world;
  const portName = (id: string) => findPort(map, id)?.name ?? id;
  const loan = trade.captain.loan;
  if (loan) {
    const owed = t('trade.creditOwed', {
      price: loan.owed,
      good: goodName(loan.good).toLowerCase(),
      port: portName(loan.port),
    });
    return note('hb-credit is-owed', `${icon(loan.good)} ${owed}`);
  }
  const offer = hidden ? null : creditOffer(map, trade);
  if (!offer) return null;
  const text = t('trade.creditText', {
    goods: t('trade.contractGoods', { qty: offer.qty, good: goodName(offer.good).toLowerCase() }),
    port: portName(offer.port),
    price: offer.price,
  });
  const box = note('hb-credit', `${icon(offer.good)} ${text}`, t('trade.creditTitle'));
  const take = button({ label: t('trade.creditTake'), onPress: () => answer(true) });
  take.id = 'tp-credit-take';
  const later = button({ label: t('trade.creditLater'), onPress: () => answer(false) });
  later.id = 'tp-credit-later';
  const row = el('div', 'hb-note-actions');
  row.append(take, later);
  box.append(row);
  return box;
}

export function questCargoNote(lines: readonly string[]): HTMLElement | null {
  if (!lines.length) return null;
  const box = note('hb-quest-cargo', '', t('quest.cargoTitle'));
  const ul = el('ul', '');
  for (const line of lines) ul.append(el('li', '', line));
  box.append(ul);
  return box;
}

/** A small note on the paper, with an optional title; `html` holds icons and game words. */
function note(cls: string, html: string, title?: string): HTMLElement {
  const box = el('section', `hb-note ${cls}`);
  if (title) box.append(el('h4', '', title));
  if (html) {
    const p = el('p', '');
    p.innerHTML = html;
    box.append(p);
  }
  return box;
}
