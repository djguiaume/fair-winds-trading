import { FREE_PRESETS, FREE_RULES } from '../../data/freeSailing';
import { FREE_PARAM, startFreeSession } from '../../sim/freeSailing';
import type { World } from '../../sim/world';
import type { QualityLevel } from '../../render/quality';
import { t } from '../../i18n';
import { FreeSetupScreen } from './setup';

/**
 * Free Sailing in the game (decision 0266). The voyage page only links to it: `?free` reloads the
 * game as a session whose storage is memory, so the voyage's save is never opened, let alone
 * written. Leaving, the voyage page loads again from its untouched save.
 */
export function openFreeSailing() {
  location.assign(`${location.pathname}?${FREE_PARAM}`);
}

export function leaveFreeSailing() {
  location.assign(location.pathname);
}

interface FreeGame {
  /** The session's own world, built on memory storage. */
  world: World;
  quality: () => QualityLevel;
  /** After the world was put at the preset: into play. */
  play: () => void;
  /** The setup closed without setting sail: back to the menu. */
  menu: () => void;
}

/** The session's setup screen and its badge at sea; `open` shows the setup. */
export function freeSessionIn(game: FreeGame): FreeSetupScreen {
  document.body.classList.add('free-sailing');
  const badge = document.createElement('p');
  badge.className = 'free-badge';
  badge.textContent = t('free.badge');
  document.body.append(badge);
  return new FreeSetupScreen({
    presets: FREE_PRESETS,
    quality: game.quality,
    sail: (setup) => {
      const preset = FREE_PRESETS.find((p) => p.id === setup.preset)!;
      startFreeSession(game.world, preset, setup, FREE_RULES);
      game.play();
    },
    leave: leaveFreeSailing,
    closed: game.menu,
  });
}
