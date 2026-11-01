import type { Item } from './cosmetics';

/**
 * Which cosmetics a captain may use (decision 0261): free ones from the first day, earned ones
 * once their quest is done, their regatta series won or their milestone reached. Nothing is
 * stored: it is read from the voyage's progress, so an item earned in an old save is there too.
 */
export interface UnlockProgress {
  questDone(id: string): boolean;
  /** Regatta series won (`regatta.json` › `series`). */
  seriesWon: readonly string[];
  /** Named milestones reached; none are defined yet. */
  milestones?: readonly string[];
}

/** What earns an item: its one quest, series or milestone; null for a free item. */
export type EarnedBy = { kind: 'quest' | 'regatta' | 'milestone'; id: string } | null;

export function earnedBy(item: Item): EarnedBy {
  const u = item.unlock;
  if (u.kind !== 'earned') return null;
  if (u.quest) return { kind: 'quest', id: u.quest };
  if (u.regatta) return { kind: 'regatta', id: u.regatta };
  if (u.milestone) return { kind: 'milestone', id: u.milestone };
  return null;
}

export function isUnlocked(item: Item, progress: UnlockProgress): boolean {
  if (item.unlock.kind === 'free') return true;
  const by = earnedBy(item);
  if (!by) return false;
  if (by.kind === 'quest') return progress.questDone(by.id);
  if (by.kind === 'regatta') return progress.seriesWon.includes(by.id);
  return progress.milestones?.includes(by.id) ?? false;
}
