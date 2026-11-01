import type { Difficulty } from '../../../sim/difficulty';
import type { Music } from '../../../audio/music';
import type { QualityLevel, QualitySetting } from '../../../render/quality';
import type { GraphicsView } from '../../graphicsSettings';
import type { Settings } from '../../settings';

/** What the Settings tabs need from the running game; main.ts builds it once. */
export interface SettingsContext {
  settings: Settings;
  /** Pushes the settings to the world, the view and the HUD, and saves them. */
  changed(): void;
  /** Saves the settings only (the end of a slider drag). */
  keep(): void;
  /** The graphics level in use, and the player's choice of it (`auto` or a level). */
  level(): QualityLevel;
  setQuality(choice: QualitySetting): void;
  view: GraphicsView;
  audio: Pick<Music, 'unlock' | 'setVolume' | 'setSoundVolume' | 'setVoiceVolume'>;
  difficulty: { current(): Difficulty; choose(level: Difficulty): void };
  /** The lessons line: Learn to sail, Continue the lessons, Sailing lessons. */
  lessons: { label(): string; note(): string; disabled(): boolean; open(): void };
  setLanguage(id: string): void;
  /** A Free Sailing session: nothing in it saves or sends a voyage (decision 0266). */
  free: boolean;
  newGame(): void;
  backToStart(): void;
  /** `?debug` only: a testing aid, not a player setting. */
  shiftWind: (() => void) | null;
  /** The pad brands the controller buttons can be set to. */
  padBrands: readonly string[];
}

/** Every tab builder gets the context and the one callback a changed control calls. */
export interface RowHost {
  changed(): void;
}
