import { SHIPPED_THEME, type Theme, layoutFor, themeCss } from './model';

/**
 * The theme on the page at boot (decision 0269): one `<style>` of custom properties, first in
 * the head so every stylesheet reads it, and `html[data-layout]` for the two breakpoints, which
 * CSS media queries cannot take from custom properties.
 */

const STYLE_ID = 'ui-theme';

/** Writes the theme's custom properties into the page (again, after an edit). */
export function applyTheme(
  theme: Theme = SHIPPED_THEME,
  doc: Document = document,
): HTMLStyleElement {
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.prepend(style);
  }
  style.textContent = themeCss(theme);
  return style;
}

/** Keeps `html[data-layout]` on phone, mid or desktop as the window changes size. */
export function followLayout(theme: Theme = SHIPPED_THEME, win: Window = window): void {
  const root = win.document.documentElement;
  const update = () => {
    const layout = layoutFor(win.innerWidth, win.innerHeight, theme);
    if (root.dataset.layout !== layout) root.dataset.layout = layout;
  };
  update();
  win.addEventListener('resize', update, { passive: true });
}
