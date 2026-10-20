import { type LanguageId, isLanguage } from '../i18n';
import type { QualitySetting } from '../render/quality';

export type UiMode = 'adult' | 'kids';

/**
 * Kids mode is hidden until its rework (decision 0043): the code stays, but it can't be picked
 * and a saved 'kids' preference falls back to Captain mode. Flip to true to bring it back.
 */
export const KIDS_MODE_AVAILABLE = false;

/** Player settings, saved in localStorage (versioned key so the format can change later). */
export interface Settings {
  quality: QualitySetting;
  showFps: boolean;
  seenHelp: boolean;
  seenWindHint: boolean;
  uiMode: UiMode;
  /** Speed log (speed, heading, point of sail) shown at sea; on by default (decision 0049). */
  showLog: boolean;
  /** Chosen language; null follows the browser (decision 0037). */
  language: LanguageId | null;
  /** Background music volume, 0 (off) to 1 (decision 0045). */
  musicVolume: number;
}

const KEY = 'fwt.settings.v1';
const DEFAULTS: Settings = {
  quality: 'auto',
  showFps: false,
  seenHelp: false,
  seenWindHint: false,
  uiMode: 'adult',
  showLog: true,
  language: null,
  musicVolume: 0.6,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    const settings = raw
      ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
      : { ...DEFAULTS };
    if (!isLanguage(settings.language)) settings.language = null;
    const volume = Number(settings.musicVolume);
    settings.musicVolume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.6;
    if (!KIDS_MODE_AVAILABLE) settings.uiMode = 'adult';
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
