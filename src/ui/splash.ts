import './splash.css';
import { bootTexts } from '../i18n/bootTexts';

const RESTING = 0.92;
const CREEP_MS = 250;

function setProgress(splash: HTMLElement, p: number) {
  splash.style.setProperty('--splash-p', p.toFixed(3));
}

/** The words in the saved or browser language, before the game's own texts are loaded. */
export function showSplashLanguage() {
  const texts = bootTexts();
  const tag = document.getElementById('splash-tag');
  const status = document.getElementById('splash-status');
  if (tag) tag.textContent = texts.tagline;
  if (status) status.textContent = texts.hoisting;
}

/**
 * Moves the boat along the wave as the game loads. The browser reports no progress for a module
 * graph, so the boat steps at the known points (fonts ready, game requested) and eases towards
 * the end between them; `finish` sends it home.
 */
export function followSplashProgress(): { finish(): Promise<void> } {
  const splash = document.getElementById('splash');
  if (!splash) return { finish: () => Promise.resolve() };
  let p = 0.06;
  const bump = (to: number) => {
    p = Math.max(p, to);
    setProgress(splash, p);
  };
  const creep = setInterval(() => bump(p + (RESTING - p) * 0.06), CREEP_MS);
  void document.fonts?.ready.then(() => bump(0.3));
  return {
    finish: () => {
      clearInterval(creep);
      bump(1);
      // Let the boat reach the end of the line before the screen fades.
      return new Promise((done) => setTimeout(done, 450));
    },
  };
}

/** Fades the start view out once the menu is up, then removes it. */
export function dismissSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('is-done');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  // No transition runs when the tab is hidden: remove it anyway.
  setTimeout(() => splash.remove(), 800);
}
