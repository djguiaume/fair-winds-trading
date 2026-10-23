import { describe, expect, it, vi } from 'vitest';
import en from '../src/i18n/en.json';
import fr from '../src/i18n/fr.json';

// Decision 0111: the tutorial is the first quest; its lessons are the steps of src/data/quests/first-voyage.json. This test drops
// the wind lesson from the file only: the sails lesson then leads straight to docking.
vi.mock('../src/data/quests/first-voyage.json', async (importOriginal) => {
  const file = (
    (await importOriginal()) as {
      default: { steps: { id: string; on: Record<string, string> }[] } & Record<string, unknown>;
    }
  ).default;
  const steps = structuredClone(file.steps.filter((s) => s.id !== 'wind'));
  const sails = steps.find((s) => s.id === 'sails')!;
  sails.on = { ...sails.on, 'sails-practised': 'dock', continue: 'dock' };
  return { default: { ...file, reward: { gold: 25 }, steps } };
});

const { TUTORIAL, TUTORIAL_DONE, TUTORIAL_EVENTS, TUTORIAL_STEPS, Tutorial } =
  await import('../src/sim/tutorial');
const { PHASE1_MAP } = await import('../src/data/maps');
const { SLOOP } = await import('../src/sim/ship');
const { createWorld } = await import('../src/sim/world');
type StepFile = { id: string; on: Record<string, string>; coach: Record<string, string> };
const shipped = (
  (await vi.importActual('../src/data/quests/first-voyage.json')) as {
    default: { id: string; start: string; text: string; reward: object; steps: StepFile[] };
  }
).default;

const COACH = [
  'chart-button',
  'sail-lever',
  'wind-compass',
  'port-marker',
  'dock-button',
  'chart-port',
  'close-chart',
  'buy-button',
  'sell-button',
];

describe('tutorial steps as data (decision 0111)', () => {
  it('the shipped file is sound: known events and targets, every lesson has its text', () => {
    expect(shipped).toMatchObject({ id: 'first-voyage', start: 'offered', text: 'lesson' });
    expect(shipped.reward).toEqual({ gold: 0 });
    const ids = shipped.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const step of shipped.steps) {
      for (const [event, to] of Object.entries(step.on)) {
        expect(TUTORIAL_EVENTS as readonly string[], `${step.id}: ${event}`).toContain(event);
        expect([...ids, TUTORIAL_DONE], `${step.id}: ${event} → ${to}`).toContain(to);
      }
      for (const target of Object.values(step.coach)) expect(COACH).toContain(target);
      const keys = ['title', 'copy', ...('continue' in step ? ['continue'] : [])];
      for (const part of keys)
        for (const lang of [en, fr])
          expect(lang, `lesson.${step.id}.${part}`).toHaveProperty([`lesson.${step.id}.${part}`]);
    }
    // Some step finishes the tutorial, and every step but the first can be reached.
    const targets = new Set(shipped.steps.flatMap((s) => Object.values(s.on)));
    expect(targets).toContain(TUTORIAL_DONE);
    for (const id of ids.slice(1)) expect(targets, id).toContain(id);
  });

  it('a lesson removed from the file is skipped, with no code', () => {
    expect(TUTORIAL_STEPS).not.toContain('wind');
    expect(TUTORIAL).toHaveLength(shipped.steps.length - 1);
    const world = createWorld(PHASE1_MAP, SLOOP);
    const harbours = Object.fromEntries(PHASE1_MAP.ports.map((p) => [p.id, { x: 0, y: 0 }]));
    const tutorial = new Tutorial(world, harbours, null);
    tutorial.start();
    tutorial.chartOpened();
    world.destination = { portId: 'calda', label: 'Calda', x: 0, y: 0 };
    tutorial.destinationSelected();
    expect(tutorial.step).toBe('sails');
    tutorial.continueLesson();
    expect(tutorial.step).toBe('dock');
    world.trade.dockedAt = 'calda';
    tutorial.observe();
    expect(tutorial.step).toBe('buy');
    // Finish it: the quest's reward is paid once.
    const good = PHASE1_MAP.ports.find((p) => p.id === 'calda')!.produces[0]!;
    world.trade.captain.cargo[good] = 1;
    tutorial.traded('buy', good);
    const buyer = PHASE1_MAP.ports.find((p) => p.id !== 'calda' && p.wants.includes(good))!;
    world.destination = { portId: buyer.id, label: buyer.name, x: 0, y: 0 };
    tutorial.destinationSelected();
    world.trade.dockedAt = buyer.id;
    tutorial.observe();
    expect(tutorial.step).toBe('sell');
    const gold = world.trade.captain.gold;
    world.trade.captain.cargo[good] = 0;
    tutorial.traded('sell', good);
    expect(tutorial.status).toBe('completed');
    expect(world.trade.captain.gold).toBe(gold + 25);
  });
});
