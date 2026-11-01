import { formatNumber } from '../../i18n';
import { el } from '../components/dom';
import { COIN, icon } from '../icons';

/**
 * Small pieces every harbour pane uses (issue #443): a price with its coin, a good's round art,
 * level pips, a tab's badge. They draw with the v1.5 components' tokens only.
 */

/** "⊙ 23": a price or a sum of gold. */
export function coins(n: number): string {
  return `${COIN}<b>${formatNumber(n)}</b>`;
}

/** A good's icon on a round paper disc: the ledger's and the detail pane's art. */
export function goodArt(good: string, size: 'row' | 'big' = 'row'): HTMLElement {
  const art = el('span', `hb-good-art hb-good-art--${size}`);
  art.innerHTML = icon(good);
  return art;
}

/** `n` of `of` levels as filled pips. */
export function pips(n: number, of: number): HTMLElement {
  const row = el('span', 'hb-pips');
  row.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < of; i++) row.append(el('i', i < n ? 'is-on' : ''));
  return row;
}

/** A count on a tab or a person ("4", "New"); `quay` marks the people's sage one. */
export function badge(text: string | number, quay = false): HTMLElement {
  return el('span', `tab-badge${quay ? ' is-quay' : ''}`, String(text));
}

/** A labelled pair for a ledger cell: a big value over its small label. */
export function figure(value: string, label: string, cls = ''): HTMLElement {
  const cell = el('span', `hb-figure ${cls}`.trim());
  const b = el('b', '');
  b.innerHTML = value;
  cell.append(b, el('small', '', label));
  return cell;
}

/** HTML-safe text for the few lines built as markup (names from the save and quest files). */
export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
