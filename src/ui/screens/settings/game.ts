import { hasText, t } from '../../../i18n';
import { DIFFICULTIES, DIFFICULTY, isDifficulty } from '../../../sim/difficulty';
import { button, setDisabled } from '../../components';
import type { RowHost, SettingsContext } from './context';
import { type SettingRow, actionRow, choiceRow, text } from './rows';

/** Settings › Game: the voyage's level and wind, the lessons, the hazards, the new game. */
export function gameTab(ctx: SettingsContext, host: RowHost) {
  const { settings } = ctx;
  const voyage: SettingRow[] = [
    choiceRow({
      id: 'difficulty',
      tiles: true,
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
  const lessonsRow = actionRow(
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
  );
  const actions: SettingRow[] = [
    lessonsRow,
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
    { title: t('settings.voyage'), rows: voyage },
    { title: '', rows: actions },
  ];
}
