import { SHIPPED_CATALOGUE } from '../../data/cosmetics';
import { FREE_PRESETS, FREE_RULES } from '../../data/freeSailing';
import { FREE_PARAM, everythingUnlocked, startFreeSession } from '../../sim/freeSailing';
import type { World } from '../../sim/world';
import type { QualityLevel } from '../../render/quality';
import { t } from '../../i18n';
import type { MenuRows } from '../screens/menuRows';
import { FreeSetupScreen } from './setup';

/**
 * Free Sailing in the game (decision 0266). The voyage page only links to it: `?free` reloads the
 * game as a session whose storage is memory, so the voyage's save is never opened, let alone
 * written. Leaving, the voyage page loads again from its untouched save.
 */
export { isFreeSailing } from '../../sim/freeSailing';

/** Every cosmetic open to try, in the session's Boat looks too. */
export const FREE_UNLOCKS = everythingUnlocked(SHIPPED_CATALOGUE);

interface FreeGame {
  /** The session's own world, built on memory storage. */
  world: World;
  quality: () => QualityLevel;
  /** After the world was put at the preset: into play. */
  play: () => void;
  /** The setup closed without setting sail: back to the menu. */
  menu: () => void;
  /** The title and the pause card, which list the session's own rows. */
  rows: readonly MenuRows[];
}

/** The title's Free Sailing row on the voyage page: a reload into `?free`. */
export function enterFreeSailing() {
  location.assign(`${location.pathname}?${FREE_PARAM}`);
}

/**
 * In a session: its setup screen, a badge at sea and the menu rows for changing the setup and
 * for the way back. Returns the setup, null on the voyage page.
 */
export function freeSailingIn(session: boolean, game: FreeGame): FreeSetupScreen | null {
  if (!session) return null;
  document.body.classList.add('free-sailing');
  const badge = document.createElement('p');
  badge.className = 'free-badge';
  badge.textContent = t('free.badge');
  document.body.append(badge);
  const setup = new FreeSetupScreen({
    presets: FREE_PRESETS,
    quality: game.quality,
    sail: (chosen) => {
      const preset = FREE_PRESETS.find((p) => p.id === chosen.preset)!;
      startFreeSession(game.world, preset, chosen, FREE_RULES);
      game.play();
    },
    leave: leaveFreeSailing,
    closed: game.menu,
  });
  for (const rows of game.rows) {
    rows.addRow('menu-free-setup', t('menu.freeSetup'), () => setup.open());
    rows.addRow('menu-free-leave', t('menu.freeLeave'), leaveFreeSailing);
  }
  return setup;
}

function leaveFreeSailing() {
  location.assign(location.pathname);
}
