import { LANGUAGES, type MessageKey, language } from '../../../i18n';
import { MOTION_MODES, type MotionMode } from '../../motionMode';
import { effectSwitches, qualityOptions } from '../../graphicsSettings';
import type { QualitySetting } from '../../../render/quality';
import { t } from '../../../i18n';
import type { RowHost, SettingsContext } from './context';
import { choiceRow, switchRow } from './rows';

/** Settings › Display: the picture, the quiet HUD and the comfort switches. */
export function displayTab(ctx: SettingsContext, host: RowHost) {
  const { settings } = ctx;
  const flag = (
    id: string,
    key: string,
    name: 'quietHud' | 'showFps' | 'gentleMotion' | 'cameraBob' | 'wakeStyles',
  ) =>
    switchRow({
      id,
      key,
      get: () => settings[name],
      set: (on) => {
        settings[name] = on;
        host.changed();
      },
    });
  const picture = [
    choiceRow({
      id: 'quality',
      key: 'settings.graphics',
      detail: () => t('settings.nowUsing', { level: t(`settings.${ctx.level()}`) }),
      options: qualityOptions(),
      get: () => settings.quality,
      set: (id) => {
        ctx.setQuality(id as QualitySetting);
        host.changed();
      },
    }),
    ...effectSwitches(settings, ctx.level, () => host.changed()).map(switchRow),
    flag('wake-styles', 'settings.wakeStyles', 'wakeStyles'),
    flag('show-fps', 'settings.showFps', 'showFps'),
  ];
  const comfort = [
    flag('quiet-hud', 'settings.quietHud', 'quietHud'),
    choiceRow({
      id: 'motion',
      key: 'settings.motion',
      options: MOTION_MODES.map((id) => ({ id, label: t(`settings.motion.${id}` as MessageKey) })),
      get: () => settings.motion,
      set: (id) => {
        settings.motion = id as MotionMode;
        host.changed();
      },
    }),
    flag('gentle-motion', 'settings.gentleMotion', 'gentleMotion'),
    flag('camera-bob', 'settings.cameraBob', 'cameraBob'),
    choiceRow({
      id: 'settings-language',
      key: 'settings.language',
      options: LANGUAGES.map((l) => ({ id: l.id, label: l.name })),
      get: () => language(),
      set: (id) => ctx.setLanguage(id),
    }),
  ];
  return [
    { title: t('settings.look'), rows: picture },
    { title: t('settings.comfort'), rows: comfort },
  ];
}
