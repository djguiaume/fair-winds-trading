import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import fr from '../src/i18n/fr.json';
import { PHASE1_MAP } from '../src/data/maps';
import { COACH_TARGETS, QUESTS, type QuestDef, checkQuests, questsFor } from '../src/sim/quests';
import { mainLine } from '../src/ui/questView';
import { TUTORIAL, tutorialVoyage } from './helpers/tutorial';

// Decision 0113 made the tutorial data; decision 0151 made it an ordinary quest file.
const shipped = QUESTS.find((q) => q.id === TUTORIAL)!;

describe('the tutorial as an ordinary quest (decision 0151)', () => {
  it('the shipped file is sound: a lesson, known coach marks, every text in both languages', () => {
    expect(shipped).toMatchObject({ start: { is: 'asked' }, text: 'lesson', lesson: true });
    expect(checkQuests(questsFor(PHASE1_MAP), PHASE1_MAP)).toEqual([]);
    // No lesson-only fields are left from the old format.
    for (const step of shipped.steps) {
      for (const key of ['on', 'mark', 'continue', 'action', 'picks', 'pointer', 'passenger'])
        expect(step, `${step.id}.${key}`).not.toHaveProperty(key);
      for (const surface of ['sea', 'chart', 'market'] as const) {
        const target = step.coach?.[surface];
        if (target) expect(COACH_TARGETS).toContain(target);
      }
      const keys = [
        `lesson.${step.id}.title`,
        `lesson.${step.id}.copy`,
        ...(step.choose ?? []).map((o) => `lesson.${step.id}.${o.id}.title`),
      ];
      for (const key of keys) for (const lang of [en, fr]) expect(lang, key).toHaveProperty([key]);
    }
    for (const key of ['lesson.done.title', 'lesson.done.copy', 'lesson.cargoBuyer'])
      for (const lang of [en, fr]) expect(lang, key).toHaveProperty([key]);
  });

  it('numbers the main line; the ways back are not numbered', () => {
    expect(mainLine(shipped)).toEqual([
      'sails',
      'wind',
      'foghorn',
      'wreck',
      'chart',
      'home-port',
      'home',
      'island',
      'buy',
      'choose-delivery',
      'deliver',
      'sell',
    ]);
  });

  it('a lesson removed from the file is skipped, with no code', () => {
    const edited = structuredClone(shipped) as QuestDef;
    edited.steps = edited.steps.filter((s) => s.id !== 'wind');
    edited.reward = { gold: 25 };
    expect(checkQuests([edited], PHASE1_MAP)).toEqual([]);
    const v = tutorialVoyage(PHASE1_MAP, [edited]);
    v.start();
    expect(v.step).toBe('sails');
    v.cont();
    expect(v.step).toBe('foghorn');
    v.rescue();
    v.course('saltmere');
    v.dock('saltmere');
    v.cont();
    expect(v.step).toBe('buy');
    // Finish it: the quest's reward is paid once.
    v.world.trade.captain.cargo.fish = 1;
    v.check();
    expect(v.step).toBe('choose-delivery');
    v.course('calda');
    v.world.trade.dockedAt = null;
    v.dock('calda');
    expect(v.step).toBe('sell');
    const gold = v.world.trade.captain.gold;
    v.world.trade.captain.cargo.fish = 0;
    v.check();
    expect(v.quests.isDone(TUTORIAL)).toBe(true);
    expect(v.world.trade.captain.gold).toBe(gold + 25);
  });
});
