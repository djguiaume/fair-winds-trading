// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SHIPPED_CATALOGUE } from '../src/data/cosmetics';
import { type Appearance, type Cosmetic, itemOf, stockAppearance } from '../src/sim/cosmetics';
import { isUnlocked, type UnlockProgress } from '../src/sim/cosmeticUnlocks';
import { howToEarn, slotChoices } from '../src/ui/boatLooks/choices';
import { type BoatLooksHost, BoatLooksScreen } from '../src/ui/boatLooks/screen';

// The turntable needs WebGL; the screen's logic does not.
const shown: unknown[] = [];
vi.mock('../src/render/boatPreview', () => ({
  BoatPreview: class {
    backdrop = { sky: '#fff', sea: '#00f' };
    show(boat: unknown) {
      shown.push(boat);
    }
    setNight() {}
    resize() {}
    start() {}
    turn() {}
    figureheadPicture() {
      return 'data:,';
    }
    dispose = vi.fn();
  },
}));

const cat = SHIPPED_CATALOGUE;
const item = (slot: Cosmetic['slot'], id: string) => itemOf(cat, slot, id) as Cosmetic;
const progress = (done: string[] = [], won: string[] = []): UnlockProgress => ({
  questDone: (id) => done.includes(id),
  seriesWon: won,
});

describe('cosmetic unlocks', () => {
  it('opens free items at once and earned ones by their quest or series', () => {
    expect(isUnlocked(item('sail-colour', 'lavender'), progress())).toBe(true);
    const windmill = item('sail-logo', 'windmill');
    expect(isUnlocked(windmill, progress())).toBe(false);
    expect(isUnlocked(windmill, progress(['westholm-mill']))).toBe(true);
    const foam = item('wake', 'foam');
    expect(isUnlocked(foam, progress())).toBe(false);
    expect(isUnlocked(foam, progress([], ['regatta-ring']))).toBe(true);
  });

  it('says how to earn a locked item with the quest name, in the player words', () => {
    expect(howToEarn(item('sail-logo', 'windmill'))).toBe('Earn it: The mill on the hill');
  });
});

describe('slot choices', () => {
  const stock = stockAppearance();

  it('offers None first where a slot may be empty, never for the sail colour', () => {
    const logos = slotChoices(cat, 'sailLogo', 'sloop', progress(), stock, stock);
    expect(logos[0]!.id).toBeNull();
    expect(logos[0]!.tried && logos[0]!.inUse).toBe(true);
    const colours = slotChoices(cat, 'sailColour', 'sloop', progress(), stock, stock);
    expect(colours.every((c) => c.item)).toBe(true);
  });

  it('marks the tried-on, the one in use and the locked ones', () => {
    const tried = { ...stock, figurehead: 'sun' };
    const heads = slotChoices(cat, 'figurehead', 'sloop', progress(), tried, stock);
    const sun = heads.find((c) => c.id === 'sun')!;
    expect(sun).toMatchObject({ tried: true, inUse: false, locked: true });
    expect(heads.find((c) => c.id === null)).toMatchObject({ tried: false, inUse: true });
  });
});

describe('the Boat looks screen', () => {
  let saved: Record<string, Appearance>;
  let host: BoatLooksHost;
  let screen: BoatLooksScreen;
  const $ = (s: string) => screen.root.querySelector<HTMLElement>(s)!;
  const click = (s: string) => $(s).click();

  beforeEach(() => {
    document.body.innerHTML = '<button id="opener">Boat looks</button>';
    shown.length = 0;
    saved = { sloop: stockAppearance(), cutter: stockAppearance() };
    host = {
      catalogue: cat,
      ships: () => [
        { id: 'sloop', upgrades: { sails: 2, hold: 1, hull: 2 }, damage: 1 },
        { id: 'cutter', upgrades: { sails: 1, hold: 1, hull: 1 }, damage: 0 },
      ],
      look: (id) => ({ ...saved[id]! }),
      use: vi.fn((id: string, look: Appearance) => {
        saved[id] = look;
        return true;
      }),
      progress: () => progress(),
      autoFlag: () => undefined,
      quality: () => 'medium',
      night: () => false,
    };
    screen = new BoatLooksScreen(host);
    document.getElementById('opener')!.focus();
    screen.open();
  });

  it('tries an item on the boat without keeping it, and Use keeps that slot', () => {
    click('[data-item="lavender"]');
    expect(host.use).not.toHaveBeenCalled();
    expect(shown.at(-1)).toMatchObject({ shipClass: 'sloop', damage: 1 });
    expect(JSON.stringify(shown.at(-1))).toContain('#cdbff0');
    click('.bl-use');
    expect(host.use).toHaveBeenCalledWith('sloop', {
      ...stockAppearance(),
      sailColour: 'lavender',
    });
    expect($('.bl-badge').textContent).toBe('In use');
  });

  it('puts back what she had on leaving, and frees the preview', () => {
    click('[data-item="mint"]');
    screen.close();
    expect(screen.isOpen).toBe(false);
    expect(document.activeElement?.id).toBe('opener');
    screen.open();
    expect($('.bl-tile[aria-pressed="true"]').dataset.item).toBe('canvas');
    expect(saved.sloop!.sailColour).toBe('canvas');
  });

  it('shows a locked item on the boat but will not use it', () => {
    click('[data-slot="figurehead"]');
    click('[data-item="sun"]');
    expect(JSON.stringify(shown.at(-1))).toContain('figurehead-sun');
    expect($('.bl-detail').textContent).toContain('Earn it:');
    expect($('.bl-use').getAttribute('aria-disabled')).toBe('true');
    click('.bl-use');
    expect(host.use).not.toHaveBeenCalled();
  });

  it('compares stock and full upgrades without changing her', () => {
    click('[data-compare="all"]');
    expect(shown.at(-1)).toMatchObject({ upgrades: { sails: 3, hold: 3, hull: 3 }, damage: 0 });
    click('[data-compare="stock"]');
    expect(shown.at(-1)).toMatchObject({ upgrades: { sails: 1, hold: 1, hull: 1 } });
    expect(host.use).not.toHaveBeenCalled();
  });

  it('dresses each owned ship on its own', () => {
    click('[data-item="sky"]');
    click('.bl-use');
    click('[data-ship="cutter"]');
    expect($('.bl-tile[aria-pressed="true"]').dataset.item).toBe('canvas');
    expect(shown.at(-1)).toMatchObject({ shipClass: 'cutter' });
  });

  it('keeps the focus on the pressed control after a redraw, and Esc or B leaves', () => {
    $('[data-item="peach"]').focus();
    click('[data-item="peach"]');
    expect((document.activeElement as HTMLElement).dataset.item).toBe('peach');
    // Esc on a modal dialog, and the pad's B (padScreen), send it `cancel`.
    screen.root.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(screen.isOpen).toBe(false);
  });
});
