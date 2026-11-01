import { hazeSwitches } from '../../../sim/windZones';
import { t } from '../../../i18n';
import type { RowHost, SettingsContext } from './context';
import { type SwitchSpec, switchRow } from './rows';

/** The sea's hazards and annoyances, each with its own switch (decision 0067 onward). */
function hazardSwitches({ settings }: SettingsContext, change: () => void): SwitchSpec[] {
  const flag = (id: string, key: keyof typeof settings & string, extra?: Partial<SwitchSpec>) => ({
    id,
    key: `settings.${id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())}`,
    get: () => Boolean(settings[key as 'weather']),
    set: (on: boolean) => {
      (settings as unknown as Record<string, unknown>)[key] = on;
      change();
    },
    ...extra,
  });
  return [
    flag('day-night', 'dayNight'),
    flag('weather', 'weather'),
    flag('storms', 'storms', { disabled: () => !settings.weather }),
    flag('eruptions', 'eruptions'),
    flag('wind-zones', 'windZones'),
    // The storm belt's squalls (decision 0167) are storms in a wind zone: they need all three.
    flag('storm-belt', 'stormBelt', {
      disabled: () => !settings.weather || !settings.storms || !settings.windZones,
    }),
    flag('currents', 'currents'),
    flag('sea-drag', 'seaDrag'),
    flag('bergs', 'bergs'),
    flag('ships', 'ships'),
    ...hazeSwitches().map((id): SwitchSpec => ({
      id: `haze-${id}`,
      key: `settings.haze.${id}`,
      get: () => settings.haze[id] !== false,
      set: (on) => {
        settings.haze = { ...settings.haze, [id]: on };
        change();
      },
    })),
  ];
}

/** Settings › Hazards: the sea's hazards and annoyances, each with its own switch. */
export function hazardsTab(ctx: SettingsContext, host: RowHost) {
  return [
    {
      title: t('settings.hazards'),
      rows: hazardSwitches(ctx, () => host.changed()).map(switchRow),
    },
  ];
}
