/**
 * Paper screens follow the day (issue #326). `theme.css` dims the paper tokens under
 * `data-night`; no CSS filter or blur, which are costly on old tablets (decision 0006).
 */

/** Past this share of night the paper is dimmed, matching the scene's own dusk. */
const NIGHT_AT = 0.5;

/** Set the night flag on the root; the DOM is only touched when it changes. */
export function setNightPaper(night: number, root: HTMLElement = document.documentElement): void {
  const on = night >= NIGHT_AT;
  if (root.hasAttribute('data-night') !== on) root.toggleAttribute('data-night', on);
}
