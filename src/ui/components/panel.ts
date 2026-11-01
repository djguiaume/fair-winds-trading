import { el } from './dom';

/**
 * The one panel (decision 0269): paper with the torn 9-slice edge (a theme image, no CSS
 * filter), or plain. At night it follows the scene (`html[data-night]`) to the night paper;
 * `night` forces either look (the editors' preview, a screen that is always lit).
 */
export type PanelEdge = 'torn' | 'plain';
export type PanelNight = 'auto' | 'day' | 'night';

export interface PanelOptions {
  edge?: PanelEdge;
  night?: PanelNight;
  /** The element: a section by default, `div` inside another panel. */
  tag?: 'section' | 'div' | 'aside';
}

export function panelClasses(edge: PanelEdge = 'torn', night: PanelNight = 'auto'): string {
  return ['ui-panel', `ui-panel--${edge}`, night === 'auto' ? '' : `ui-panel--${night}`]
    .filter(Boolean)
    .join(' ');
}

export function panel(o: PanelOptions = {}, ...children: Node[]): HTMLElement {
  const root = el(o.tag ?? 'section', panelClasses(o.edge, o.night));
  root.append(...children);
  return root;
}
