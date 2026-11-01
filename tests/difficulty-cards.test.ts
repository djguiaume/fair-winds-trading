// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetTuning } from '../src/data/tuning';
import { setLanguage } from '../src/i18n';
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from '../src/sim/difficulty';
import { levelCards } from '../src/ui/levelCards';

/*
 * The New voyage cards are built from difficulty.json (decision 0113): one card per level, in
 * order, with the default level badged and the chosen one marked.
 */

afterEach(() => {
  resetTuning();
  setLanguage('en');
});

describe('difficulty level cards (decision 0113)', () => {
  it('make one card per level in the data, the default badged', () => {
    const { cards } = levelCards(() => {});
    expect(cards.map((c) => c.dataset.level)).toEqual([...DIFFICULTIES]);
    const badged = cards.filter((c) => c.querySelector('.level-badge'));
    expect(badged.map((c) => c.dataset.level)).toEqual([DEFAULT_DIFFICULTY]);
  });

  it('read the same once translated', () => {
    setLanguage('fr');
    const { cards } = levelCards(() => {});
    expect(cards.map((c) => c.querySelector('.ui-card-title')!.textContent)).toEqual([
      'Bon vent',
      'Capitaine',
      'Vieux loup de mer',
    ]);
  });

  it('choose on a press and mark only the chosen card', () => {
    const choose = vi.fn();
    const picker = levelCards(choose);
    picker.cards[2]!.click();
    expect(choose).toHaveBeenCalledWith(DIFFICULTIES[2]);
    picker.mark(DIFFICULTIES[2]!);
    expect(picker.cards.map((c) => c.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
    ]);
  });
});
