import { formatNumber, t } from '../../i18n';
import type { MapDef } from '../../sim/map';
import type { QuestBook } from '../../sim/quests';
import { el } from '../components/dom';
import { crateIcon, icon } from '../icons';
import { journal } from '../questView';
import { labelAttrs, setHidden, setText } from './parts';

/** The tracked quest as one line: its step's title, then who asked and how far along. */
export interface QuestLine {
  title: string;
  detail: string;
}

/** The tracked quest's line from the journal, or null when no quest is tracked. */
export function trackedQuestLine(book: QuestBook, map: MapDef): QuestLine | null {
  const tracked = journal(book, map).find((e) => e.state === 'tracked');
  if (!tracked) return null;
  const step = t('journal.step', { n: tracked.stepNo, total: tracked.steps });
  return {
    title: tracked.lines.find((l) => l.state === 'now')?.title ?? tracked.arc,
    detail: `${tracked.giver?.name ?? tracked.arc}, ${step}`,
  };
}

/** What the status shows; each number is written only when it changes. */
export interface StatusFrame {
  gold: number;
  used: number;
  capacity: number;
  /** Hull condition in percent and the damage stage the model shows (decision 0208). */
  hull: number;
  stage: number;
  /** Quest cargo lashed on deck and the deck's room (decision 0213); 0 hides it. */
  deck: number;
  deckRoom: number;
}

/**
 * Top left (issue #441): gold, hold and hull as ink-haloed text on the scene, quest cargo on deck
 * while there is some, and the tracked quest's line under them on a faint ink plate. The quest
 * note slides in under the whole cluster, `#captain-stats` (decision 0141).
 */
export class Status {
  readonly root = el('div', 'hud-status');
  readonly quest = el('button', 'hud-quest hud-plate');
  private readonly gold = el('b', '');
  private readonly hold = el('b', '');
  private readonly holdBox = el('span', 'hud-stat');
  private readonly crate = el('span', 'hud-crate');
  private readonly hull = el('b', '');
  private readonly hullBox = el('span', 'hud-stat hull-stat');
  private readonly deck = el('b', '');
  private readonly deckBox = el('span', 'hud-stat');
  private readonly questTitle = el('b', '');
  private readonly questDetail = el('span', '');
  private shownFill = -1;

  constructor() {
    const stats = el('div', 'hud-stats hud-halo');
    this.root.id = 'captain-stats';
    const goldBox = el('span', 'hud-stat');
    goldBox.id = 'hud-gold-box';
    labelAttrs(goldBox, { title: 'hud.gold' });
    this.gold.id = 'hud-gold';
    goldBox.innerHTML = icon('coin', 'coin');
    goldBox.append(this.gold);
    this.holdBox.id = 'hud-cargo-box';
    labelAttrs(this.holdBox, { title: 'hud.cargo' });
    this.hold.id = 'hud-cargo';
    this.holdBox.append(this.crate, this.hold);
    this.hullBox.id = 'hud-hull-box';
    labelAttrs(this.hullBox, { title: 'hud.hull' });
    this.hull.id = 'hud-hull';
    this.hullBox.innerHTML = icon('hull');
    this.hullBox.append(this.hull);
    this.deckBox.id = 'hud-deck-box';
    labelAttrs(this.deckBox, { title: 'hud.onDeck' });
    this.deckBox.hidden = true;
    this.deck.id = 'hud-deck';
    this.deckBox.innerHTML = icon('deck');
    this.deckBox.append(this.deck);
    stats.append(goldBox, this.holdBox, this.hullBox, this.deckBox);
    this.quest.id = 'hud-quest';
    this.quest.type = 'button';
    this.quest.hidden = true;
    const words = el('span', 'hud-quest-text');
    words.append(this.questTitle, this.questDetail);
    this.quest.innerHTML = icon('book');
    this.quest.append(words);
    this.root.append(stats, this.quest);
  }

  /** About eight times a second. */
  show(s: StatusFrame) {
    setText(this.gold, formatNumber(s.gold));
    setText(this.hold, `${s.used}/${s.capacity}`);
    // The crate fills with the hold instead of a bar (decision 0049), redrawn by the eighth.
    const fill = s.capacity > 0 ? Math.min(1, s.used / s.capacity) : 0;
    const eighths = Math.round(fill * 8);
    if (eighths !== this.shownFill) {
      this.shownFill = eighths;
      this.crate.innerHTML = crateIcon(fill);
    }
    this.holdBox.classList.toggle('is-full', s.used >= s.capacity);
    setText(this.hull, t('unit.percent', { n: s.hull }));
    this.hullBox.dataset.stage = String(s.stage);
    setHidden(this.deckBox, s.deck <= 0);
    if (s.deck > 0) setText(this.deck, `${s.deck}/${s.deckRoom}`);
  }

  /** The quest line's title as shown, for the idle fade. */
  get questText(): string {
    return this.quest.hidden ? '' : (this.questTitle.textContent ?? '');
  }

  /** The tracked quest's line, or none. */
  showQuest(line: QuestLine | null) {
    setHidden(this.quest, !line);
    if (!line) return;
    setText(this.questTitle, line.title);
    setText(this.questDetail, line.detail);
  }
}
