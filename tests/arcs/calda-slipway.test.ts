import { describe, expect, it } from 'vitest';
import { ISLAND_DESIGNS, islandDesign, questDesign, questShown } from '../../src/data/islands';
import { PHASE1_MAP } from '../../src/data/maps';
import { coastDistance } from '../../src/sim/coast';
import { islandCoasts } from '../../src/sim/islandLayout';
import { QUESTS, QuestBook, checkQuestHooks, checkQuests, questsFor } from '../../src/sim/quests';
import { producesAt } from '../../src/sim/settlement';
import { SLOOP } from '../../src/sim/ship';
import { sell } from '../../src/sim/trade';
import { createWorld } from '../../src/sim/world';
import { cardFor, questTarget } from '../../src/ui/questView';

// Decision 0131 and the storyteller brief (0129): "The last keel", Ines Calder's arc at Port Calda.

const ARC = QUESTS.find((q) => q.id === 'calda-slipway')!;
const mast = ARC.steps.find((s) => s.id === 'mast')!.goal!;
const landing = mast.from as { x: number; y: number; within: number };

function play() {
  const world = createWorld(PHASE1_MAP, SLOOP);
  world.trade.captain.gold = 10_000;
  const quests = new QuestBook(world, QUESTS, {
    doneElsewhere: (id) => id === 'first-voyage',
    nightOk: () => true,
  });
  return { world, quests };
}

/** At (x, y) at `kn` knots, with `sec` seconds of checks. */
function hold(p: ReturnType<typeof play>, x: number, y: number, kn: number, sec: number) {
  p.world.trade.dockedAt = null;
  p.world.boat.x = x;
  p.world.boat.y = y;
  p.world.boat.speedKn = kn;
  for (let t = 0; t < sec - 1e-9; t += 0.25) p.quests.check(0.25);
}

function dock(p: ReturnType<typeof play>, port: string) {
  p.world.trade.dockedAt = port;
  p.quests.check(0.25);
}

describe('arc: calda-slipway, "The last keel"', () => {
  it('passes the checks and follows the brief', () => {
    expect(checkQuests(questsFor(PHASE1_MAP), PHASE1_MAP)).toEqual([]);
    expect(checkQuestHooks(PHASE1_MAP, Object.values(ISLAND_DESIGNS), QUESTS)).toEqual([]);
    expect(ARC).toMatchObject({
      giver: 'ines',
      port: 'calda',
      offer: true,
      text: 'quest.calda-slipway',
      start: { is: 'quest-at', quest: 'rooks-thanks', step: 'skerry' },
      reward: { homeSpot: ['spot-1'] },
    });
    expect(ARC.steps.map((s) => s.id)).toEqual(['stone', 'mast', 'launch']);
    expect(ARC.items).toEqual({ 'mast-tree': { space: 8 }, rook: { space: 0 } });
    expect(ARC.steps.map((s) => s.reward?.gold)).toEqual([100, 150, 250]);
  });

  it('lands the mast on open water just off Greyback Ridge, clear of reefs', () => {
    const ridge = PHASE1_MAP.islands.find((i) => i.id === 'greyback-ridge')!;
    const shore = Math.min(
      ...islandCoasts(ridge)!.map((c) => coastDistance(landing.x, landing.y, c).distance),
    );
    // Outside the coast, close enough that the circle reaches near the shore.
    expect(shore).toBeGreaterThan(4);
    expect(shore).toBeLessThan(landing.within + 4);
    for (const t of PHASE1_MAP.terrain ?? [])
      expect(coastDistance(landing.x, landing.y, t.outline).distance).toBeGreaterThan(
        landing.within,
      );
  });

  it('plays through on the engine in a sloop', () => {
    const p = play();
    const { world, quests } = p;
    dock(p, 'saltmere');
    dock(p, 'calda');
    expect(quests.offered.map((q) => q.id)).toContain('calda-slipway');
    expect(cardFor(quests, PHASE1_MAP, 'calda-slipway', 'offer')).toMatchObject({
      mood: 'worried',
      ask: 'Bring 8 stone to Port Calda',
    });
    quests.accept('calda-slipway');
    quests.track('calda-slipway');

    // Stone: eight sold at Port Calda.
    world.trade.captain.cargo.stone = 8;
    dock(p, 'calda');
    expect(sell(world.trade, 'stone', 8, PHASE1_MAP).ok).toBe(true);
    dock(p, 'calda');
    expect(quests.progress('calda-slipway')!.step).toBe('mast');

    // The mast: too fast at the landing loads nothing; slow for three seconds loads it.
    expect(questTarget(quests, PHASE1_MAP)).toEqual({
      point: { x: landing.x, y: landing.y },
      radius: landing.within,
    });
    hold(p, landing.x, landing.y, 4, 5);
    expect(quests.progress('calda-slipway')!.counts[0]).toBe(0);
    hold(p, landing.x, landing.y, 1.5, 3);
    expect(quests.progress('calda-slipway')!.counts[0]).toBe(1);
    expect(questTarget(quests, PHASE1_MAP)).toEqual({ port: 'calda' });
    dock(p, 'calda');
    expect(quests.progress('calda-slipway')!.step).toBe('launch');

    // Launch: Rook from Saltmere to Port Calda within par.
    dock(p, 'saltmere');
    hold(p, 285, -100, 6, 50);
    dock(p, 'calda');
    expect(quests.progress('calda-slipway')!.step).toBe('done');
    expect(world.trade.home.islands.skerry?.offered).toContain('spot-1');
  });

  it('starts the mast over after touching a shore on the way', () => {
    const p = play();
    p.world.trade.quests.byId['calda-slipway'] = { step: 'mast', counts: [0, 0, 0], chose: {} };
    p.quests.check();
    hold(p, landing.x, landing.y, 1, 3);
    expect(p.quests.progress('calda-slipway')!.counts[0]).toBe(1);
    p.world.trade.captain.hullDamage.sloop = 5;
    p.quests.check(0.25);
    expect(p.quests.progress('calda-slipway')!.counts).toEqual([0, 0, 0]);
  });

  it('every card has its text in both languages', async () => {
    const en = (await import('../../src/i18n/en.json')).default as Record<string, string>;
    const fr = (await import('../../src/i18n/fr.json')).default as Record<string, string>;
    const keys = [
      'name',
      ...ARC.steps.flatMap((s) => [`${s.id}.title`, `${s.id}.copy`]),
      'done.title',
      'done.copy',
    ].map((k) => `quest.calda-slipway.${k}`);
    for (const k of keys) {
      expect(en[k], k).toBeTruthy();
      expect(fr[k], k).toBeTruthy();
    }
    for (const k of keys.filter((k) => k.endsWith('.copy'))) {
      expect(en[k]!.length, k).toBeLessThanOrEqual(220);
      expect(fr[k]!.length, k).toBeLessThanOrEqual(264);
    }
  });

  it('changes Port Calda once done: slipway with a hull, the pilot cutter, planks from level 2', () => {
    const before = new Set<string>();
    const after = new Set(['calda-slipway']);
    const types = (done: Set<string>) =>
      questDesign(islandDesign('calda'), done)
        .props.filter((p) => p.type.startsWith('slipway'))
        .map((p) => `${p.type}@${p.from ?? 1}-${p.to ?? 4}`);
    expect(types(before)).toEqual(['slipway@1-4']);
    expect(types(after)).toEqual(['slipway-hull@1-4']);
    const cutter = PHASE1_MAP.marks!.find((m) => m.type === 'pilot-cutter')!;
    expect(questShown(cutter, before)).toBe(false);
    expect(questShown(cutter, after)).toBe(true);

    const p = play();
    p.world.trade.settlements.byPort.calda!.level = 2;
    expect(producesAt(PHASE1_MAP, p.world.trade, 'calda')).toEqual(['timber']);
    p.world.trade.quests.byId['calda-slipway'] = { step: 'done', counts: [], chose: {} };
    expect(producesAt(PHASE1_MAP, p.world.trade, 'calda')).toEqual(['timber', 'planks']);
  });
});
