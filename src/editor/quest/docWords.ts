import { type Condition, isSpot } from '../../sim/questLibrary';

/* Quests in plain words, for the quest builder's step cards and story view (decision 0142). */

const PLACES = (n: number, what = 'place') => `${n} ${what}${n === 1 ? '' : 's'}`;
const placeWords = (p: unknown) =>
  isSpot(p) ? `a spot at sea (${Math.round(p.x)}, ${Math.round(p.y)})` : String(p);
const parWords = (par: unknown) =>
  typeof par === 'number'
    ? clock(par)
    : par && typeof par === 'object'
      ? Object.values(par as Record<string, number>)
          .map(clock)
          .join(' / ')
      : '?';

/** Seconds as m:ss. */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A condition in plain words, for the step cards and the story view. */
export function conditionWords(c: Condition | undefined): string {
  if (!c) return '—';
  const v = c as Record<string, unknown>;
  switch (c.is) {
    case 'always':
      return 'at once';
    case 'all':
    case 'any':
      return `${c.is} of: ${((v.of as Condition[]) ?? []).map(conditionWords).join(' · ')}`;
    case 'not':
      return `not ${conditionWords(v.of as Condition)}`;
    case 'quest-done':
      return `${String(v.quest)} done`;
    case 'quest-at':
      return `${String(v.quest)} at ${String(v.step)}`;
    case 'chose':
      return `chose ${String(v.option)} in ${String(v.quest)}`;
    case 'docked':
      return v.port === undefined ? 'docked anywhere' : `docked at ${String(v.port)}`;
    case 'course':
      return v.port === undefined ? 'a course set' : `a course to ${String(v.port)}`;
    case 'screen':
      return `the ${String(v.screen)} open`;
    case 'point-of-sail':
      return `${String(v.point)} for ${String(v.holdSec)} s`;
    case 'tacked':
      return `${String(v.count)} tacks`;
    case 'asked':
      return 'when the game asks (tutorial)';
    case 'bought':
      return `buy ${String(v.qty)} ${v.good === undefined ? 'goods' : String(v.good)} at ${String(v.port)}`;
    case 'sails-practised':
      return 'sails lowered and raised, steered, under way';
    case 'discovered':
      return `${String(v.port)} on the chart`;
    case 'town-level':
      return `${String(v.port)} at level ${String(v.atLeast)}`;
    case 'standing':
      return `standing ${String(v.atLeast)} at ${String(v.port)}`;
    case 'orders-done':
      return `${String(v.atLeast)} orders done`;
    case 'gold':
      return `${String(v.atLeast)} gold`;
    case 'has-cargo':
      return `${String(v.qty ?? 1)} ${v.good === undefined ? 'goods' : String(v.good)} aboard`;
    case 'built':
      return `${String(v.building)} built${v.island ? ` on ${String(v.island)}` : ''}`;
    case 'moored':
      return `moored at ${v.island ? String(v.island) : 'home'}`;
    case 'owns-ship':
      return `owns a ${String(v.ship)}`;
    case 'series-won':
      return `series ${String(v.series)} won`;
    case 'delivered':
      return `deliver ${String(v.qty)} ${String(v.good)} at ${String(v.port)}`;
    case 'landed':
      return `land ${String(v.qty)} ${String(v.good)} ${placeWords(v.place)}`;
    case 'carried':
      return `carry ${String(v.qty)} ${String(v.item)} ${placeWords(v.from)} → ${placeWords(v.to)}`;
    case 'reach': {
      const n = Array.isArray(v.points) ? v.points.length : 0;
      const extra = [
        v.order === 'in-order' ? 'in order' : 'any order',
        `within ${String(v.within)}`,
        v.holdSec !== undefined ? `held ${String(v.holdSec)} s` : '',
        v.atNight ? 'at night' : '',
      ].filter(Boolean);
      return `reach ${PLACES(n)} · ${extra.join(' · ')}`;
    }
    case 'timed':
      return `timed ${String(v.from)} → ${String(v.to ?? v.from)}${
        Array.isArray(v.via) ? ` via ${PLACES(v.via.length, 'point')}` : ''
      }, par ${parWords(v.par)}`;
    default:
      return c.is;
  }
}
