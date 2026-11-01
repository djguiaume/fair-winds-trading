import { icon } from '../icons';
import { el, onPress } from './dom';

/**
 * The one button (decision 0269). `primary` (sage) is a screen's main action and where the pad's
 * focus starts (`data-pad-main`); `plain` (paper) is every other choice; `danger` only confirms
 * something that cannot be undone (New game, abandon), and the pad never starts on it.
 */
export type ButtonVariant = 'primary' | 'plain' | 'danger';
export const BUTTON_VARIANTS: readonly ButtonVariant[] = ['primary', 'plain', 'danger'];

export interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  /** A sprite icon id (`#i-<id>`), shown before the label. */
  icon?: string;
  /** Soft-disabled: it stays reachable by the pad but does nothing (padFocus.ts). */
  disabled?: boolean;
  onPress?: () => void;
}

export function button(o: ButtonOptions): HTMLButtonElement {
  const variant = o.variant ?? 'plain';
  const b = el('button', `ui-btn ui-btn--${variant} ui-pressable`);
  b.type = 'button';
  if (variant === 'primary') b.dataset.padMain = '';
  if (variant === 'danger') b.dataset.padStart = 'never';
  if (o.icon) b.insertAdjacentHTML('beforeend', icon(o.icon));
  b.append(el('span', 'ui-btn-label', o.label));
  setDisabled(b, Boolean(o.disabled));
  onPress(b, o.onPress, variant === 'primary' ? 'confirm' : 'press');
  return b;
}

/** Turns a component's control off or on again, the way padFocus.ts expects. */
export function setDisabled(control: HTMLElement, off: boolean) {
  if (off) control.setAttribute('aria-disabled', 'true');
  else control.removeAttribute('aria-disabled');
}
