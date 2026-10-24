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
  /** The one-time "ease the sails" message has been shown (decision 0078). */
  seenPressHint: boolean;
  uiMode: UiMode;
  /** Speed log (speed, heading, point of sail) shown at sea; on by default (decision 0049). */
  showLog: boolean;
  /** Chosen language; null follows the browser (decision 0037). */
  language: LanguageId | null;
  /** Background music volume, 0 (off) to 1 (decision 0045). */
  musicVolume: number;
  /** People babble as their card opens (decision 0132); on by default. */
  voices: boolean;
  /** Their volume, 0 to 1. */
  voiceVolume: number;
  /** Day and night cycle (decision 0068); off keeps a bright day for players who dislike night. */
  dayNight: boolean;
  /** Weather spells and storms (decision 0067); off = a steady breeze. */
  weather: boolean;
  /** Moving storms (decision 0067); hazards can be turned off (Guillaume). */
  storms: boolean;
  /** Wind zones such as trade belts and doldrums (decision 0140); a hazard, so it can be off. */
  windZones: boolean;
  /** Currents (decision 0140): water that carries the boat; off = still water everywhere. */
  currents: boolean;
  /** The first current met has shown its one-time hint (decision 0140). */
  seenCurrentHint: boolean;
  /** The steady trade wind (decision 0083); picking a difficulty level sets its default. */
  steadyWind: boolean;
}

const KEY = 'fwt.settings.v1';
const DEFAULTS: Settings = {
  quality: 'auto',
  showFps: false,
  seenHelp: false,
  seenWindHint: false,
  seenPressHint: false,
  uiMode: 'adult',
  showLog: true,
  language: null,
  musicVolume: 0.6,
  voices: true,
  voiceVolume: 0.7,
  dayNight: true,
  weather: true,
  storms: true,
  windZones: true,
  currents: true,
  seenCurrentHint: false,
  steadyWind: false,
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
    const voices = Number(settings.voiceVolume);
    settings.voiceVolume = Number.isFinite(voices) ? Math.min(1, Math.max(0, voices)) : 0.7;
    settings.voices = settings.voices !== false;
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
