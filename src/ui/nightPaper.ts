/**
 * Paper screens follow the day (issue #326). The theme (`src/data/ui/theme.json`) dims the
 * paper tokens under `data-night`; no CSS filter or blur, which are costly on old tablets
 * (decision 0006).
 */

import { TUNING } from '../data/tuning';
import { reducedMotion } from './motion';

/** Past this share of night the paper is dimmed, matching the scene's own dusk. */
const NIGHT_AT = 0.5;

let duskTimer: ReturnType<typeof setTimeout> | undefined;

/** The paper colours cross-fade for `duskFadeMs` after the flag flips (`moments.css`). */
function fadeDusk(root: HTMLElement): void {
  const ms = TUNING.ui.duskFadeMs;
  if (reducedMotion() || ms <= 0) return;
  root.style.setProperty('--ui-dusk-ms', `${ms}ms`);
  root.dataset.dusk = '';
  clearTimeout(duskTimer);
  duskTimer = setTimeout(() => delete root.dataset.dusk, ms);
}

/** Set the night flag on the root; the DOM is only touched when it changes. */
export function setNightPaper(night: number, root: HTMLElement = document.documentElement): void {
  const on = night >= NIGHT_AT;
  if (root.hasAttribute('data-night') === on) return;
  fadeDusk(root);
  root.toggleAttribute('data-night', on);
}
