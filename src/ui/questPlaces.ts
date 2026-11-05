import { tOptional } from '../i18n';
import type { MapDef } from '../sim/map';
import {
  CONDITIONS,
  type Condition,
  type QuestPoint,
  isSpot,
  pointOf,
  resolvePort,
  slotLayout,
} from '../sim/questLibrary';
import { type QuestBook, type QuestDef } from '../sim/quests';
import { REGATTA } from '../sim/regatta';
import { findPort } from '../sim/trade';
import { type Character, character } from './portraits';
import { raceNext } from './regattaView';
import { stepParams } from './questWords';

/* Where the quests point (decisions 0124, 0130): chart pins, the sea's target and step markers. */

export interface QuestPin {
  port: string;
  giver: Character;
  /** Something new to ask or to see. */
  alert: boolean;
  tracked: boolean;
}

/** A face on each port where someone has a started or offered quest (one per port). */
export function questPins(book: QuestBook, map: MapDef, seen: ReadonlySet<string>): QuestPin[] {
  const pins = new Map<string, QuestPin>();
  const add = (quest: QuestDef, alert: boolean, tracked: boolean) => {
    const giver = quest.giver ? character(quest.giver) : undefined;
    const port = resolvePort(map, giver?.port ?? quest.port);
    if (!giver || !port) return;
    const was = pins.get(port);
    pins.set(port, {
      port,
      giver: was && !tracked ? was.giver : giver,
      alert: alert || !!was?.alert,
      tracked: tracked || !!was?.tracked,
    });
  };
  for (const { quest, step } of book.active)
    add(quest, !seen.has(`${quest.id}:${step.id}`), book.tracked === quest.id);
  for (const quest of book.offered) add(quest, true, false);
  return [...pins.values()];
}

/** Where the tracked step leads on the chart: a port, or a spot at sea (decision 0131). */
export interface QuestTarget {
  port?: string;
  point?: QuestPoint;
  radius?: number;
}

/**
 * Where the tracked step leads on the chart: the step's rough circle, else the port its goal
 * names (quest cargo: where to load it, then where to bring it, which may be a spot at sea).
 */
export function questTarget(book: QuestBook, map: MapDef): QuestTarget | null {
  const active = book.active.find((a) => a.quest.id === book.tracked);
  if (!active) return null;
  const { step, quest } = active;
  // A race leads to its line, then each mark in turn, then its finish (decision 0217).
  const next = quest.race ? raceNext(book) : null;
  if (next) return { point: next };
  if (step.chart) {
    const port = resolvePort(map, step.chart.port);
    return port ? { port, radius: step.chart.radius } : null;
  }
  const goal = step.goal;
  // Moored at one of her islands (a home island's pier): the island itself.
  if (goal?.is === 'moored') {
    const island = map.islands.find((i) => i.id === (goal.island ?? map.homeIsland));
    return island ? { point: { x: island.x, y: island.y } } : null;
  }
  const counts = book.progress(quest.id)?.counts ?? [];
  // Founding goods (decision 0157): where they land, alone or the first of several.
  const landed =
    goal?.is === 'landed'
      ? goal
      : goal?.is === 'all'
        ? (goal.of as Condition[]).find((c) => c.is === 'landed')
        : undefined;
  const id =
    goal?.is === 'carried'
      ? (counts[0] ?? 0) > 0
        ? goal.to
        : goal.from
      : landed
        ? landed.place
        : (goal?.port ?? step.port ?? quest.port);
  if (isSpot(id)) return { point: { x: id.x, y: id.y }, radius: id.within };
  const port = book.portOf(quest.id, id);
  return port ? { port } : null;
}

/**
 * Where the tracked step leads, for the sea's objective panel and edge arrow when no course is set
 * (decision 0139): the step's `compass` point, else its spot at sea, else the harbour's pier
 * (`harbours`) or the island; named by the step's ask or the port.
 */
export function questGoal(
  book: QuestBook,
  map: MapDef,
  harbours: Record<string, { x: number; y: number }>,
): { x: number; y: number; label: string; portId?: string; place?: string } | null {
  const target = questTarget(book, map);
  const active = book.active.find((a) => a.quest.id === book.tracked);
  if (!active) return null;
  const ask = tOptional(
    `${active.quest.text}.${active.step.id}.title`,
    stepParams(book, active.step, active.quest),
  );
  const point = book.compassOf(active.step) ?? target?.point;
  if (point) {
    const place = placeBy(map, point);
    return { x: point.x, y: point.y, label: ask ?? active.quest.name, ...(place ? { place } : {}) };
  }
  const port = target?.port ? findPort(map, target.port) : undefined;
  const island = port && map.islands.find((i) => i.id === port.islandId);
  const at = (port && harbours[port.id]) ?? island;
  return port && at ? { x: at.x, y: at.y, label: port.name, portId: port.id } : null;
}

/** How near a named island a spot at sea is said to be by it (decision 0212). */
const PLACE_REACH = 25;

/** The named island a spot at sea lies by, for a course's name ("To Teeth Rock"), if any. */
export function placeBy(map: MapDef, at: { x: number; y: number }): string | undefined {
  let best: string | undefined;
  let bestGap = PLACE_REACH;
  for (const island of map.islands) {
    const gap = Math.hypot(island.x - at.x, island.y - at.y) - island.radius;
    if (island.name && gap < bestGap) {
      best = island.name;
      bestGap = gap;
    }
  }
  return best;
}

/** A place at sea the tracked step asks the boat to reach (decision 0130). */
export interface StepMarker extends QuestPoint {
  within: number;
  /** Passed already (a gate behind the boat, a spot visited). */
  reached: boolean;
  /** The one to make for: the next gate in order, every spot still to visit in any order. */
  next: boolean;
}

/**
 * The step's places at sea, read from its goal and its numbers: `reach` points, a timed run's
 * `via` points, and quest cargo's spot at sea (where to load it, then where to bring it). Places
 * that are ports are not markers: the chart's ring and route show them.
 */
export function stepMarkers(
  goal: Condition | undefined,
  counts: readonly number[],
  map?: MapDef,
): StepMarker[] {
  const out: StepMarker[] = [];
  for (const [c, at] of slotLayout(goal).at) {
    const s = counts.slice(at, at + (CONDITIONS[c.is]?.slots ?? 0));
    const first = s[0] ?? 0;
    if (c.is === 'reach' && Array.isArray(c.points)) {
      const inOrder = c.order === 'in-order';
      (c.points as unknown[]).forEach((at, i) => {
        // A map place (the prologue's wreck) where this map has it (decision 0151).
        const p = map ? pointOf(map, at) : typeof at === 'object' ? (at as QuestPoint) : null;
        if (!p) return;
        const reached = inOrder ? i < first : (first & (1 << i)) !== 0;
        const within = typeof c.within === 'number' ? c.within : 0;
        out.push({ x: p.x, y: p.y, within, reached, next: inOrder ? i === first : !reached });
      });
    }
    if (c.is === 'timed' && Array.isArray(c.via)) {
      const passed = s[2] ?? 0;
      const within = typeof c.within === 'number' ? c.within : 15;
      (c.via as QuestPoint[]).forEach((p, i) =>
        out.push({ x: p.x, y: p.y, within, reached: i < passed, next: i === passed }),
      );
    }
    // A race's marks (decision 0217): rounded behind, the next one to make for.
    if (c.is === 'raced' && Array.isArray(c.marks) && first !== 0) {
      const rounded = Math.max(0, (s[2] ?? 0) - 1);
      const within = typeof c.within === 'number' ? c.within : REGATTA.within;
      (c.marks as QuestPoint[]).forEach((p, i) =>
        out.push({ x: p.x, y: p.y, within, reached: i < rounded, next: i === rounded }),
      );
    }
    if (c.is === 'carried' && (s[1] ?? 0) < (typeof c.qty === 'number' ? c.qty : 0)) {
      const spot = first > 0 ? c.to : c.from;
      if (isSpot(spot))
        out.push({ x: spot.x, y: spot.y, within: spot.within, reached: false, next: true });
    }
    // Founding goods' landing spot (decision 0157), until they are all ashore.
    if (c.is === 'landed' && isSpot(c.place) && first < (typeof c.qty === 'number' ? c.qty : 0)) {
      const p = c.place;
      if (!out.some((m) => m.x === p.x && m.y === p.y))
        out.push({ x: p.x, y: p.y, within: p.within, reached: false, next: true });
    }
  }
  return out;
}

/** The tracked step's markers and how they are drawn (the step's `marker`, default rings). */
export function trackedMarkers(book: QuestBook): { style: string; points: StepMarker[] } | null {
  const active = book.active.find((a) => a.quest.id === book.tracked);
  if (!active) return null;
  const points = stepMarkers(
    active.step.goal,
    book.progress(active.quest.id)?.counts ?? [],
    book.map,
  );
  return points.length ? { style: active.step.marker ?? 'ring', points } : null;
}
