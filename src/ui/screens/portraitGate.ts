import { bootTexts } from '../../i18n/bootTexts';
import { SHIPPED_THEME } from '../theme/model';
import './portraitGate.css';

const SPRITE_USE = (id: string) =>
  `<svg class="gate-logo" aria-hidden="true"><use href="#${id}" /></svg>`;

/** The phone being turned: an ink phone, drawn once, that tips on its side (CSS). */
const PHONE = `<svg class="gate-phone" viewBox="0 0 60 60" aria-hidden="true">
  <g class="gate-phone-body"><rect x="19" y="6" width="22" height="42" rx="4" /><path d="M27 43H33" /></g>
  <path class="gate-phone-arrow" d="M46 14Q56 24 48 36M48 36 46 29M48 36 54 33" />
</svg>`;

/**
 * Portrait on a phone (issue #458): the game is played in landscape. A touch device whose short
 * side is phone-sized and which is held upright shows the turn-your-phone page instead of the
 * game (decision 0268: no portrait layout). Tablets and desktop windows are never blocked.
 */
const query = () =>
  window.matchMedia(
    `(orientation: portrait) and (pointer: coarse) and (max-width: ${SHIPPED_THEME.breakpoints['phone-max-height']}px)`,
  );

let gate: HTMLElement | null = null;

/** Whether the game is out of sight (hidden tab or portrait page): rendering and music stop, saving battery. */
export function awayFromGame(): boolean {
  return document.hidden || gate !== null;
}

function build(): HTMLElement {
  const texts = bootTexts();
  const root = document.createElement('div');
  root.className = 'portrait-gate';
  root.setAttribute('role', 'alert');
  root.innerHTML =
    `<div class="logo">${SPRITE_USE('i-logo')}<svg class="logo-word" aria-hidden="true"><use href="#i-wordmark" /></svg></div>` +
    PHONE;
  const line = document.createElement('p');
  line.className = 'gate-line';
  line.textContent = texts.turnPhone;
  const tagline = document.createElement('p');
  tagline.className = 'gate-tagline';
  tagline.textContent = texts.tagline;
  root.append(line, tagline);
  return root;
}

function apply(portrait: boolean) {
  if (portrait === (gate !== null)) return;
  if (portrait) {
    gate = build();
    document.body.append(gate);
  } else {
    gate?.remove();
    gate = null;
  }
  // The game's visibility handler (main.ts) stops the loop and the music and starts them again.
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Shows the page while a phone is held upright; it goes away by itself on rotation. */
export function installPortraitGate(): void {
  const media = query();
  apply(media.matches);
  media.addEventListener('change', (e) => apply(e.matches));
}
