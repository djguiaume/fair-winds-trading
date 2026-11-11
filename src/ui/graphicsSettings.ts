import { t } from '../i18n';
import { QUALITY, QUALITY_LEVELS, type QualityLevel } from '../render/quality';
import { coverOn } from '../render/models/fieldGroundCover';
import type { GraphicsEffects } from '../render/ultraPipeline';
import type { SwitchSpec } from './screens/settings/rows';
import type { Settings } from './settings';

/** Settings › Display › Graphics: Auto, then a level each, lowest first (decision 0247). */
export function qualityOptions() {
  return [
    { id: 'auto', label: t('settings.auto') },
    ...QUALITY_LEVELS.map((level) => ({ id: level, label: t(`settings.${level}`) })),
  ] as const;
}

/** The effects the switches cover; the water's reflection also shows on High. */
const EFFECTS: readonly (keyof GraphicsEffects)[] = [
  'shadows',
  'occlusion',
  'toneMapping',
  'haze',
  'reflection',
  'mirror',
  'groundCover',
];

/** Whether a level draws an effect, so its switch shows only there. */
function drawn(id: keyof GraphicsEffects, level: QualityLevel): boolean {
  const profile = QUALITY[level];
  if (id === 'reflection') return profile.waterReflection;
  if (id === 'mirror') return profile.mirror;
  if (id === 'groundCover') return coverOn(level);
  return profile.ultra;
}

/** What the switches drive: the view's effects and its waves. */
export interface GraphicsView {
  effects: GraphicsEffects;
  setWaves(choice: boolean | null): void;
}

/** Pushes the saved graphics choices to the view: the effects, MSAA and the waves. */
export function applyGraphics(view: GraphicsView, settings: Settings) {
  view.effects.msaa = settings.effects.msaa !== false;
  view.effects.gusts = settings.effects.gusts !== false;
  for (const id of EFFECTS) view.effects[id] = settings.effects[id] !== false;
}

/**
 * Waves (decision 0250), then one switch per graphics effect (decision 0221). Waves follow the
 * level (`graphics.json › quality.*.waves`: off on Low and Ultra-low) until the player flips them,
 * then their choice holds on every level. An effect shows only on the levels that draw it; left
 * out of `settings.effects` = on.
 */
export function effectSwitches(
  settings: Settings,
  level: () => QualityLevel,
  change: () => void,
): SwitchSpec[] {
  const waves: SwitchSpec = {
    id: 'waves',
    key: 'settings.waves',
    get: () => settings.waves ?? QUALITY[level()].waves,
    set: (on) => {
      settings.waves = on;
      change();
    },
  };
  return [
    waves,
    ...EFFECTS.map((id): SwitchSpec => ({
      id: `fx-${id}`,
      key: `settings.fx.${id}`,
      get: () => settings.effects[id] !== false,
      set: (on) => {
        settings.effects = { ...settings.effects, [id]: on };
        change();
      },
      hidden: () => !drawn(id, level()),
    })),
  ];
}
