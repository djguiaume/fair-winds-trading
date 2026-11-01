// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

// Decision 0113: a difficulty level or a town level added to its file exists everywhere, no code.
vi.mock('../src/data/tuning/difficulty.json', async (importOriginal) => {
  const file = (
    (await importOriginal()) as {
      default: { levels: Record<string, Record<string, unknown>> } & Record<string, unknown>;
    }
  ).default;
  const storm = {
    ...file.levels.salt,
    name: 'Storm petrel',
    tag: 'Gales all the way',
    startGold: 60,
  };
  return { default: { ...file, levels: { ...file.levels, storm } } };
});
vi.mock('../src/data/town-levels.json', async (importOriginal) => {
  const file = ((await importOriginal()) as { default: { levels: object[] } }).default;
  return { default: { ...file, levels: [...file.levels, { name: 'City' }] } };
});
vi.mock('../src/data/tuning/economy.json', async (importOriginal) => {
  const file = (
    (await importOriginal()) as {
      default: { towns: Record<string, unknown> } & Record<string, unknown>;
    }
  ).default;
  const towns = file.towns as {
    growthToLevel: Record<string, number>;
    wantsEquilibrium: number[];
    producesEquilibrium: number[];
    orderScale: number[];
  };
  return {
    default: {
      ...file,
      towns: {
        ...towns,
        growthToLevel: { ...towns.growthToLevel, 5: 600 },
        wantsEquilibrium: [...towns.wantsEquilibrium, 6],
        producesEquilibrium: [...towns.producesEquilibrium, 145],
        orderScale: [...towns.orderScale, 1.75],
      },
    },
  };
});

const { DIFFICULTIES, isDifficulty, knobs, easier } = await import('../src/sim/difficulty');
const { MAX_SETTLEMENT_LEVEL, SETTLEMENT_LEVELS, growthNeeded, addGrowth, stepSettlements } =
  await import('../src/sim/settlement');
const { townLevelName } = await import('../src/i18n');
const { levelCards } = await import('../src/ui/levelCards');
const { PHASE1_MAP } = await import('../src/data/maps');
const { SLOOP } = await import('../src/sim/ship');
const { createWorld } = await import('../src/sim/world');
const { startVoyage } = await import('../src/sim/trade');
const { serializeWorld, validateSave } = await import('../src/sim/save');

describe('levels added in data files only (decision 0113)', () => {
  it('a fourth difficulty level is a level: listed last, played, saved and shown', () => {
    expect(DIFFICULTIES).toEqual(['fair', 'captain', 'salt', 'storm']);
    expect(isDifficulty('storm')).toBe(true);
    expect(easier('storm', 'salt')).toBe('salt');
    const world = createWorld(PHASE1_MAP, SLOOP);
    startVoyage(world.trade, 'storm');
    expect(world.trade.captain.gold).toBe(60);
    expect(knobs(world.trade.difficulty).startGold).toBe(60);
    const back = validateSave(JSON.parse(JSON.stringify(serializeWorld(world))), world);
    expect(back!.difficulty).toBe('storm');

    const card = levelCards(() => {}).cards.find((c) => c.dataset.level === 'storm')!;
    // Not translated yet: the file's name and pitch.
    expect(card.querySelector('.ui-card-title')!.textContent).toBe('Storm petrel');
    expect(card.querySelector('.ui-card-text')!.textContent).toBe('Gales all the way');
    expect(card.querySelectorAll('.level-waves use')).toHaveLength(3);
  });

  it('a fifth town level is a level: towns grow into it and it has a name', () => {
    expect(MAX_SETTLEMENT_LEVEL).toBe(5);
    expect(SETTLEMENT_LEVELS).toEqual([1, 2, 3, 4, 5]);
    expect(growthNeeded(4)).toBe(600);
    expect(growthNeeded(5)).toBeNull();
    expect(townLevelName(4)).toBe('Port town');
    expect(townLevelName(5)).toBe('City');
    const world = createWorld(PHASE1_MAP, SLOOP);
    const s = world.trade.settlements.byPort.saltmere!;
    s.level = 4;
    s.rare = 20; // past the rare-goods gate, which now holds the step into level 5
    addGrowth(world.trade, 'saltmere', 600);
    const ups = stepSettlements(world.trade, 0.1, PHASE1_MAP);
    expect(ups).toEqual([{ type: 'level-up', portId: 'saltmere', level: 5 }]);
  });
});
