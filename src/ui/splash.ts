import './splash.css';

const STATUS: Record<string, string> = { en: 'Loading', fr: 'Chargement' };

/** The one word, in the saved or browser language, before the game's own texts are loaded. */
export function showSplashLanguage() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  try {
    const saved = JSON.parse(localStorage.getItem('fwt.settings.v1') || '{}').language;
    const language = String(saved || navigator.language || '').slice(0, 2);
    splash.dataset.status = STATUS[language] ?? STATUS.en!;
  } catch {
    // The English word in the page stays.
  }
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
