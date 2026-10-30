import controls from '../data/controls.json';

/**
 * The game in a console's browser on a TV (decision 0183): Microsoft Edge on Xbox. Three things
 * differ from a desktop browser there, and this module handles them before the game starts:
 *
 * - Edge on Xbox drives a mouse pointer with the controller unless the page asks for the pad
 *   (`navigator.gamepadInputEmulation = "gamepad"`); then the Gamepad API (decision 0162) gets
 *   every button, and B no longer means the browser's Back.
 * - Many TVs crop the picture's edges (overscan), so the HUD keeps a margin inside the screen:
 *   `--tv-safe-x` / `--tv-safe-y`, which every `--safe-*` inset in the CSS takes into account.
 * - If B still reaches the browser as Back, the game keeps an extra history entry so Back stays
 *   in the game instead of leaving it (the voyage autosaves anyway).
 *
 * What counts as a TV and the numbers are in `src/data/controls.json` › `tv` (decision 0093).
 * `?tv` forces TV mode on any browser (to test it on a desktop), `?tv=0` turns it off.
 */
export interface TvConfig {
  /** Words in the browser's user agent that mean a console on a TV. */
  userAgents: string[];
  /** What Edge on Xbox should do with the controller: "gamepad" hands it to the page. */
  gamepadInputEmulation: string;
  /** Margin kept free at each edge, as a share of the screen's width (x) and height (y). */
  safeMargin: { x: number; y: number };
  /** Keep an extra history entry so the browser's Back stays in the game. */
  stayOnBack: boolean;
}

export const TV = controls.tv as TvConfig;

/** Problems in the `tv` section: no user agents, margins outside 0..0.2. */
export function tvProblems(c: TvConfig = TV): string[] {
  const out: string[] = [];
  if (!c.userAgents.length || c.userAgents.some((u) => !u.trim()))
    out.push('tv.userAgents: needs at least one non-empty word');
  for (const k of ['x', 'y'] as const)
    if (!(c.safeMargin[k] >= 0 && c.safeMargin[k] <= 0.2))
      out.push(`tv.safeMargin.${k} must be 0..0.2`);
  if (!c.gamepadInputEmulation) out.push('tv.gamepadInputEmulation: empty');
  return out;
}

/** Whether this browser is a console on a TV: `?tv` / `?tv=0` win, else the user agent. */
export function isTv(userAgent: string, search: string, c: TvConfig = TV): boolean {
  const q = new URLSearchParams(search);
  if (q.has('tv')) return q.get('tv') !== '0';
  return c.userAgents.some((word) => userAgent.includes(word));
}

/** The slices of `window` TV mode touches (easy to fake in tests). */
export interface TvWindow {
  navigator: { userAgent: string; gamepadInputEmulation?: string };
  location: { search: string };
  history: Pick<History, 'state' | 'pushState'>;
  document: { documentElement: Pick<HTMLElement, 'classList' | 'style'> };
  addEventListener: Window['addEventListener'];
}

const STATE = { fairWindsTv: true };

/**
 * Turn TV mode on when this is a TV (see `isTv`). Call it before the game builds its screens.
 * Returns whether TV mode is on.
 */
export function startTvMode(win: TvWindow = window as unknown as TvWindow, c: TvConfig = TV) {
  if (!isTv(win.navigator.userAgent, win.location.search, c)) return false;
  try {
    // Edge on Xbox reads this to stop moving a pointer with the pad; other browsers ignore it.
    win.navigator.gamepadInputEmulation = c.gamepadInputEmulation;
  } catch {
    // A browser where the property is read-only: nothing to hand over.
  }
  const root = win.document.documentElement;
  root.classList.add('tv');
  root.style.setProperty('--tv-safe-x', `${c.safeMargin.x * 100}vw`);
  root.style.setProperty('--tv-safe-y', `${c.safeMargin.y * 100}vh`);
  if (c.stayOnBack) {
    // Browsers skip history entries a page adds before the player touches it, so the entry is
    // added (again) on each press until it is there, and again after Back took it away.
    const arm = () => {
      if (!(win.history.state as typeof STATE | null)?.fairWindsTv)
        win.history.pushState(STATE, '');
    };
    win.addEventListener('pointerdown', arm, true);
    win.addEventListener('keydown', arm, true);
    win.addEventListener('popstate', arm);
  }
  return true;
}
