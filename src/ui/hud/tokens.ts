import { TUNING } from '../../data/tuning';
import { RULES } from '../../sim/cosmetics';
import { SHIPPED_THEME, withOpacity } from '../theme/model';

/** A signal colour the game keeps for itself (`rules.json` › `reservedColours`), by its name. */
function signal(name: string): string {
  return RULES.reservedColours.find((c) => c.name === name)?.hex ?? '#000000';
}

/**
 * The sea HUD's custom properties (issue #441): the two ink backings and the idle fade from
 * `hud.json` (its sizes are theme tokens, `--ui-hud-*`), the ink from the theme, and the storm amber and danger red from the game's reserved
 * signal colours, which only warnings may wear (art bible section 11).
 */
export function hudTokens(): Record<string, string> {
  const h = TUNING.hud;
  const ink = SHIPPED_THEME.colour.ink ?? '#23303a';
  return {
    '--hud-backing': withOpacity(ink, h.backingInk),
    '--hud-nogo': withOpacity(ink, h.noGoInk),
    '--hud-idle': String(h.idleOpacity),
    '--hud-storm': signal('storm amber'),
    '--hud-danger': signal('edge-buoy red'),
  };
}

/** Writes them on the HUD's root. */
export function applyHudTokens(root: HTMLElement): void {
  for (const [name, value] of Object.entries(hudTokens())) root.style.setProperty(name, value);
}
