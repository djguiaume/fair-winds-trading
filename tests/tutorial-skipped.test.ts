import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { QUESTS, checkQuests, readQuests, type QuestDef } from '../src/sim/quests';
import { TUTORIAL, tutorialVoyage } from './helpers/tutorial';

// Skipping the tutorial skips its lessons, not its story (decision 0160).
describe('the tutorial without its coach', () => {
  const story = (v: ReturnType<typeof tutorialVoyage>) => {
    const seen: string[] = [];
    v.quests.onEvent = (e) => {
      if (e.quest === TUTORIAL && e.type === 'step') seen.push(e.step);
    };
    return seen;
  };

  it('plays the rescue and Rook’s ride home, then Rook’s thanks, without a bubble', () => {
    const v = tutorialVoyage();
    v.start();
    const seen = story(v);
    v.quests.coachOff(TUTORIAL);
    expect(v.step).toBe('foghorn');
    expect(v.lesson).toBeNull();
    expect(v.quests.trackedStep?.compass).toBe('wreck');
    v.rescue();
    // No course to set: Rook simply wants to go home.
    expect(v.step).toBe('home');
    v.check();
    expect(v.step).toBe('home');
    v.dock('saltmere');
    expect(v.quests.isDone(TUTORIAL)).toBe(true);
    expect(seen).toEqual(['foghorn', 'wreck', 'home']);
    // Rook's thanks follows as it does after the tutorial, with the island.
    expect(v.quests.progress('rooks-thanks')).toBeDefined();
  });

  it('Skip during a lesson goes on with the story from there', () => {
    const v = tutorialVoyage();
    v.start();
    expect(v.step).toBe('sails');
    v.quests.coachOff(TUTORIAL);
    expect(v.step).toBe('foghorn');

    const after = tutorialVoyage();
    after.rescue();
    expect(after.step).toBe('chart');
    after.quests.coachOff(TUTORIAL);
    expect(after.step).toBe('home');

    const trading = tutorialVoyage();
    trading.reachMarket();
    expect(trading.step).toBe('buy');
    trading.quests.coachOff(TUTORIAL);
    expect(trading.quests.isDone(TUTORIAL)).toBe(true);
  });

  it('asked again, the tutorial speaks from its first lesson', () => {
    const v = tutorialVoyage();
    v.start();
    v.quests.coachOff(TUTORIAL);
    expect(v.quests.isCoached(TUTORIAL)).toBe(false);
    v.start();
    expect(v.quests.isCoached(TUTORIAL)).toBe(true);
    expect(v.step).toBe('sails');
    expect(v.lesson?.step).toBe('sails');
  });

  it('is kept in the save, and old saves without it still load coached', () => {
    const v = tutorialVoyage();
    v.start();
    v.quests.coachOff(TUTORIAL);
    const saved = JSON.parse(JSON.stringify(v.world.trade.quests));
    expect(readQuests(saved, PHASE1_MAP).uncoached).toEqual([TUTORIAL]);
    delete saved.uncoached;
    expect(readQuests(saved, PHASE1_MAP).uncoached).toBeUndefined();
    expect(
      readQuests({ ...saved, uncoached: ['nope', 'rooks-thanks'] }, PHASE1_MAP).uncoached,
    ).toBeUndefined();
  });

  it('only a lesson has teach steps, and a lesson keeps a story step', () => {
    const tutorial = QUESTS.find((q) => q.id === TUTORIAL)!;
    expect(tutorial.steps.filter((s) => !s.teach).map((s) => s.id)).toEqual([
      'foghorn',
      'wreck',
      'home',
    ]);
    const errand: QuestDef = {
      id: 'errand',
      name: 'Errand',
      start: { is: 'asked' },
      text: 'quest.errand',
      steps: [{ id: 'a', teach: true, goal: { is: 'docked' } }],
    };
    expect(checkQuests([errand], PHASE1_MAP).join('\n')).toContain('only a lesson has teach steps');
    expect(checkQuests([{ ...errand, lesson: true }], PHASE1_MAP).join('\n')).toContain(
      'a lesson needs a step that is not teach',
    );
  });
});
