import type { RowHost, SettingsContext } from './context';
import { sliderRow, switchRow } from './rows';
import { t } from '../../../i18n';

/** Settings › Sound: music, the sea's sounds and the people's voices. */
export function soundTab(ctx: SettingsContext, host: RowHost) {
  const { settings, audio } = ctx;
  const volume = (
    id: string,
    key: string,
    name: 'musicVolume' | 'soundVolume' | 'voiceVolume',
    apply: (v: number) => void,
    off?: () => boolean,
  ) =>
    sliderRow({
      id,
      key,
      get: () => Math.round(settings[name] * 100),
      set: (percent) => {
        settings[name] = percent / 100;
        audio.unlock();
        apply(settings[name]);
      },
      commit: ctx.keep,
      disabled: off,
    });
  return [
    {
      title: t('settings.tab.sound'),
      rows: [
        volume('music-volume', 'settings.music', 'musicVolume', (v) => audio.setVolume(v)),
        volume('sound-volume', 'settings.sounds', 'soundVolume', (v) => audio.setSoundVolume(v)),
        switchRow({
          id: 'voices',
          key: 'settings.voices',
          get: () => settings.voices,
          set: (on) => {
            settings.voices = on;
            audio.unlock();
            host.changed();
          },
        }),
        volume(
          'voice-volume',
          'settings.voiceLevel',
          'voiceVolume',
          () => host.changed(),
          () => !settings.voices,
        ),
      ],
    },
  ];
}
