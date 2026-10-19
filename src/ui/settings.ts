import type { QualitySetting } from '../render/quality';

/** Player settings, saved in localStorage (versioned key so the format can change later). */
export interface Settings {
  quality: QualitySetting;
  showFps: boolean;
  seenHelp: boolean;
  seenWindHint: boolean;
}

const KEY = 'fwt.settings.v1';
const DEFAULTS: Settings = {
  quality: 'auto',
  showFps: false,
  seenHelp: false,
  seenWindHint: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : { ...DEFAULTS };
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
