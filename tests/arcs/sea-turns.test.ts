import { describe, expect, it } from 'vitest';
import { grownMap } from '../../src/data/grownMap';
import { PHASE1_SOURCE, prepareMap } from '../../src/data/maps';
import { setLanguage, tOptional } from '../../src/i18n';
import { insideOutline } from '../../src/sim/flowShapes';
import type { Condition, QuestSpot } from '../../src/sim/questLibrary';
import { QUESTS, QuestBook } from '../../src/sim/quests';
import { SLOOP } from '../../src/sim/ship';
import { type World, createWorld } from '../../src/sim/world';
import { cardFor } from '../../src/ui/questView';

// Issue #359: each far sea's own hazard is a step of its keeper's arc. Wren sends the captain into
// it for a washed-up oddity, carried back to the keeper. The outposts are founded in one card,
// with the settler's sibling from the ring aboard for the reunion.
const MAP = prepareMap(grownMap(PHASE1_SOURCE));

/** Quest, step, the hazard it happens in (a wind zone or a berg field), and the oddity. */
const TURNS = [
  { quest: 'sunreach-tea', step: 'glass', hazard: 'the-glass', item: 'sealed-bottle' },
  { quest: 'fogwatch-amber', step: 'lull', hazard: 'stormbreak', item: 'carved-plank' },
  { quest: 'rimewick-jam', step: 'calving', hazard: 'calving-grounds', item: 'tin-box' },
  { quest: 'emberhold-glass', step: 'ash', hazard: 'ashfall-reach', item: 'brass-compass' },
];

/** Outpost, its settler and the sibling who comes along, and where each boards. */
const OUTPOSTS = [
  { quest: 'outpost-south', settler: ['tam', 'watchman-key'], sibling: ['ness', 'watchman-key'] },
  { quest: 'outpost-west', settler: ['oskar', 'emberhold'], sibling: ['ines', 'calda'] },
  { quest: 'outpost-north', settler: ['nell', 'rimewick'], sibling: ['kit', 'saltmere'] },
  { quest: 'outpost-east', settler: ['pip', 'fogwatch'], sibling: ['maren', 'westholm'] },
];

const quest = (id: string) => QUESTS.find((q) => q.id === id)!;

function hazardOutline(id: string): [number, number][] {
  const zone = MAP.windZones?.find((z) => z.id === id);
  const field = MAP.terrain?.find((t) => t.id === id);
  return (zone?.outline ?? field?.outline) as [number, number][];
}

/** A voyage with the turn's quest at its turn step, the steps before it sailed. */
function atTurn(questId: string, stepId: string) {
  setLanguage('en');
  const world: World = createWorld(MAP, SLOOP);
  const book = new QuestBook(world, QUESTS, { nightOk: () => false });
  book.testStart(questId, stepId);
  return { world, book };
}

function hold(world: World, book: QuestBook, at: { x: number; y: number }, kn: number) {
  world.trade.dockedAt = null;
  Object.assign(world.boat, { x: at.x, y: at.y, speedKn: kn });
  for (let t = 0; t < 4; t += 0.25) book.check(0.25);
}

function dock(world: World, book: QuestBook, port: string) {
  world.trade.dockedAt = port;
  book.check();
}

describe('the far seas’ turns (#359)', () => {
  it.each(TURNS)('$quest › $step: Wren sends her into $hazard for the $item', (turn) => {
    const def = quest(turn.quest);
    const step = def.steps.find((s) => s.id === turn.step)!;
    expect(step.speaker).toBe('wren');
    const goal = step.goal as Condition & { from: QuestSpot; to: string };
    expect(goal).toMatchObject({ is: 'carried', item: turn.item, qty: 1, to: def.port });
    expect(def.items?.[turn.item]).toEqual({ space: 1 });
    expect(insideOutline(goal.from.x, goal.from.y, hazardOutline(turn.hazard))).toBe(true);
    for (const lang of ['en', 'fr'] as const) {
      setLanguage(lang);
      for (const form of ['one', 'many', 'the', 'own', 'unloadedOne', 'unloadedMany'])
        expect(tOptional(`quest.item.${turn.item}.${form}`), `${lang} ${form}`).toBeTruthy();
    }
  });

  it.each(TURNS)('$quest › $step plays: slow at the spot, then alongside the keeper', (turn) => {
    const { world, book } = atTurn(turn.quest, turn.step);
    const def = quest(turn.quest);
    const from = def.steps.find((s) => s.id === turn.step)!.goal!.from as QuestSpot;
    expect(cardFor(book, world.map, turn.quest, 'step')!.giver?.id).toBe('wren');
    // Too fast: nothing is picked up, and docking with nothing aboard does not finish it.
    hold(world, book, from, 6);
    dock(world, book, def.port!);
    expect(book.progress(turn.quest)!.step).toBe(turn.step);
    hold(world, book, from, 2);
    dock(world, book, def.port!);
    expect(book.progress(turn.quest)!.step).not.toBe(turn.step);
  });

  it.each(OUTPOSTS)('$quest is one card: supplies, settler and sibling', (o) => {
    const def = quest(o.quest);
    expect(def.steps.map((s) => s.id)).toEqual(['settler']);
    expect(def.doneSpeaker).toBe(o.settler[0]);
    const parts = def.steps[0]!.goal!.of as Condition[];
    const carried = parts.filter((p) => p.is === 'carried').map((p) => [p.item, p.from]);
    expect(carried).toEqual([o.settler, o.sibling]);
    expect(parts.some((p) => p.is === 'landed')).toBe(true);
  });

  it('closes each outpost’s done card differently', () => {
    setLanguage('en');
    const closers = OUTPOSTS.map((o) => tOptional(`quest.${o.quest}.done.copy`)!);
    expect(closers.every((c) => !c.includes('Rook will want that in the book'))).toBe(true);
    expect(new Set(closers.map((c) => c.split('. ').at(-1))).size).toBe(OUTPOSTS.length);
  });
});
