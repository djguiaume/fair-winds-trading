import { SHIPPED_CATALOGUE } from '../../data/cosmetics';
import { FREE_PRESETS, FREE_RULES } from '../../data/freeSailing';
import { FREE_PARAM, everythingUnlocked, startFreeSession } from '../../sim/freeSailing';
import type { World } from '../../sim/world';
import type { QualityLevel } from '../../render/quality';
import { type MessageKey, t } from '../../i18n';
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
}

/**
 * The menu rows: on the voyage page, Free Sailing (a reload into `?free`); in a session, its
 * setup screen, a badge at sea and the way back. Returns the setup, null on the voyage page.
 */
export function freeSailingIn(session: boolean, game: FreeGame): FreeSetupScreen | null {
  if (!session) {
    menuRow('menu-free', '#i-sail', 'menu.free', 'menu.freeNote').addEventListener('click', () =>
      location.assign(`${location.pathname}?${FREE_PARAM}`),
    );
    return null;
  }
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
  menuRow('menu-free-setup', '#i-sail', 'menu.freeSetup').addEventListener('click', () =>
    setup.open(),
  );
  menuRow('menu-free-leave', '#i-anchor', 'menu.freeLeave').addEventListener(
    'click',
    leaveFreeSailing,
  );
  return setup;
}

function leaveFreeSailing() {
  location.assign(location.pathname);
}

/** A title menu row before Settings, in the menu's own markup. */
function menuRow(id: string, icon: string, label: MessageKey, note?: MessageKey): HTMLElement {
  const row = document.createElement('button');
  row.id = id;
  row.type = 'button';
  row.className = 'menu-row';
  row.innerHTML = `<svg class="icon" aria-hidden="true"><use href="${icon}" /></svg><span data-i18n="${label}">${t(label)}</span>${note ? `<small data-i18n="${note}">${t(note)}</small>` : ''}`;
  document.getElementById('menu-settings')!.before(row);
  return row;
}
