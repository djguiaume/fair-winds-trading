import TARGETS from '../data/balance-targets.json';
import { chartAreaIds, chartAreas } from './fog';
import { foundSite } from './founding';
import type { MapDef } from './map';
import type { Condition } from './questLibrary';
import { QUESTS, type QuestDef, roundStep } from './quests';
import type { TradeState } from './trade';
import { payStandingOrder } from './contracts';
import { isGood } from './goods';
import { TUNING } from '../data/tuning';

/*
 * The story order for the balance bots on a sea with fog (decision 0195). The game opens the outer
 * seas one by one through the quests (decision 0137): the ring's arcs first, then each sea's
 * letter charts its gateway and main port, its keeper's arc follows, and its outpost quest founds
 * the outpost that gathers the raw far good. Once the ring's early game is over (the cutter
 * bought, and the ring's arcs sailed), the bots play each sea's quests in order, as soon as each
 * starts: every step sailed in the level's wind (fetch the goods, carry them, reach the spot),
 * then each quest pays its gold, charts its areas and founds its sites from its own file. So the
 * story's length is measured, and follows the quest files as they change. A sea whose quests are
 * not written yet uses the chapter's `standIn` rewards, and takes as long as the other seas'
 * quests in the same place of their chapter.
 */

const STORY = TARGETS.story;

/** One quest's effect on the voyage when it is done. */
export interface StoryBeat {
  quest: string;
  /** The quest's file; none for a stand-in. */
  def?: QuestDef;
  /** Place in its chapter (letter 0, keeper's arc 1, outpost 2). */
  slot: number;
  /** A stand-in's start: these quests done (the quest before it in its chapter by default). */
  after?: string[];
  gold: number;
  charts: string[];
  found: string[];
}

export interface StoryChapter {
  sea: string;
  beats: StoryBeat[];
}

function beatOf(def: QuestDef, slot: number): StoryBeat {
  const steps = def.steps;
  return {
    quest: def.id,
    def,
    slot,
    gold: steps.reduce((g, s) => g + (s.reward?.gold ?? 0), def.reward?.gold ?? 0),
    charts: steps.flatMap((s) => s.charts ?? []),
    found: [...(def.reward?.found ?? []), ...steps.flatMap((s) => s.reward?.found ?? [])],
  };
}

type StandIn = Record<
  string,
  { gold: number; charts?: string[]; found?: string[]; after?: string[] }
>;

/**
 * The chapters of this map's story, in order: none on a sea without chart areas (the ring), so the
 * bots there trade with every port from the start as before. A chapter whose areas are all off the
 * map is left out.
 */
export function storyChapters(map: MapDef, quests: readonly QuestDef[] = QUESTS): StoryChapter[] {
  const areas = chartAreaIds(map);
  if (!areas.length) return [];
  const out: StoryChapter[] = [];
  for (const ch of STORY.chapters) {
    const beats = ch.quests.map((id, slot): StoryBeat => {
      const def = quests.find((q) => q.id === id);
      if (def) return beatOf(def, slot);
      const stand = (ch.standIn as StandIn | undefined)?.[id];
      return {
        quest: id,
        slot,
        after: stand?.after ?? (slot > 0 ? [ch.quests[slot - 1]!] : []),
        gold: stand?.gold ?? 0,
        charts: stand?.charts ?? [],
        found: stand?.found ?? [],
      };
    });
    if (beats.some((b) => b.charts.some((a) => areas.includes(a))))
      out.push({ sea: ch.sea, beats });
  }
  return out;
}

/** A spot a quest step names: a port id, or a point at sea. */
export type QuestPlace = { port: string } | { x: number; y: number; within: number };
/** Where to fetch a good a step asks for: the nearest port that makes it. */
export type QuestVisit = QuestPlace | { maker: string };

/**
 * The places a quest's steps send her to, in order, step by step: the goods' maker before a
 * delivery or a landing, both ends of a carry, the points to reach.
 */
export function questVisits(def: QuestDef): QuestVisit[][] {
  const at = (x: unknown): QuestPlace[] => {
    if (typeof x === 'string') return [{ port: x }];
    if (x && typeof x === 'object' && 'x' in x && 'y' in x) {
      const p = x as { x: number; y: number; within?: number };
      return [{ x: p.x, y: p.y, within: p.within ?? 10 }];
    }
    return [];
  };
  const walk = (c: Condition | undefined): QuestVisit[] => {
    if (!c) return [];
    switch (c.is) {
      case 'all':
        return (c.of as Condition[]).flatMap(walk);
      case 'any':
        return walk((c.of as Condition[])[0]);
      case 'docked':
        return at(c.port);
      case 'moored':
        return [{ port: 'home' }];
      case 'delivered':
        return [{ maker: String(c.good) }, ...at(c.port)];
      case 'landed':
        return [{ maker: String(c.good) }, ...at(c.place)];
      case 'carried':
        return [...at(c.from), ...at(c.to)];
      case 'reach':
        return (c.points as unknown[]).flatMap(at);
      default:
        return [];
    }
  };
  // A start that asks her to dock somewhere (Ness at Watchman Key) is her first leg.
  const docks = (c: Condition | undefined): QuestPlace[] =>
    !c
      ? []
      : c.is === 'all'
        ? (c.of as Condition[]).flatMap(docks)
        : c.is === 'docked'
          ? at(c.port)
          : [];
  return [docks(def.start as Condition), ...def.steps.map((s) => walk(s.goal))];
}

/** Times a quest from a port, leaving at a time (seconds), and says where she ends up. */
export type QuestTimer = (
  def: QuestDef,
  from: string,
  t: number,
) => { seconds: number; at: string };

/** Does a quest's start hold, with these quests done? Only the quest chain counts here. */
function startHolds(c: Condition | undefined, done: Record<string, number>): boolean {
  if (!c) return true;
  switch (c.is) {
    case 'all':
      return (c.of as Condition[]).every((x) => startHolds(x, done));
    case 'any':
      return (c.of as Condition[]).some((x) => startHolds(x, done));
    case 'not':
      return !startHolds(c.of as Condition, done);
    case 'quest-done':
      return done[String(c.quest)] !== undefined;
    default:
      // Docking at the giver's port and the like: her first leg of the quest.
      return true;
  }
}

/** The story of one voyage: when each quest is done, minutes into it. */
export class StoryClock {
  /** Minute each sea opened (its letter done), and the minute each quest was done. */
  readonly opened: Record<string, number> = {};
  readonly done: Record<string, number> = {};
  /** Minutes each chapter's quests took to sail (the ring's arcs under "ring"). */
  readonly chapterMinutes: Record<string, number> = {};
  /** Gold the quests paid. */
  gold = 0;
  private start: number | null = null;
  private readonly beats: Array<StoryBeat & { sea: string }>;
  /** The ring's arcs and the minute each could be done, sailed alongside the ring's trade. */
  private ring: Array<{ id: string; due: number }> = [];
  /** Minutes taken by each slot's written quests, for the stand-ins. */
  private readonly slotMinutes: number[][] = [];

  constructor(
    private readonly map: MapDef,
    chapters: readonly StoryChapter[],
    /** A relaxed captain takes longer over each step, as over each leg. */
    private readonly scale: number,
    private readonly quests: readonly QuestDef[] = QUESTS,
  ) {
    // The seas side by side (decision 0194): every letter, then every keeper's arc, then every
    // outpost, each as soon as its start holds.
    this.beats = chapters
      .flatMap((c) => c.beats.map((b) => ({ ...b, sea: c.sea })))
      .sort((a, b) => a.slot - b.slot);
  }

  get active() {
    return this.beats.length > 0;
  }

  /** The seas are open to her: she has begun on the story. */
  get started() {
    return this.start !== null;
  }

  /** Minute the last quest was done, if all were. */
  get finished(): number | undefined {
    const all = this.beats.map((b) => this.done[b.quest]);
    return all.every((m) => m !== undefined) ? Math.max(...(all as number[])) : undefined;
  }

  /**
   * The ring's arcs, sailed alongside the ring's trade in the order listed: the minute each could
   * be done, from the time their steps take on their own.
   */
  ringMinutes(timer: QuestTimer, home: string): number {
    let at = home;
    let seconds = 0;
    for (const id of STORY.ringQuests) {
      const def = this.quests.find((q) => q.id === id);
      if (!def) continue;
      const r = timer(def, at, seconds);
      seconds += r.seconds * this.scale;
      at = r.at;
      this.ring.push({ id, due: seconds / 60 });
    }
    this.chapterMinutes.ring = seconds / 60;
    return seconds / 60;
  }

  /**
   * She turns to the story at this minute (the cutter is hers): from now on the ring's arcs are
   * done as they come due (their trade changes, `afterQuest`, apply then; their gold is left out,
   * as on the ring), and each far quest is sailed once its start holds.
   */
  begin(minute: number) {
    if (this.start === null && this.active) this.start = minute;
  }

  /** The ring's arcs due by `minute`, once she has begun. */
  step(trade: TradeState, minute: number) {
    if (this.start === null) return;
    while (this.ring.length && this.ring[0]!.due <= minute) {
      const { id } = this.ring.shift()!;
      this.done[id] = minute;
      done(trade, id);
      // A hidden port an arc sends her to is on her chart by now (Watchman Key's lens).
      const def = this.quests.find((q) => q.id === id);
      if (def) for (const port of portsNamed(this.map, def)) discover(trade, port);
    }
  }

  private nextBeat() {
    return this.beats.find(
      (b) =>
        this.done[b.quest] === undefined &&
        (b.def
          ? startHolds(b.def.start as Condition, this.done)
          : (b.after ?? []).every((q) => this.done[q] !== undefined)),
    );
  }

  /** The next quest to sail, once begun and its start holds: its seconds and where it ends. */
  play(timer: QuestTimer, at: string, t: number): { seconds: number; at: string } | null {
    if (this.start === null) return null;
    const b = this.nextBeat();
    if (!b) return null;
    if (b.def) {
      const r = timer(b.def, at, t);
      const seconds = r.seconds * this.scale;
      (this.slotMinutes[b.slot] ??= []).push(seconds / 60);
      return { seconds, at: r.at };
    }
    // A stand-in takes as long as the written quests in its place of a chapter.
    const known = this.slotMinutes[b.slot] ?? [];
    const minutes = known.length ? known.reduce((a, m) => a + m, 0) / known.length : 10;
    return { seconds: minutes * 60, at };
  }

  /** The quest just sailed is done at `minute`: its gold, charts, sites and trade changes. */
  land(trade: TradeState, minute: number, seconds: number) {
    const b = this.nextBeat()!;
    this.opened[b.sea] ??= minute - seconds / 60;
    this.done[b.quest] = minute;
    this.chapterMinutes[b.sea] = (this.chapterMinutes[b.sea] ?? 0) + seconds / 60;
    chartAreas(this.map, trade.progress, b.charts);
    for (const id of b.found) {
      foundSite(trade, this.map, id);
      // She has sailed there with the founding goods and the settler, so it is on her chart.
      const island = this.map.ports.find((p) => p.id === id)?.islandId;
      if (island) (trade.progress.sighted ??= []).push(island);
    }
    done(trade, b.quest);
    trade.captain.gold += b.gold;
    this.gold += b.gold;
  }
}

/** Hidden ports a quest names anywhere in its file (a step's port, a carried item's ends). */
function portsNamed(map: MapDef, def: QuestDef): string[] {
  const ids = new Set<string>();
  const walk = (x: unknown) => {
    if (typeof x === 'string') ids.add(x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  walk(def);
  return map.ports.filter((p) => p.hidden && ids.has(p.id)).map((p) => p.id);
}

function discover(trade: TradeState, port: string) {
  if (!trade.progress.discovered.includes(port)) trade.progress.discovered.push(port);
}

/** A quest the bots count as played: done, so the trade it changes follows (decision 0130). */
function done(trade: TradeState, id: string) {
  trade.quests.byId[id] = { counts: [], chose: {}, ...trade.quests.byId[id], step: 'done' };
}

/** What ends the ring's early game for the bots: buying this (the cutter). */
export const STORY_OPENS_AFTER = STORY.opensAfter;

/**
 * The standing orders for the balance bots (decision 0214): once a person's arc is done, docking
 * at their port with the goods of the ask due there hands them over and is paid like a help order,
 * one ask at a time per port, the next after calls elsewhere, as in the game. The bot never buys
 * for an ask: it hands over what it carries there to sell anyway, so this is the most a captain who
 * just trades gets from them.
 */
export class StandingOrders {
  private readonly asks: { def: QuestDef; port: string; rounds: number; wait: number }[];
  /** Gold the asks paid. */
  gold = 0;

  constructor(map: MapDef, quests: readonly QuestDef[] = QUESTS) {
    this.asks = quests
      .filter((q) => q.repeat && map.ports.some((p) => p.id === q.port))
      .map((def) => ({ def, port: def.port!, rounds: 0, wait: 0 }));
  }

  /** Docked at `port` with these quests done: hand over the ask due, if aboard. Returns its gold. */
  dock(map: MapDef, trade: TradeState, port: string, done: Record<string, number>): number {
    for (const a of this.asks) if (a.port !== port && a.wait) a.wait -= 1;
    const ready = this.asks.filter(
      (a) => a.port === port && !a.wait && startHolds(a.def.start, done),
    );
    const ask = ready.reduce<(typeof ready)[number] | undefined>(
      (best, a) => (!best || a.rounds < best.rounds ? a : best),
      undefined,
    );
    const goal =
      ask && roundStep(ask.def, { step: '', counts: [], chose: {}, rounds: ask.rounds }).goal;
    if (!ask || !goal || !isGood(goal.good) || typeof goal.qty !== 'number') return 0;
    if (trade.captain.cargo[goal.good] < goal.qty) return 0;
    trade.captain.cargo[goal.good] -= goal.qty;
    const gold = payStandingOrder(map, trade, port, goal.good, goal.qty);
    ask.rounds += 1;
    ask.wait = TUNING.economy.orders.standingDockings;
    this.gold += gold;
    return gold;
  }
}
