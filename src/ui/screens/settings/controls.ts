import { t } from '../../../i18n';
import type { RowHost, SettingsContext } from './context';
import { choiceRow, switchRow, text } from './rows';

/** Settings › Controls: the camera's turns and the controller's button names. */
export function controlsTab(ctx: SettingsContext, host: RowHost) {
  const { settings } = ctx;
  const camera = (
    id: string,
    key: string,
    name: 'turnCamera' | 'cameraReturns',
    off?: () => boolean,
  ) =>
    switchRow({
      id,
      key,
      get: () => settings[name],
      set: (on) => {
        settings[name] = on;
        host.changed();
      },
      disabled: off,
    });
  return [
    {
      title: t('settings.tab.controls'),
      rows: [
        camera('turn-camera', 'settings.turnCamera', 'turnCamera'),
        camera(
          'camera-returns',
          'settings.cameraReturns',
          'cameraReturns',
          () => !settings.turnCamera,
        ),
        choiceRow({
          id: 'pad-glyphs',
          key: 'settings.padGlyphs',
          options: [
            { id: 'auto', label: t('settings.padAuto') },
            ...ctx.padBrands.map((brand) => ({ id: brand, label: text(`settings.pad.${brand}`) })),
          ],
          get: () => settings.padGlyphs ?? 'auto',
          set: (id) => {
            settings.padGlyphs = id === 'auto' ? null : id;
            host.changed();
          },
        }),
      ],
    },
  ];
}
