import { el, onPress, setSelected } from './dom';

/**
 * The one card (decision 0269): a title, a line of text and an optional picture (a ship, a
 * level's pennant). With `onPress` it is a button the pad can reach; `selected` marks the
 * chosen one of a set (`aria-pressed`).
 */
export interface CardOptions {
  title: string;
  text?: string;
  media?: Node;
  selected?: boolean;
  onPress?: () => void;
}

export function card(o: CardOptions): HTMLElement {
  const root = o.onPress ? el('button', 'ui-card ui-pressable') : el('article', 'ui-card');
  if (root instanceof HTMLButtonElement) root.type = 'button';
  if (o.media) {
    const media = el('span', 'ui-card-media');
    media.append(o.media);
    root.append(media);
  }
  root.append(el('span', 'ui-card-title', o.title));
  if (o.text) root.append(el('span', 'ui-card-text', o.text));
  if (o.selected !== undefined) setSelected(root, o.selected);
  onPress(root, o.onPress);
  return root;
}
