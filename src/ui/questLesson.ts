import { tOptional } from '../i18n';
import { isGood, type GoodId } from '../sim/goods';
import { deref } from '../sim/questLibrary';
import { type CoachTarget, QUEST_DONE, type QuestBook } from '../sim/quests';
import { isDiscovered } from '../sim/shipyards';
import { findPort } from '../sim/trade';
import { mainLine } from './questLine';
import { goodOf, arcName, stepParams, buyerOf } from './questWords';

/* A lesson's coach bubble, read from the running lesson (decision 0151). */

/** A lesson's coach bubble (decision 0151): the running lesson's step, its words and its mark. */
export interface LessonModel {
  quest: string;
  step: string;
  /** The step's number on the lesson's main line (1-based), or 0 for a way back off it. */
  stepNo: number;
  /** Steps on the main line. */
  steps: number;
  title: string;
  copy: string;
  /** The bubble's button: open the chart, the market, or the sailing tips. */
  action: 'chart' | 'market' | 'tips' | null;
  /** The step's options offered now ("Continue"), with their words. */
  options: { id: string; title: string }[];
  /** What the coach mark points at on each surface. */
  targets: Partial<Record<'sea' | 'chart' | 'market', CoachTarget>>;
  /** The harbour the port marker and the chart point at. */
  port: string | null;
  /** The good whose market button the mark points at. */
  good: GoodId | null;
}

/** The nearest charted harbour to the boat: the easiest first trip. */
function nearestPort(book: QuestBook, harbours: Record<string, { x: number; y: number }>) {
  const { boat, map, trade } = book.world;
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const port of map.ports) {
    if (!isDiscovered(trade, port.id)) continue;
    const at = harbours[port.id] ?? map.islands.find((i) => i.id === port.islandId);
    if (!at) continue;
    const distance = Math.hypot(at.x - boat.x, at.y - boat.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = port.id;
    }
  }
  return best;
}

/** The running lesson's bubble, if a lesson runs. */
export function lessonFor(
  book: QuestBook,
  harbours: Record<string, { x: number; y: number }>,
): LessonModel | null {
  const running = book.lesson;
  // A lesson without its coach plays its story in silence (decision 0160).
  if (!running || !book.isCoached(running.quest.id)) return null;
  const { quest, step } = running;
  const vars = book.progress(quest.id)?.vars;
  const coach = step.coach ?? {};
  const params = stepParams(book, step, quest);
  const key = `${quest.text}.${step.id}`;
  const line = mainLine(quest);
  const portRef = coach.port ?? step.port;
  let port: string | null;
  if (portRef === 'nearest') port = nearestPort(book, harbours);
  else if (portRef?.startsWith('buyer:')) {
    const good = deref(portRef.slice(6), vars);
    port = isGood(good) ? (buyerOf(book, good)?.id ?? null) : null;
  } else port = book.portOf(quest.id, portRef);
  let good: GoodId | null;
  if (coach.good?.startsWith('makes:')) {
    const from = book.portOf(quest.id, coach.good.slice(6));
    good = (from && findPort(book.map, from)?.produces[0]) || null;
  } else good = goodOf(deref(coach.good, vars)) ?? null;
  return {
    quest: quest.id,
    step: step.id,
    stepNo: line.indexOf(step.id) + 1,
    steps: line.length,
    title: tOptional(`${key}.title`, params) ?? step.id,
    copy: tOptional(`${key}.copy`, params) ?? '',
    action: coach.action ?? null,
    options: book.options(quest.id).map((o) => ({
      id: o.id,
      title: tOptional(`${key}.${o.id}.title`, params) ?? o.id,
    })),
    targets: { sea: coach.sea, chart: coach.chart, market: coach.market },
    port,
    good,
  };
}

/** A finished lesson's last bubble: `<text>.done.title` and `.copy`. */
export function lessonDone(book: QuestBook, questId: string): { title: string; copy: string } {
  const quest = book.quests.find((q) => q.id === questId);
  const key = `${quest?.text ?? questId}.${QUEST_DONE}`;
  return {
    title: tOptional(`${key}.title`) ?? (quest ? arcName(quest) : questId),
    copy: tOptional(`${key}.copy`) ?? '',
  };
}
