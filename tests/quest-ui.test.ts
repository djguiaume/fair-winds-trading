// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { setLanguage } from '../src/i18n';
import { type QuestDef, QuestBook } from '../src/sim/quests';
import { SLOOP } from '../src/sim/ship';
import { homePort } from '../src/sim/shipyards';
import { TUTORIAL_QUEST } from '../src/sim/tutorial';
import { type World, createWorld } from '../src/sim/world';
import { QuestCard } from '../src/ui/questCard';
import { cardFor, dueCard, journal, questPins, questTarget } from '../src/ui/questView';
import pier from './fixtures/quests/test-pier.json';

// Decision 0124: what the quest card, the journal and the chart show, on a test quest given by
// Rook at Saltmere (no quest content ships yet, so its text keys fall back).
const ROOK: QuestDef = {
  ...(pier as unknown as QuestDef),
  giver: 'rook',
  offer: true,
  steps: (pier as unknown as QuestDef).steps.map((s, i) =>
    i === 0 ? { ...s, mood: 'worried' } : s,
  ),
};

function setup() {
  setLanguage('en');
  const world: World = createWorld(PHASE1_MAP, SLOOP);
  const book = new QuestBook(world, [ROOK], {
    doneElsewhere: (id) => id === TUTORIAL_QUEST.id,
    nightOk: () => false,
  });
  book.check();
  return { world, book, map: world.map };
}

describe('quest cards (decision 0124)', () => {
  it('offers the quest at its port only, with the giver, role and first step', () => {
    const { book, map } = setup();
    const none = new Set<string>();
    expect(dueCard(book, map, null, none, none)).toBeNull();
    expect(dueCard(book, map, 'westholm', none, none)).toBeNull();
    expect(dueCard(book, map, 'saltmere', none, none)).toEqual({
      quest: 'test-pier',
      kind: 'offer',
    });
    // "Not now" for this call.
    expect(dueCard(book, map, 'saltmere', new Set(['test-pier:offer']), none)).toBeNull();
    const card = cardFor(book, map, 'test-pier', 'offer')!;
    expect(card.giver?.id).toBe('rook');
    expect(card.role).toBe('Harbourmaster · Saltmere');
    expect(card.mood).toBe('worried');
    expect([card.stepNo, card.steps]).toEqual([1, 3]);
    expect(card.arc).toBe(ROOK.name);
    expect(card.good).toBe('timber');
  });

  it('shows each new step once, a choice with its options, and the thanks pleased', () => {
    const { book, map, world } = setup();
    const seen = new Set<string>(['test-pier:timber']);
    const thanks = new Set<string>();
    book.accept('test-pier');
    expect(dueCard(book, map, 'saltmere', seen, thanks)).toBeNull();
    book.progress('test-pier')!.counts[0] = 3;
    expect(cardFor(book, map, 'test-pier', 'step')!.progress).toBe('3 / 5');
    book.progress('test-pier')!.counts[0] = 5;
    book.check();
    // The next step (dock at home) has no port of its own: its card shows at the quest's port,
    // where the timber was just handed over.
    expect(dueCard(book, map, null, seen, thanks)).toBeNull();
    expect(dueCard(book, map, 'saltmere', seen, thanks)).toEqual({
      quest: 'test-pier',
      kind: 'step',
    });
    seen.add('test-pier:visit');
    world.trade.dockedAt = homePort(map).id;
    book.check();
    expect(dueCard(book, map, 'saltmere', seen, thanks)).toEqual({
      quest: 'test-pier',
      kind: 'choice',
    });
    const choice = cardFor(book, map, 'test-pier', 'choice')!;
    expect(choice.options?.map((o) => o.id)).toEqual(['workshop', 'rigging-loft']);
    seen.add('test-pier:build');
    book.choose('test-pier', 'workshop');
    thanks.add('test-pier');
    // The thanks wait for the quest's port.
    expect(dueCard(book, map, 'westholm', seen, thanks)).toBeNull();
    expect(dueCard(book, map, 'saltmere', seen, thanks)).toEqual({
      quest: 'test-pier',
      kind: 'finished',
    });
    expect(cardFor(book, map, 'test-pier', 'finished')!.mood).toBe('pleased');
  });
});

describe('journal and chart (decision 0124)', () => {
  it('lists the tracked quest with its steps, and offers and finished quests below', () => {
    const { book, map, world } = setup();
    expect(journal(book, map).map((e) => e.state)).toEqual(['offered']);
    expect(questPins(book, map, new Set())).toEqual([
      expect.objectContaining({ port: 'saltmere', alert: true, tracked: false }),
    ]);
    book.accept('test-pier');
    book.progress('test-pier')!.counts[0] = 2;
    const [tracked] = journal(book, map);
    expect(tracked).toMatchObject({
      state: 'tracked',
      who: 'Rook · Saltmere',
      stepNo: 1,
      steps: 3,
    });
    expect(tracked!.lines.map((l) => l.state)).toEqual(['now', 'later']);
    expect(tracked!.lines[0]!.progress).toBe('2 / 5');
    expect(questTarget(book, map)).toEqual({ port: 'saltmere' });
    expect(questPins(book, map, new Set(['test-pier:timber']))).toEqual([
      expect.objectContaining({ alert: false, tracked: true }),
    ]);
    book.progress('test-pier')!.counts[0] = 5;
    world.trade.dockedAt = homePort(map).id;
    book.check();
    book.choose('test-pier', 'rigging-loft');
    const done = journal(book, map).find((e) => e.quest === 'test-pier')!;
    expect(done.state).toBe('done');
    expect(done.chose).toEqual(['rigging-loft']);
  });
});

describe('QuestCard', () => {
  it('draws the card and answers with the button pressed', () => {
    const { book, map } = setup();
    const dialog = document.createElement('dialog');
    document.body.append(dialog);
    dialog.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    dialog.close ??= function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
    const card = new QuestCard(dialog);
    const accept = vi.fn();
    card.onAccept = accept;
    card.show(cardFor(book, map, 'test-pier', 'offer')!);
    expect(dialog.querySelector('.quest-face svg')).not.toBeNull();
    expect(dialog.querySelector('h2')!.textContent).toBe('Rook');
    expect(dialog.querySelectorAll('.quest-pips i.on')).toHaveLength(1);
    dialog.querySelector<HTMLButtonElement>('[data-act="accept"]')!.click();
    expect(accept).toHaveBeenCalledWith('test-pier');
    expect(card.isOpen).toBe(false);
  });
});

describe('stepProgress', () => {
  it('counts goods handed over, quest cargo delivered and markers reached', async () => {
    const { stepProgress } = await import('../src/ui/questView');
    expect(stepProgress({ is: 'delivered', qty: 12 }, [4])).toBe('4 / 12');
    expect(stepProgress({ is: 'carried', qty: 2 }, [1, 1])).toBe('1 / 2');
    const points = [{}, {}, {}];
    expect(stepProgress({ is: 'reach', points }, [0b101])).toBe('2 / 3');
    expect(stepProgress({ is: 'reach', points, order: 'in-order' }, [1])).toBe('1 / 3');
    expect(stepProgress({ is: 'docked', port: 'calda' }, [])).toBeUndefined();
  });
});
