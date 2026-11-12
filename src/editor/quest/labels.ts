import type { Condition } from '../../sim/questLibrary';
import type { QuestDef, QuestStep } from '../../sim/quests';
import { CHARACTERS, type Mood, portraitSvg } from '../../ui/portraits';
import { type Lang, clock, textOf } from './doc';
import { qb } from './state';

/* Short words and faces the quest builder's lists, panel and views share. */

export const faceOf = (
  id: string | undefined,
  size: number,
  mood: Mood = 'neutral',
  look?: string,
) => {
  const c = CHARACTERS.find((p) => p.id === id);
  return c ? portraitSvg(c, { mood, variant: look, size }) : '<i>⚓</i>';
};

/** An id as typed, made fit for a file name or a text key. */
export const slug = (typed: string) => typed.toLowerCase().replace(/[^a-z0-9-]+/g, '-');

export const characterOptions = (): [string, string][] =>
  CHARACTERS.map((c): [string, string] => [c.id, `${c.name} · ${c.role}`]);

/** The first `timed` par of a goal, for `{par}` in the card. */
export function parOf(c: unknown): number | undefined {
  if (!c || typeof c !== 'object') return undefined;
  const cond = c as Condition;
  if (cond.is === 'timed') {
    const par = cond.par;
    return typeof par === 'number' ? par : ((par as Record<string, number>)?.captain ?? undefined);
  }
  if (Array.isArray(cond.of)) for (const m of cond.of) if (parOf(m) !== undefined) return parOf(m);
  return parOf(cond.of);
}

/** `{par}` as a clock, or left as it is when the goal has no par. */
export const fillPar = (text: string, par: number | undefined) =>
  text.replace('{par}', par === undefined ? '{par}' : clock(par));

export const stepTitle = (q: QuestDef, s: QuestStep, l: Lang = 'en') =>
  fillPar(textOf(qb.doc, l, `${q.text}.${s.id}.title`) ?? s.id, parOf(s.goal));

export const rewardWords = (q: { reward?: QuestDef['reward'] }) =>
  Object.entries(q.reward ?? {})
    .map(
      ([k, v]) =>
        `${k} ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? Object.keys(v as object).join(', ') : String(v)}`,
    )
    .join(' · ');
