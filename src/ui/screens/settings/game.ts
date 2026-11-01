import { hasText, t } from '../../../i18n';
import { DIFFICULTIES, DIFFICULTY, isDifficulty } from '../../../sim/difficulty';
import { hazeSwitches } from '../../../sim/windZones';
import { button, setDisabled } from '../../components';
import type { RowHost, SettingsContext } from './context';
import { type SettingRow, type SwitchSpec, actionRow, choiceRow, switchRow, text } from './rows';

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

/** Settings › Game: the voyage's level and wind, the lessons, the hazards, the new game. */
export function gameTab(ctx: SettingsContext, host: RowHost) {
  const { settings } = ctx;
  const voyage: SettingRow[] = [
    choiceRow({
      id: 'difficulty',
      key: 'settings.difficulty',
      options: DIFFICULTIES.map((id) => ({
        id,
        label: hasText(`level.${id}`) ? text(`level.${id}`) : DIFFICULTY[id]!.name,
      })),
      get: () => ctx.difficulty.current(),
      set: (id) => {
        if (isDifficulty(id)) ctx.difficulty.choose(id);
        host.changed();
      },
    }),
    choiceRow({
      id: 'wind-choice',
      key: 'settings.wind',
      options: [
        { id: 'steady', label: t('settings.windSteady') },
        { id: 'shifting', label: t('settings.windShifting') },
      ],
      get: () => (settings.steadyWind ? 'steady' : 'shifting'),
      set: (id) => {
        settings.steadyWind = id === 'steady';
        host.changed();
      },
    }),
  ];
  const lessons = button({
    label: ctx.lessons.label(),
    icon: 'compass',
    onPress: ctx.lessons.open,
  });
  lessons.id = 'settings-lessons';
  voyage.push(
    actionRow(
      {
        key: 'settings.tutorial',
        detail: ctx.lessons.note,
        control: lessons,
        hidden: () => ctx.free,
      },
      () => {
        lessons.querySelector('.ui-btn-label')!.textContent = ctx.lessons.label();
        setDisabled(lessons, ctx.lessons.disabled());
      },
    ),
  );
  const hazards = hazardSwitches(ctx, () => host.changed()).map(switchRow);
  const actions: SettingRow[] = [
    actionRow({
      key: 'settings.resetBoat',
      control: button({ label: t('settings.resetBoat'), icon: 'anchor', onPress: ctx.backToStart }),
    }),
    actionRow({
      key: 'settings.newGame',
      hidden: () => ctx.free,
      control: button({ label: t('settings.newGame'), variant: 'danger', onPress: ctx.newGame }),
    }),
  ];
  if (ctx.shiftWind)
    actions.push(
      actionRow({
        key: 'settings.shiftWind',
        control: button({ label: t('settings.shiftWind'), onPress: ctx.shiftWind }),
      }),
    );
  return [
    { title: t('settings.voyage'), rows: [...voyage, ...actions] },
    { title: t('settings.hazards'), rows: hazards },
  ];
}
