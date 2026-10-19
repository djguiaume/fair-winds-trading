import { type LanguageId, isLanguage } from '../i18n';
import type { QualitySetting } from '../render/quality';

export type UiMode = 'adult' | 'kids';

/** Player settings, saved in localStorage (versioned key so the format can change later). */
export interface Settings {
  quality: QualitySetting;
  showFps: boolean;
  seenHelp: boolean;
  seenWindHint: boolean;
  uiMode: UiMode;
  /** Chosen language; null follows the browser (decision 0037). */
  language: LanguageId | null;
}

const KEY = 'fwt.settings.v1';
const DEFAULTS: Settings = {
  quality: 'auto',
  showFps: false,
  seenHelp: false,
  seenWindHint: false,
  uiMode: 'adult',
  language: null,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const settings = raw
      ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
      : { ...DEFAULTS };
    if (!isLanguage(settings.language)) settings.language = null;
    return settings;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode or storage full: settings just won't persist.
  }
}
