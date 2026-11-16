import { t } from '../i18n';
import { QUALITY, QUALITY_LEVELS, type QualityLevel } from '../render/quality';
import { coverOn, setGroundCover } from '../render/models/fieldGroundCover';
import { switchLampPools } from '../render/lampPools';
import type { GraphicsEffects } from '../render/graphicsEffects';
import type { SwitchSpec } from './screens/settings/rows';
import type { Settings } from './settings';

/** Settings › Display › Graphics: Auto, then a level each, lowest first (decision 0247). */
export function qualityOptions() {
  return [
    { id: 'auto', label: t('settings.auto') },
    ...QUALITY_LEVELS.map((level) => ({ id: level, label: t(`settings.${level}`) })),
  ] as const;
}

/** The effects the switches cover; the shadows and the water's reflection also show on High. */
const EFFECTS: readonly (keyof GraphicsEffects)[] = [
  'shadows',
  'contact',
  'occlusion',
  'toneMapping',
  'haze',
  'bloom',
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
  if (id === 'shadows' || id === 'contact') return profile.shadows;
  return profile.ultra;
}

/** What the switches drive: the view's effects and its waves. */
export interface GraphicsView {
  effects: GraphicsEffects;
  setWaves(choice: boolean | null): void;
}

/** The effects only a `?off=` device test switches off (issue #377), with no Settings row. */
const TEST_ONLY = ['msaa', 'gusts', 'clouds', 'glitter', 'sunlight', 'pools'] as const;

/** Pushes the saved graphics choices to the view: the effects, MSAA and the waves. */
export function applyGraphics(view: GraphicsView, settings: Settings) {
  for (const id of [...EFFECTS, ...TEST_ONLY]) view.effects[id] = settings.effects[id] !== false;
  setGroundCover({ switchedOn: view.effects.groundCover });
  switchLampPools(view.effects.pools !== false);
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
