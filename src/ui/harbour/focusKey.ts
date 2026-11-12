/** How to find the focused control of a panel again after a redraw: its id, else its data attributes. */
export function focusKey(container: HTMLElement): string {
  const at = container.ownerDocument.activeElement as HTMLElement | null;
  if (!at || !container.contains(at) || at === container) return '';
  if (at.id) return `#${at.id}`;
  return [...at.attributes]
    .filter((a) => a.name.startsWith('data-') && !['data-qty', 'data-pad-focus'].includes(a.name))
    .map((a) => `[${a.name}="${a.value}"]`)
    .join('');
}
