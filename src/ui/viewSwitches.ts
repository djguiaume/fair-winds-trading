import { switchRow } from './graphicsSettings';
import type { Settings } from './settings';

/** What the switches drive on the view. */
interface SwitchedView {
  eruptions: boolean;
  wakeStyles: boolean;
}

/**
 * Settings switches that only change what the sea shows: Eruptions (decision 0178: spectacle only,
 * but switchable like every annoyance; off, volcanoes only smoke and a quest's story eruption plays
 * anyway) and, after it, Wake styles (issue #418: off, the plain wake whatever the boat's look).
 * `keep` stores the settings after a change.
 */
export function wireViewSwitches(view: SwitchedView, settings: Settings, keep: () => void) {
  const eruptions = document.getElementById('eruptions') as HTMLInputElement;
  view.eruptions = eruptions.checked = settings.eruptions;
  eruptions.addEventListener('change', () => {
    view.eruptions = settings.eruptions = eruptions.checked;
    keep();
  });
  view.wakeStyles = settings.wakeStyles;
  const wakes = switchRow('wake-styles', 'settings.wakeStyles', settings.wakeStyles, (on) => {
    view.wakeStyles = settings.wakeStyles = on;
    keep();
  });
  eruptions.closest('.set-row')?.after(wakes);
}
