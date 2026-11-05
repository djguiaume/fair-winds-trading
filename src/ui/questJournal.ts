import { tOptional } from '../i18n';
import type { MapDef } from '../sim/map';
import { QUEST_DONE, type QuestBook, type QuestDef, type QuestStep } from '../sim/quests';
import { type Character, character } from './portraits';
import { lineNumber, mainLine } from './questLine';
import { arcName, portName, stepParams, stepProgress } from './questWords';

/* The journal's entries (decision 0124): every quest started, its steps and its story. */

export interface JournalStep {
  title: string;
  state: 'done' | 'now' | 'later';
  progress?: string;
}

export interface JournalEntry {
  quest: string;
  giver?: Character;
  /** "Rook · Saltmere". */
  who?: string;
  arc: string;
  /** `ignored`: an offer the captain said "don't offer again" to (decision 0141). */
  state: 'tracked' | 'active' | 'offered' | 'ignored' | 'done';
  stepNo: number;
  steps: number;
  /** The tracked quest's steps: done ones, the one now, and one line for what is still hidden. */
  lines: JournalStep[];
  /** The options picked, for a finished quest. */
  chose: string[];
  /**
   * A finished quest told again, opened from the journal: each step of its main line, what the
   * person said and the answer picked, then their thanks. Words only where they were written.
   */
  story?: JournalStory[];
}

export interface JournalStory {
  title?: string;
  copy?: string;
  /** The answer the captain picked at this step. */
  chose?: string;
  /** The thanks, last. */
  thanks?: boolean;
}

/** The journal: the tracked quest first, then the other started ones, offers, then done ones. */
export function journal(book: QuestBook, map: MapDef): JournalEntry[] {
  const out: JournalEntry[] = [];
  const base = (quest: QuestDef) => {
    const giver = quest.giver ? character(quest.giver) : undefined;
    const port = portName(map, giver?.port ?? quest.port);
    return {
      quest: quest.id,
      giver,
      who: giver ? (port ? `${giver.name} · ${port}` : giver.name) : port,
      arc: arcName(quest),
      steps: mainLine(quest).length,
      lines: [] as JournalStep[],
      chose: [] as string[],
    };
  };
  for (const { quest, step } of book.active) {
    const i = quest.steps.indexOf(step);
    const tracked = book.tracked === quest.id;
    const entry: JournalEntry = {
      ...base(quest),
      state: tracked ? 'tracked' : 'active',
      stepNo: lineNumber(quest, step.id),
    };
    if (tracked) {
      const p = book.progress(quest.id);
      const title = (s: QuestStep) =>
        tOptional(`${quest.text}.${s.id}.title`, stepParams(book, s, quest)) ?? s.id;
      for (const s of quest.steps.slice(0, i)) entry.lines.push({ title: title(s), state: 'done' });
      entry.lines.push({
        title: title(step),
        state: 'now',
        progress: stepProgress(step.goal, p?.counts ?? []),
      });
      if (i < quest.steps.length - 1) entry.lines.push({ title: '', state: 'later' });
    }
    if (tracked) out.unshift(entry);
    else out.push(entry);
  }
  for (const quest of book.offered) out.push({ ...base(quest), state: 'offered', stepNo: 0 });
  for (const quest of book.ignoredOffers) out.push({ ...base(quest), state: 'ignored', stepNo: 0 });
  for (const quest of book.quests) {
    const p = book.progress(quest.id);
    if (p?.step !== QUEST_DONE) continue;
    const entry: JournalEntry = { ...base(quest), state: 'done', stepNo: mainLine(quest).length };
    for (const [step, option] of Object.entries(p.chose))
      entry.chose.push(tOptional(`${quest.text}.${step}.${option}.title`) ?? option);
    entry.story = [];
    for (const id of mainLine(quest)) {
      const step = quest.steps.find((s) => s.id === id);
      if (!step) continue;
      const params = stepParams(book, step, quest);
      const option = p.chose[id];
      const line: JournalStory = {
        title: tOptional(`${quest.text}.${id}.title`, params),
        copy: tOptional(`${quest.text}.${id}.copy`, params),
      };
      if (option) line.chose = tOptional(`${quest.text}.${id}.${option}.title`) ?? option;
      if (line.title || line.copy) entry.story.push(line);
    }
    const thanks = tOptional(
      `${quest.text}.${QUEST_DONE}.copy`,
      stepParams(book, undefined, quest),
    );
    if (thanks) entry.story.push({ copy: thanks, thanks: true });
    out.push(entry);
  }
  return out;
}
