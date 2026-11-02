import boot from './boot.json';

/**
 * The few texts shown before the game's own texts are loaded (the loading screen and the portrait
 * page). They sit in their own small file so boot.ts need not pull in all of en.json and fr.json.
 */
export type BootTexts = (typeof boot)['en'];

/** The saved language, else the browser's, else English. */
export function bootTexts(): BootTexts {
  let saved: unknown;
  try {
    saved = JSON.parse(localStorage.getItem('fwt.settings.v1') || '{}').language;
  } catch {
    // Private mode: the browser's language below.
  }
  const language = String(saved || navigator.language || '').slice(0, 2);
  return language === 'fr' ? boot.fr : boot.en;
}
