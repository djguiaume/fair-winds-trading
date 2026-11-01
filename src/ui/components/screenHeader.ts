import { t } from '../../i18n';
import { icon } from '../icons';
import { el, onPress } from './dom';

/**
 * The one screen header (decision 0269): the title, a back (left) or close (right) button and a
 * slot for the pad's button legend. The button is `data-pad-close`: the pad's focus does not
 * start on it, since B already goes back (padFocus.ts).
 */
export type HeaderExit = 'back' | 'close';

export interface ScreenHeaderOptions {
  title: string;
  exit?: HeaderExit;
  onExit?: () => void;
  /** A slot for the pad's legend (A choose, B back…). */
  legend?: boolean;
}

export interface ScreenHeader {
  root: HTMLElement;
  title: HTMLElement;
  exit: HTMLButtonElement | null;
  legend: HTMLElement | null;
}

const BACK =
  '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>';

function exitButton(kind: HeaderExit, press: () => void): HTMLButtonElement {
  const b = el('button', `ui-header-exit ui-header-exit--${kind} ui-pressable`);
  b.type = 'button';
  b.dataset.padClose = '';
  b.setAttribute('aria-label', t(kind === 'back' ? 'ui.back' : 'ui.close'));
  b.innerHTML = kind === 'back' ? BACK : icon('close');
  onPress(b, press, 'back');
  return b;
}

export function screenHeader(o: ScreenHeaderOptions): ScreenHeader {
  const root = el('header', 'ui-header');
  const title = el('h1', 'ui-header-title', o.title);
  const kind = o.exit ?? 'back';
  const exit = o.onExit ? exitButton(kind, o.onExit) : null;
  const legend = o.legend ? el('div', 'ui-header-legend') : null;
  if (exit && kind === 'back') root.append(exit);
  root.append(title);
  if (legend) root.append(legend);
  if (exit && kind === 'close') root.append(exit);
  return { root, title, exit, legend };
}
