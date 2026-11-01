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

/** Runs `onPress` on a click, unless the control is soft-disabled (`aria-disabled`, padFocus.ts). */
export function onPress(node: HTMLElement, press: (() => void) | undefined) {
  if (!press) return;
  node.addEventListener('click', () => {
    if (node.getAttribute('aria-disabled') !== 'true') press();
  });
}

/** Marks a card or a list row chosen or not, one of a set. */
export function setSelected(node: HTMLElement, on: boolean) {
  node.setAttribute('aria-pressed', String(on));
}
