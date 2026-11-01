import { icon } from '../icons';
import { el, onPress, setSelected } from './dom';

/**
 * The one list row (decision 0269): 56 to 64 px tall (theme `touch.row-*`), an optional icon, a
 * label with a detail line under it, a value at the end (a price, a count). With `onPress` it
 * is a button the pad can reach.
 */
export interface ListRowOptions {
  label: string;
  detail?: string;
  value?: string;
  icon?: string;
  selected?: boolean;
  onPress?: () => void;
}

export function listRow(o: ListRowOptions): HTMLElement {
  const root = o.onPress ? el('button', 'ui-row ui-pressable') : el('div', 'ui-row');
  if (root instanceof HTMLButtonElement) root.type = 'button';
  if (o.icon) root.insertAdjacentHTML('beforeend', icon(o.icon, 'ui-row-icon'));
  const words = el('span', 'ui-row-words');
  words.append(el('span', 'ui-row-label', o.label));
  if (o.detail) words.append(el('span', 'ui-row-detail', o.detail));
  root.append(words);
  if (o.value !== undefined) root.append(el('span', 'ui-row-value', o.value));
  if (o.selected !== undefined) setSelected(root, o.selected);
  onPress(root, o.onPress);
  return root;
}
