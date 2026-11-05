import {
  type QuestOption,
  type QuestStep,
  type QuestDef,
  QUEST_DONE,
  type QuestEvent,
} from './questTypes';
import { findStep, missesPlace, nextOf, questHold } from './questFlow';
import { createBoat } from './boat';
import { chartAreas } from './fog';
import { GOODS, isGood } from './goods';
import {
  deref,
  parFor,
  resolvePort,
  slotLayout,
  updateGoal,
  RUN_GOING,
  RUN_MADE,
  RACE_FINISHED,
  RACE_HORN,
} from './questLibrary';
import { type QuestReward, payReward } from './questRewards';
import { courseOf, medalFor, medalGold, seriesWon } from './regatta';
import { grantSeriesPrizes } from './seriesPrizes';
import { bestFor, raceRecord, recordTime } from './raceRecords';
import { createRival, endRival, releaseRival, rivalTime } from './rival';
import { deckFree, syncMarketLevels } from './trade';
import { payStandingOrder } from './contracts';
import { TUNING } from '../data/tuning';
import { QuestBookBase } from './questBookBase';

/**
 * How the quest book moves quests on (decision 0125): a step entered, its numbers kept, a step or
 * a race finished and paid. `quests.ts` calls these from the captain's actions and the checks.
 */
export abstract class QuestBookSteps extends QuestBookBase {
  protected dropRace(id: string): QuestEvent[] {
    const quest = this.quests.find((q) => q.id === id);
    const p = this.progress(id);
    if (!quest?.race || !p || p.step === QUEST_DONE) return [];
    if (p.best !== undefined)
      this.state.byId[id] = {
        step: QUEST_DONE,
        counts: [],
        chose: {},
        ...raceRecord(p),
      };
    else delete this.state.byId[id];
    this.announced.delete(id);
    releaseRival(this.world, false);
    return [{ type: 'retired', quest: id }];
  }

  /** A timed run that changed state in this check (decision 0213), said as a `run` event. */
  protected runEvents(
    quest: QuestDef,
    step: QuestStep,
    before: readonly number[],
    after: readonly number[],
    events: QuestEvent[],
  ) {
    for (const [c, at] of slotLayout(step.goal).at) {
      if (c.is !== 'timed' || before[at] === after[at]) continue;
      const state = after[at] === RUN_GOING ? 'started' : after[at] === RUN_MADE ? 'made' : 'late';
      const map = this.world.map;
      const vars = this.progress(quest.id)?.vars;
      const from = resolvePort(map, deref(c.from, vars)) ?? '';
      const to = resolvePort(map, deref(c.to, vars)) ?? from;
      // A late run's clock is already back to nothing: it said par when it gave up.
      const sec = state === 'made' ? (after[at + 1] ?? 0) / 100 : (before[at + 1] ?? 0) / 100;
      const par = parFor(c.par, this.trade);
      events.push({ type: 'run', quest: quest.id, step: step.id, state, sec, par, from, to });
    }
  }

  /** Fills a quest's vars from a `set` (decision 0151), with what the voyage holds now. */
  protected applySet(quest: QuestDef, set: Record<string, string> | undefined) {
    const p = this.progress(quest.id);
    if (!set || !p) return;
    const vars = { ...(p.vars ?? {}) };
    for (const [name, source] of Object.entries(set)) {
      let value: string | null | undefined;
      if (source === 'course') value = this.context().course;
      else if (source === 'docked') value = this.trade.dockedAt;
      else if (source === 'aboard') value = GOODS.find((g) => this.trade.captain.cargo[g] > 0);
      else value = deref(source, p.vars) as string | undefined;
      if (quest.vars?.[name] === 'port') value = resolvePort(this.world.map, value);
      if (value) vars[name] = value;
      else delete vars[name];
    }
    p.vars = vars;
    if (!Object.keys(vars).length) delete p.vars;
  }

  protected afterChange(events: QuestEvent[]) {
    this.state.hold = questHold(this.state, this.quests);
    if (!this.state.hold) delete this.state.hold;
    const active = this.active.map((a) => a.quest.id);
    // A running lesson is always the one tracked (decision 0151).
    const lesson = this.lesson?.quest.id;
    if (lesson) this.state.tracked = lesson;
    // A started quest is tracked when nothing is; a finished one hands over to the next.
    else if (!this.state.tracked || !active.includes(this.state.tracked)) {
      const started = events.find((e) => e.type === 'started' && active.includes(e.quest));
      const next = started?.quest ?? active[0];
      if (next) this.state.tracked = next;
      else delete this.state.tracked;
    }
    for (const e of events) this.onEvent(e);
  }

  protected enter(quest: QuestDef, step: QuestStep, events: QuestEvent[]) {
    const was = this.progress(quest.id);
    const counts = new Array<number>(slotLayout(step.goal).size).fill(0);
    this.state.byId[quest.id] = {
      step: step.id,
      counts,
      chose: was?.chose ?? {},
      ...(was?.vars ? { vars: was.vars } : {}),
      ...(was?.rounds ? { rounds: was.rounds } : {}),
      ...(was ? raceRecord(was) : {}),
    };
    if (step.charts) chartAreas(this.world.map, this.trade.progress, step.charts);
    // A step about a place this map lacks (the prologue's wreck) is passed by (decision 0151), and
    // a teaching step while its lesson runs without the coach (decision 0160).
    if (missesPlace(step, this.world.map) || this.passesBy(quest, step)) {
      this.finishStep(quest, step, undefined, events);
      return;
    }
    if (step.moveTo) {
      // The boat is taken to the step's place (decision 0164): sails down, off the pier.
      const { x, y, headingDeg } = step.moveTo;
      const heading =
        headingDeg === undefined ? this.world.boat.heading : (headingDeg * Math.PI) / 180;
      this.world.boat = { ...createBoat(x, y, heading), sailStep: 0 };
      this.world.destination = null;
      this.trade.dockedAt = null;
      events.push({ type: 'moved', quest: quest.id, step: step.id });
    }
    // The rival comes to the line beside the boat and waits for the horn (decision 0217).
    const course = quest.race && courseOf(step.goal);
    if (course && quest.race) createRival(this.world, quest.race, course);
    events.push({
      type: step.choose && !step.goal ? 'choice' : 'step',
      quest: quest.id,
      step: step.id,
    });
  }

  /** A step paid like a help order (decision 0214): the goods it landed, at its port. */
  protected payOrder(step: QuestStep) {
    const g = step.goal;
    if (this.orderGold(step) === undefined || !isGood(g?.good)) return;
    const port = resolvePort(this.world.map, g.place)!;
    payStandingOrder(this.world.map, this.trade, port, g.good, g.qty as number);
  }

  protected pay(r: QuestReward | undefined) {
    payReward(this.trade, this.world.map, r, () => syncMarketLevels(this.trade, this.world.map));
  }

  /** A reward's eruptions (decision 0178), played in the game and never in a quest test's skip. */
  protected erupt(quest: QuestDef, rewards: (QuestReward | undefined)[], events: QuestEvent[]) {
    for (const r of rewards)
      for (const island of r?.erupt ?? []) events.push({ type: 'erupt', quest: quest.id, island });
  }

  protected finishStep(
    quest: QuestDef,
    step: QuestStep,
    option: QuestOption | undefined,
    events: QuestEvent[],
  ) {
    if (quest.race) this.finishRace(quest, step, events);
    this.pay(step.reward);
    this.pay(option?.reward);
    this.payOrder(step);
    this.erupt(quest, [step.reward, option?.reward], events);
    this.applySet(quest, step.set);
    const to = findStep(quest, nextOf(quest, step, option));
    const gold = (step.reward?.gold ?? 0) + (option?.reward?.gold ?? 0);
    if (to) {
      if (gold) events.push({ type: 'paid', quest: quest.id, step: step.id, gold });
      this.enter(quest, to, events);
      return;
    }
    const p = this.progress(quest.id)!;
    this.state.byId[quest.id] = {
      step: QUEST_DONE,
      counts: [],
      chose: p.chose,
      ...(p.vars ? { vars: p.vars } : {}),
      // A standing order asks again after a few calls elsewhere (decision 0214).
      ...(quest.repeat
        ? { rounds: (p.rounds ?? 0) + 1, wait: TUNING.economy.orders.standingDockings }
        : {}),
      ...raceRecord(p),
    };
    if (quest.repeat) this.announced.delete(quest.id);
    this.pay(quest.reward);
    this.erupt(quest, [quest.reward], events);
    const all = gold + (quest.reward?.gold ?? 0);
    if (all) events.push({ type: 'paid', quest: quest.id, step: step.id, gold: all });
    // A port that trades differently after this quest has its market follow at once (0130).
    if (this.world.map.ports.some((port) => port.afterQuest?.[quest.id]))
      syncMarketLevels(this.trade, this.world.map);
    events.push({ type: 'finished', quest: quest.id });
  }

  /** A race's finish (decision 0217): its medal, first-time gold and the series it wins. */
  protected finishRace(quest: QuestDef, step: QuestStep, events: QuestEvent[]) {
    const p = this.progress(quest.id)!;
    const race = quest.race!;
    const at = slotLayout(step.goal).at.get(step.goal!) ?? 0;
    if (p.counts[at] !== RACE_FINISHED) return;
    const hundredths = p.counts[at + 1] ?? 0;
    const sec = hundredths / 100;
    const medal = medalFor(race, this.trade.captain.activeShip, this.trade.difficulty, sec);
    const had = p.medal ?? 0;
    const ship = this.trade.captain.activeShip;
    const first = bestFor(p, ship) === undefined;
    const best = recordTime(p, ship, hundredths);
    if (medal > had) p.medal = medal;
    const gold = medalGold(race, had, medal);
    this.trade.captain.gold += gold;
    const before = new Set(this.state.won ?? []);
    this.updateWon();
    const won = (this.state.won ?? []).filter((s) => !before.has(s));
    const rival = rivalTime(this.world);
    endRival(this.world);
    events.push({
      type: 'raced',
      quest: quest.id,
      sec,
      medal,
      had,
      best,
      first,
      gold,
      won,
      ...(rival !== undefined ? { rival } : {}),
    });
  }

  /** The series won, from the races' medals (decision 0217). */
  protected updateWon() {
    const won = seriesWon(this.quests, (id) => this.progress(id)?.medal ?? 0);
    grantSeriesPrizes(this.world.trade, won);
    if (won.length) this.state.won = won;
    else delete this.state.won;
  }

  /** A call at a port: standing orders of other ports wait one docking less (decision 0214). */
  protected dockedAt(portId: string) {
    for (const quest of this.quests) {
      const p = this.progress(quest.id);
      if (!quest.repeat || !p?.wait || resolvePort(this.world.map, quest.port) === portId) continue;
      p.wait -= 1;
      if (!p.wait) delete p.wait;
    }
  }

  /** The conditions that keep numbers see what changed since the last check. */
  protected updateSteps(dt: number, events: QuestEvent[]) {
    const { boat, trade } = this.world;
    const damage = trade.captain.hullDamage[trade.captain.activeShip] ?? 0;
    const seen = this.seen;
    this.seen = {
      x: boat.x,
      y: boat.y,
      docked: trade.dockedAt,
      cargo: { ...trade.captain.cargo },
      damage,
    };
    const helm = this.helm;
    this.helm = { sails: helm.sails.slice(-1), steerSec: 0, movingSec: 0 };
    // The first check after loading only takes note: nothing happened "since" yet.
    if (!seen) return;
    if (trade.dockedAt && trade.dockedAt !== seen.docked) {
      this.dockedAt(trade.dockedAt);
      // Alongside mid-race, the race is given up (decision 0217).
      for (const { quest } of [...this.active])
        if (quest.race) events.push(...this.dropRace(quest.id));
    }
    // A new knock, or the hull still grinding on a reef or a shore (decision 0139).
    const hit = damage > seen.damage || boat.sinceBump < 0.5;
    const nightOk = this.nightOk();
    for (const { quest, step } of this.active) {
      if (!step.goal) continue;
      const p = this.progress(quest.id)!;
      if (step.clean && hit) {
        if (p.counts.some((n) => n > 0))
          events.push({ type: 'reset', quest: quest.id, step: step.id });
        p.counts = p.counts.map(() => 0);
      } else {
        const before = [...p.counts];
        updateGoal(
          step.goal,
          {
            ...this.context(quest),
            helm,
            dt,
            boat: { x: boat.x, y: boat.y, speedKn: boat.speedKn },
            from: seen,
            wasDocked: seen.docked,
            cargoBefore: seen.cargo,
            nightOk,
            freeSpace: deckFree(trade),
            itemSpace: (item) => quest.items?.[item]?.space ?? 1,
            land: (good, qty) => {
              trade.captain.cargo[good] -= qty;
              events.push({ type: 'landed', quest: quest.id, good, qty });
            },
          },
          p.counts,
        );
        this.runEvents(quest, step, before, p.counts, events);
        if (quest.race && before[0] === RACE_HORN && p.counts[0] !== RACE_HORN) {
          releaseRival(this.world, true);
          events.push({ type: 'horn', quest: quest.id });
        }
      }
      // Quest cargo just loaded takes its room before the next quest loads any.
      this.state.hold = questHold(this.state, this.quests);
    }
  }
}
