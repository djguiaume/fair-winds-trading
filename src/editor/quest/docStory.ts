import { type Condition } from '../../sim/questLibrary';
import { type QuestDef } from '../../sim/quests';

/* Which quest waits on which, for the quest builder's story view and checks (decision 0142). */

/** The quests a condition waits on (`quest-done`, `quest-at`, `chose`), outside a `not`. */
export function questsNamed(c: Condition | undefined): string[] {
  if (!c) return [];
  if (c.is === 'not') return [];
  if (c.is === 'all' || c.is === 'any')
    return [...new Set(((c.of as Condition[]) ?? []).flatMap(questsNamed))];
  return typeof c.quest === 'string' ? [c.quest] : [];
}

/**
 * Columns for the story view: a quest sits one column right of the last quest it waits on. The
 * standing orders (decision 0214) stay out of it: the view lists them on their own.
 */
export function storyColumns(
  all: readonly { id: string; start: Condition; repeat?: boolean }[],
): string[][] {
  const quests = all.filter((q) => !q.repeat);
  const byId = new Map(quests.map((q) => [q.id, q]));
  const depth = new Map<string, number>();
  const visit = (id: string, trail: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!;
    const q = byId.get(id);
    if (!q || trail.has(id)) return 0;
    trail.add(id);
    const before = questsNamed(q.start).filter((p) => byId.has(p));
    const d = before.length ? Math.max(...before.map((p) => visit(p, trail) + 1)) : 0;
    trail.delete(id);
    depth.set(id, d);
    return d;
  };
  const columns: string[][] = [];
  for (const q of quests) {
    const d = visit(q.id, new Set());
    (columns[d] ??= []).push(q.id);
  }
  return columns.map((c) => c ?? []);
}
/** Every quest a quest waits on to start, through its start condition, and theirs in turn. */
export function questsBefore(quest: QuestDef, quests: readonly QuestDef[]): Set<string> {
  const out = new Set<string>();
  const named = (v: unknown): string[] =>
    !v || typeof v !== 'object'
      ? []
      : Array.isArray(v)
        ? v.flatMap(named)
        : [
            ...(typeof (v as { quest?: unknown }).quest === 'string'
              ? [(v as { quest: string }).quest]
              : []),
            ...Object.values(v).flatMap(named),
          ];
  const todo = named(quest.start);
  while (todo.length) {
    const id = todo.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    todo.push(...named(quests.find((q) => q.id === id)?.start));
  }
  return out;
}
