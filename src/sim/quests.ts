import { type QuestDef, QUEST_DONE, type QuestEvent } from './questTypes';
import { findStep, roundStep, isAsked, routeTo } from './questFlow';
import { readVars } from './questSave';
import { trueWindAngle } from './boat';
import { type Condition, slotLayout, testCondition } from './questLibrary';
import { syncMarketLevels } from './trade';
import { pointOfSail } from './ship';
import { QUEST_CHECK_SEC } from './questBookBase';
import { QuestBookSteps } from './questBookSteps';

/*
 * The quest engine (decision 0125): every file in `src/data/quests/` is a quest in the format of
 * decision 0113, the tutorial too (decision 0151). Each starts when its `start` condition holds
 * (the tutorial when the game asks for it) and runs here, several at once, with its progress saved
 * in the voyage (`trade.quests`). Conditions and rewards are the code library in `questLibrary.ts`.
 * How to write one: docs/content/README.md.
 *
 * Where each part lives: the format in `questTypes.ts`, the quest files and their steps in
 * `questFlow.ts`, the checks in `questChecks.ts`, the saves in `questSave.ts`, and the quest book
 * in three layers: `questBookBase.ts` (what it knows), `questBookSteps.ts` (how quests move on)
 * and `QuestBook` here (what the game and the captain do).
 */

export * from './questTypes';
export * from './questFlow';
export * from './questChecks';
export * from './questSave';
export { QUEST_CHECK_SEC, type QuestBookOptions } from './questBookBase';

/**
 * Runs the quests on the voyage. Never moves the boat, trades or picks for the player: it reads the
 * voyage, moves quests on and pays their rewards.
 */
export class QuestBook extends QuestBookSteps {
  /** "Don't offer again": the offer leaves the cards and the badges, the journal keeps it. */
  ignore(id: string): boolean {
    if (!this.offered.some((q) => q.id === id)) return false;
    this.state.ignored = [...(this.state.ignored ?? []), id];
    return true;
  }

  /** Take an ignored offer up again: it is offered as before, at its port. */
  unignore(id: string): boolean {
    if (!this.isIgnored(id)) return false;
    this.state.ignored = this.state.ignored!.filter((q) => q !== id);
    if (!this.state.ignored.length) delete this.state.ignored;
    return true;
  }

  /** The player's yes to an offered quest. */
  accept(id: string): QuestEvent[] {
    const quest = this.offered.find((q) => q.id === id);
    if (!quest) return [];
    const events: QuestEvent[] = [{ type: 'started', quest: id }];
    this.enter(quest, roundStep(quest, this.progress(id)), events);
    // A race holds its wind while it runs: it is the one tracked (decision 0217).
    if (quest.race && !this.lesson) this.state.tracked = id;
    this.afterChange(events);
    return [...events, ...this.check()];
  }

  /** A race finished before, sailed again from its start (decision 0217). */
  raceAgain(id: string): QuestEvent[] {
    const quest = this.quests.find((q) => q.id === id);
    if (!quest?.race || !this.isDone(id) || this.isRunning(id) || this.lesson) return [];
    if (this.active.some((a) => a.quest.race)) return [];
    const events: QuestEvent[] = [{ type: 'started', quest: id }];
    this.enter(quest, quest.steps[0]!, events);
    this.state.tracked = id;
    this.afterChange(events);
    return [...events, ...this.check()];
  }

  /**
   * The race under way is given up (decision 0217): one finished before goes back to its record,
   * one never finished is offered again. Nothing else is lost.
   */
  retire(id: string): QuestEvent[] {
    const events = this.dropRace(id);
    this.afterChange(events);
    return events;
  }

  /** Show this quest in the journal and at sea. A running lesson keeps the sea (decision 0151). */
  track(id: string): boolean {
    if (!this.active.some((a) => a.quest.id === id)) return false;
    if (this.lesson && this.lesson.quest.id !== id) return false;
    this.state.tracked = id;
    return true;
  }

  /**
   * The game asks for a quest that starts `asked` (decision 0151: Start tutorial, the menu's
   * Tutorial): it starts from its first step, again if it ran before, and is tracked.
   */
  ask(id: string): QuestEvent[] {
    const quest = this.quests.find((q) => q.id === id);
    if (!quest || !isAsked(quest)) return [];
    delete this.state.byId[id];
    // Asked again, a lesson speaks again (decision 0160).
    this.state.uncoached = this.state.uncoached?.filter((q) => q !== id);
    if (!this.state.uncoached?.length) delete this.state.uncoached;
    const events: QuestEvent[] = [{ type: 'started', quest: id }];
    this.enter(quest, quest.steps[0]!, events);
    this.state.tracked = id;
    this.afterChange(events);
    return [...events, ...this.check()];
  }

  /**
   * Puts a quest that has no progress at one of its steps, paying nothing: for progress kept
   * elsewhere before (the tutorial's own storage before decision 0151). Returns whether it did.
   */
  restore(id: string, stepId: string, vars: Record<string, string> = {}): boolean {
    const quest = this.quests.find((q) => q.id === id);
    const step = quest && findStep(quest, stepId);
    if (!quest || !step || this.progress(id)) return false;
    const counts = new Array<number>(slotLayout(step.goal).size).fill(0);
    const kept = readVars(quest, this.world.map, vars);
    this.state.byId[id] = { step: stepId, counts, chose: {}, ...(kept ? { vars: kept } : {}) };
    this.afterChange([]);
    return true;
  }

  /** The captain stops a running quest (Skip on the tutorial): it counts as done, unpaid. */
  drop(id: string): boolean {
    const p = this.progress(id);
    if (!p || p.step === QUEST_DONE) return false;
    this.state.byId[id] = { step: QUEST_DONE, counts: [], chose: p.chose };
    this.afterChange([]);
    return true;
  }

  /**
   * The lesson goes on without its coach (decision 0160: the tutorial skipped): no bubble, its
   * `teach` steps passed by, so the captain still plays its story. Returns what happened.
   */
  coachOff(id: string): QuestEvent[] {
    const quest = this.quests.find((q) => q.id === id);
    if (!quest?.lesson || !this.isCoached(id)) return [];
    this.state.uncoached = [...(this.state.uncoached ?? []), id];
    const events: QuestEvent[] = [];
    const step = findStep(quest, this.progress(id)?.step);
    if (step?.teach) this.finishStep(quest, step, undefined, events);
    this.afterChange(events);
    return [...events, ...this.check()];
  }

  /**
   * Called every simulation step, with the helm when the game has it (decision 0151); checks a few
   * times a second.
   */
  update(dt: number, controls?: { sailStep: number; steer: number }): QuestEvent[] {
    if (controls) {
      const { helm } = this;
      if (helm.sails.at(-1) !== controls.sailStep) helm.sails.push(controls.sailStep);
      if (Math.abs(controls.steer) > 0.15) helm.steerSec += dt;
      if (this.world.boat.speedKn > 0.7) helm.movingSec += dt;
      // The point of sail and the tacks (decision 0164): a tack is the bow crossing the wind.
      const { boat, wind, ship } = this.world;
      const twa = trueWindAngle(boat.heading, wind);
      const point = pointOfSail(ship, twa);
      helm.pointSec = { ...helm.pointSec, [point]: (helm.pointSec?.[point] ?? 0) + dt };
      // Bearing away past abeam forgets the side, so a gybe round to the other tack is no tack.
      if (Math.abs(twa) >= Math.PI / 2) this.windSide = 0;
      else if (twa !== 0) {
        const side = Math.sign(twa);
        if (this.windSide && side !== this.windSide) helm.tacks = (helm.tacks ?? 0) + 1;
        this.windSide = side;
      }
    }
    this.since += dt;
    if (this.since < QUEST_CHECK_SEC) return [];
    const elapsed = this.since;
    this.since = 0;
    return this.check(elapsed);
  }

  /** Move the steps' numbers on, then start quests and move them on until nothing changes. */
  check(dt = 0): QuestEvent[] {
    const events: QuestEvent[] = [];
    this.updateSteps(dt, events);
    // A quest takes one way back per check (decision 0151), so two that point at each other
    // cannot spin.
    const wentBack = new Set<string>();
    // Each pass can only start a quest or move one forward (or back, once), so this ends.
    for (let changed = true; changed;) {
      changed = false;
      for (const quest of this.quests) {
        const p = this.progress(quest.id);
        if (!p || this.mayStart(quest)) {
          if (!testCondition(quest.start, this.context(quest))) {
            this.announced.delete(quest.id);
            continue;
          }
          if (quest.offer) {
            // A standing order waits while another person at its port asks (decision 0214).
            if (quest.repeat && !this.offered.some((q) => q.id === quest.id)) {
              this.announced.delete(quest.id);
              continue;
            }
            if (!this.announced.has(quest.id) && !this.isIgnored(quest.id))
              events.push({ type: 'offered', quest: quest.id });
            this.announced.add(quest.id);
            continue;
          }
          events.push({ type: 'started', quest: quest.id });
          this.enter(quest, quest.steps[0]!, events);
          changed = true;
          continue;
        }
        const step = findStep(quest, p.step);
        if (!step) continue;
        const ctx = this.context(quest);
        if (step.goal && testCondition(step.goal, ctx, p.counts)) {
          this.finishStep(quest, step, undefined, events);
          changed = true;
          continue;
        }
        if (wentBack.has(quest.id)) continue;
        // A way back to a step passed by is not taken (decision 0160): it would only come back.
        const way = step.unless?.find((w) => {
          const back = findStep(quest, w.to);
          return !(back && this.passesBy(quest, back)) && testCondition(w.if, ctx);
        });
        const to = way && findStep(quest, way.to);
        if (!way || !to) continue;
        wentBack.add(quest.id);
        this.applySet(quest, way.set);
        this.enter(quest, to, events);
        changed = true;
      }
    }
    this.afterChange(events);
    // A step begun at a stop does its part there at once (decision 0213): the bread Maren gives
    // as the millstones come ashore is aboard before the harbour screen says so.
    if (!this.again && events.some((e) => e.type === 'step' || e.type === 'started')) {
      this.again = true;
      try {
        return [...events, ...this.check()];
      } finally {
        this.again = false;
      }
    }
    return events;
  }

  /** The player picks `option` on the quest's current choice step. */
  choose(questId: string, optionId: string): QuestEvent[] {
    const quest = this.quests.find((q) => q.id === questId);
    const p = this.progress(questId);
    const step = quest && p && findStep(quest, p.step);
    const option = this.options(questId).find((o) => o.id === optionId);
    if (!quest || !p || !step || !option) return [];
    p.chose[step.id] = option.id;
    const events: QuestEvent[] = [];
    this.finishStep(quest, step, option, events);
    this.afterChange(events);
    // A quest waiting on this one may start now.
    return [...events, ...this.check()];
  }

  // --- Play-testing from the quest builder (decision 0142) ---------------------------------------

  /**
   * Starts a quest at one of its steps on a fresh voyage, for play-testing: the quests its start
   * names are finished first (their rewards paid, the options they need picked), then the quest's
   * earlier steps on the way to `stepId` pay their rewards. Other start conditions (gold, a town
   * level) are not made true: the quest is simply entered.
   */
  testStart(questId: string, stepId: string): QuestEvent[] {
    const quest = this.quests.find((q) => q.id === questId);
    if (!quest || !findStep(quest, stepId)) return [];
    const trail = new Set([questId]);
    this.reachCondition(quest.start, trail);
    // A standing order's ask is played from its offer (decision 0214): the asks before it done.
    if (quest.repeat) {
      const n = quest.steps.findIndex((s) => s.id === stepId);
      if (n > 0) this.state.byId[questId] = { step: QUEST_DONE, counts: [], chose: {}, rounds: n };
      else delete this.state.byId[questId];
      this.seen = null;
      this.afterChange([]);
      return this.check();
    }
    const route = routeTo(quest, stepId) ?? [];
    const chose: Record<string, string> = {};
    for (const { step, option } of route) {
      this.pay(step.reward);
      this.pay(option?.reward);
      if (option) chose[step.id] = option.id;
    }
    this.state.byId[questId] = { step: stepId, counts: [], chose };
    const events: QuestEvent[] = [{ type: 'started', quest: questId }];
    this.enter(quest, findStep(quest, stepId)!, events);
    this.state.tracked = questId;
    this.seen = null;
    this.afterChange(events);
    return events;
  }

  /** Play-testing: the tracked quest's step counts as done (a choice takes its first option). */
  skipStep(): QuestEvent[] {
    const at = this.active.find((a) => a.quest.id === this.tracked);
    if (!at) return [];
    const option = at.step.choose?.[0];
    if (option) this.progress(at.quest.id)!.chose[at.step.id] = option.id;
    const events: QuestEvent[] = [];
    this.finishStep(at.quest, at.step, option, events);
    this.afterChange(events);
    return [...events, ...this.check()];
  }

  /** Play-testing: the tracked quest's step starts over (its numbers back to nothing). */
  restartStep(): QuestEvent[] {
    const at = this.active.find((a) => a.quest.id === this.tracked);
    if (!at) return [];
    const events: QuestEvent[] = [];
    this.enter(at.quest, at.step, events);
    this.seen = null;
    this.afterChange(events);
    return events;
  }

  /** Makes the quest conditions in `c` true by finishing or moving on the quests they name. */
  private reachCondition(c: Condition | undefined, trail: Set<string>) {
    if (!c) return;
    if (c.is === 'all') for (const m of c.of as Condition[]) this.reachCondition(m, trail);
    if (c.is === 'any') this.reachCondition((c.of as Condition[])[0], trail);
    const quest = this.quests.find((q) => q.id === c.quest);
    if (!quest || trail.has(quest.id) || this.isDone(quest.id)) return;
    if (c.is === 'quest-done') this.testFinish(quest, trail);
    if (c.is === 'chose') this.testFinish(quest, trail, c.option as string);
    if (c.is === 'quest-at' && findStep(quest, c.step as string)) {
      trail.add(quest.id);
      this.reachCondition(quest.start, trail);
      const chose: Record<string, string> = {};
      for (const { step, option } of routeTo(quest, c.step as string) ?? []) {
        this.pay(step.reward);
        this.pay(option?.reward);
        if (option) chose[step.id] = option.id;
      }
      const counts = new Array<number>(slotLayout(findStep(quest, c.step as string)!.goal).size);
      this.state.byId[quest.id] = { step: c.step as string, counts: counts.fill(0), chose };
    }
  }

  /** Finishes a quest at once, paying all its rewards, through `option` when one is named. */
  private testFinish(quest: QuestDef, trail: Set<string>, option?: string) {
    trail.add(quest.id);
    this.reachCondition(quest.start, trail);
    const chose: Record<string, string> = {};
    for (const at of routeTo(quest, QUEST_DONE, option) ?? []) {
      this.pay(at.step.reward);
      this.pay(at.option?.reward);
      if (at.option) chose[at.step.id] = at.option.id;
    }
    this.state.byId[quest.id] = { step: QUEST_DONE, counts: [], chose };
    this.pay(quest.reward);
    syncMarketLevels(this.trade, this.world.map);
  }
}
