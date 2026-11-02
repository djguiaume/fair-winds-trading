import type { UiEvent } from '../../audio/catalog';
import { uiSound } from '../uiSound';

/** A new element with its classes and, optionally, its text: the components' one DOM helper. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Runs `onPress` on a click and makes its sound (`press` unless told); a soft-disabled control
 * (`aria-disabled`, padFocus.ts) does nothing but sound the error.
 */
export function onPress(
  node: HTMLElement,
  press: (() => void) | undefined,
  sound: UiEvent = 'press',
) {
  if (!press) return;
  node.addEventListener('click', () => {
    if (node.getAttribute('aria-disabled') === 'true') return uiSound('error');
    uiSound(sound);
    press();
  });
}

/** Marks a card or a list row chosen or not, one of a set. */
export function setSelected(node: HTMLElement, on: boolean) {
  node.setAttribute('aria-pressed', String(on));
}

/** Keeps Tab and Shift+Tab inside a modal screen: past its last button back to its first. */
export function trapTab(screen: HTMLElement, e: KeyboardEvent) {
  if (e.key !== 'Tab') return;
  const buttons = [...screen.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const first = buttons[0];
  const last = buttons.at(-1);
  const at = document.activeElement;
  if (!first) {
    e.preventDefault();
    screen.focus();
  } else if (e.shiftKey && (at === first || at === screen)) {
    e.preventDefault();
    last?.focus();
  } else if (!e.shiftKey && at === last) {
    e.preventDefault();
    first.focus();
  }
}
