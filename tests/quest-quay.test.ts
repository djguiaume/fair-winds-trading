// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { setLanguage } from '../src/i18n';
import { QUESTS, type QuestDef, QuestBook, checkQuests, readQuests } from '../src/sim/quests';
import { SLOOP } from '../src/sim/ship';
import { type World, createWorld } from '../src/sim/world';
import { QuestCard } from '../src/ui/questCard';
import { cardFor, dueCard, journal, quayItems } from '../src/ui/questView';
import { TradePanel } from '../src/ui/tradePanel';
import pier from './fixtures/quests/test-pier.json';

// Decision 0141: main quests greet the captain on arrival; every other quest speaks on the
// harbour screen's Quay tab, never pops up, and can be ignored.
const OFFER: QuestDef = { ...(pier as unknown as QuestDef), giver: 'kit', offer: true };
const MAIN: QuestDef = {
  ...(pier as unknown as QuestDef),
  id: 'test-main',
  giver: 'rook',
  main: true,
};

function setup(quests: QuestDef[] = [OFFER, MAIN]) {
  setLanguage('en');
  const world: World = createWorld(PHASE1_MAP, SLOOP);
  const book = new QuestBook(world, quests, {
    doneElsewhere: (id) => id === 'first-voyage',
    nightOk: () => false,
  });
  book.check();
  return { world, book, map: world.map };
}

function fakeDialog(): HTMLDialogElement {
  const dialog = document.createElement('dialog');
  document.body.append(dialog);
  dialog.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  dialog.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  return dialog;
}

describe('main quests and the Quay tab (decision 0141)', () => {
  it('marks the story quests main, and checks the flag', () => {
    expect(QUESTS.filter((q) => q.main).map((q) => q.id)).toEqual([
      'fair-winds',
      'four-winds',
      'rooks-thanks',
    ]);
    expect(QUESTS.filter((q) => q.main && q.offer)).toEqual([]);
    expect(checkQuests([{ ...MAIN, main: 'yes' as unknown as boolean }], PHASE1_MAP)).toContain(
      'quest test-main: main is true or false',
    );
    expect(checkQuests([{ ...MAIN, offer: true }], PHASE1_MAP).join()).toContain(
      'a main quest is not offered',
    );
  });

  it('pops up only main quests; the others wait on the Quay tab', () => {
    const { book, map } = setup();
    const none = new Set<string>();
    const main = (q: QuestDef) => !!q.main;
    expect(dueCard(book, map, 'saltmere', none, none, main)).toEqual({
      quest: 'test-main',
      kind: 'step',
    });
    book.accept('test-pier');
    const seen = new Set(['test-main:timber']);
    expect(dueCard(book, map, 'saltmere', seen, none, main)).toBeNull();
    const quay = quayItems(book, map, 'saltmere', new Set(), new Set());
    expect(quay.map((i) => [i.key, i.card.kind, i.fresh])).toEqual([
      ['test-pier:timber', 'step', true],
    ]);
    expect(quayItems(book, map, 'westholm', new Set(), new Set())).toEqual([]);
    expect(quayItems(book, map, null, new Set(), new Set())).toEqual([]);
  });

  it('says what kind of card it is, where the ask happens and what it pays', () => {
    const { book, map } = setup([OFFER]);
    const offer = cardFor(book, map, 'test-pier', 'offer')!;
    expect(offer.main).toBe(false);
    expect(offer.reward).toEqual({ gold: 100, more: [] });
    expect(offer.moreSteps).toBe(2);
    const dialog = fakeDialog();
    const card = new QuestCard(dialog);
    card.show(offer);
    expect(dialog.querySelector('.quest-tag')!.textContent).toBe('New job');
    expect(dialog.querySelector('.quest-reward')!.textContent).toContain('then 2 more steps');
    const ignore = vi.fn();
    card.onIgnore = ignore;
    dialog.querySelector<HTMLButtonElement>('[data-act="ignore"]')!.click();
    expect(ignore).toHaveBeenCalledWith('test-pier');
  });

  it('greets the captain with the harbour name on an arrival card, with no ignore', () => {
    const { book, map } = setup();
    const dialog = fakeDialog();
    const card = new QuestCard(dialog);
    card.show(cardFor(book, map, 'test-main', 'step')!, 'Saltmere');
    expect(dialog.classList.contains('is-arrival')).toBe(true);
    expect(dialog.querySelector('.quest-arrival h1')!.textContent).toBe('Saltmere');
    expect(dialog.querySelector('[data-act="ignore"]')).toBeNull();
    const closed = vi.fn();
    card.onClose = closed;
    dialog.querySelector<HTMLButtonElement>('[data-act="market"]')!.click();
    expect(closed).toHaveBeenCalled();
  });

  it('ignores an offer: no card, no Quay entry, listed in the journal and taken up again', () => {
    const { world, book, map } = setup([OFFER]);
    expect(book.ignore('test-pier')).toBe(true);
    expect(book.offered).toEqual([]);
    expect(dueCard(book, map, 'saltmere', new Set(), new Set())).toBeNull();
    expect(quayItems(book, map, 'saltmere', new Set(), new Set())).toEqual([]);
    expect(journal(book, map).map((e) => e.state)).toEqual(['ignored']);
    // Saved with the voyage.
    const saved = readQuests(structuredClone(world.trade.quests), map, [OFFER]);
    expect(saved.ignored).toEqual(['test-pier']);
    expect(readQuests({ byId: {}, ignored: ['nope', 7] }, map, [OFFER]).ignored).toBeUndefined();
    expect(book.unignore('test-pier')).toBe(true);
    expect(book.offered.map((q) => q.id)).toEqual(['test-pier']);
    expect(world.trade.quests.ignored).toBeUndefined();
  });

  it('shows the Quay tab with a badge and a footer hint, and answers from it', () => {
    const { world, book, map } = setup([OFFER]);
    world.trade.dockedAt = 'saltmere';
    document.body.innerHTML = '<div id="panel" hidden></div>';
    const panel = new TradePanel(document.querySelector<HTMLElement>('#panel')!, world);
    const seen = new Set<string>();
    const act = vi.fn();
    panel.quay = {
      items: () => quayItems(book, map, world.trade.dockedAt, seen, new Set()),
      seen: (keys) => keys.forEach((k) => seen.add(k)),
      act,
    };
    panel.open('market');
    expect(document.querySelector('#tp-tab-quay .tab-badge')!.textContent).toBe('1');
    expect(document.querySelector('#tp-quay-hint')!.textContent).toContain('Kit Marlow');
    document.querySelector<HTMLButtonElement>('#tp-quay-hint')!.click();
    expect(document.querySelectorAll('.quay-person.is-new')).toHaveLength(1);
    expect(seen.has('test-pier:offer')).toBe(true);
    document.querySelector<HTMLButtonElement>('.quay-person [data-act="accept"]')!.click();
    expect(act).toHaveBeenCalledWith('test-pier', 'accept', undefined);
    // Seen: no badge, no hint.
    expect(document.querySelector('#tp-tab-quay .tab-badge')).toBeNull();
    expect(document.querySelector('#tp-quay-hint')).toBeNull();
  });
});
