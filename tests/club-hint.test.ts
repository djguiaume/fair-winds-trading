// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { GAME_MAP } from '../src/data/maps';
import { setLanguage } from '../src/i18n';
import { QUESTS, QUEST_DONE, QuestBook } from '../src/sim/quests';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';
import { cardFor, quayItems } from '../src/ui/questView';

// Decision 0227: the racer café at Abbey Head. Right after the prologue Rook points to the club,
// the ring races open, and every race is offered on Abbey Head's Quay.

const RING = ['race-gap', 'race-calda', 'race-greyback'];

function afterPrologue(done = false) {
  setLanguage('en');
  const world = createWorld(GAME_MAP, SLOOP);
  if (done) world.trade.quests.byId['rooks-thanks'] = { step: QUEST_DONE, counts: [], chose: {} };
  const book = new QuestBook(world, QUESTS);
  book.check();
  return { world, book };
}

describe('the club at Abbey Head', () => {
  it("opens the ring races and Rook's hint only once the prologue is done", () => {
    const before = afterPrologue();
    expect(before.book.offered.map((q) => q.id)).not.toContain('race-gap');
    expect(before.book.isRunning('club-hint')).toBe(false);

    const { book } = afterPrologue(true);
    expect(book.offered.map((q) => q.id)).toEqual(expect.arrayContaining(RING));
    expect(book.isRunning('club-hint')).toBe(true);
  });

  it('keeps the sea races and the Cup behind their gates', () => {
    const { book } = afterPrologue(true);
    const offered = book.offered.map((q) => q.id);
    for (const id of ['race-narrows', 'race-smoulder', 'race-floe', 'race-stormbreak'])
      expect(offered).not.toContain(id);
  });

  it('offers every race on the Abbey Head Quay, none at Saltmere', () => {
    const { book } = afterPrologue(true);
    const at = (port: string) =>
      quayItems(book, GAME_MAP, port, new Set(), new Set()).map((i) => i.key);
    expect(at('abbey-head')).toEqual(expect.arrayContaining(RING.map((id) => `${id}:offer`)));
    expect(at('saltmere')).not.toContain('race-gap:offer');
  });

  it("puts Rook's line on the way and Wren's welcome on the done card", () => {
    const { book } = afterPrologue(true);
    const hint = cardFor(book, GAME_MAP, 'club-hint', 'step');
    expect(hint?.giver?.id).toBe('rook');
    expect(hint?.speech).toContain('Abbey Head');
    const arrive = cardFor(book, GAME_MAP, 'club-hint', 'finished');
    expect(arrive?.giver?.id).toBe('wren');
  });
});
