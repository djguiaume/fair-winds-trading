// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { resetTuning } from '../src/data/tuning';
import { setLanguage, translateDom } from '../src/i18n';
import { renderDifficultyButtons, renderLevelCards } from '../src/ui/levelCards';

/*
 * The New voyage cards and the Settings level switch are built from difficulty.json (decision
 * 0113). Built from the shipped file they must match the markup index.html had by hand.
 */

afterEach(() => {
  resetTuning();
  setLanguage('en');
});

/** Tags, classes and attributes in order, text ignored (translateDom fills it). */
function shape(node: Element): unknown {
  const attrs = [...node.attributes]
    .map((a) => [a.name, a.name === 'style' ? a.value.replace(/\s+/g, '') : a.value])
    .sort();
  return [node.tagName.toLowerCase(), attrs, [...node.children].map(shape)];
}

function build() {
  const cards = document.createElement('div');
  const buttons = document.createElement('div');
  renderLevelCards(cards);
  renderDifficultyButtons(buttons);
  return { cards, buttons };
}

describe('difficulty level cards (decision 0113)', () => {
  it('match the hand-written markup of decision 0083', () => {
    const old = document.createElement('div');
    old.innerHTML = readFileSync('tests/fixtures/difficulty-markup-0083.html', 'utf8');
    const [oldCards, oldButtons] = [
      old.querySelector('#level-cards')!,
      old.querySelector('#difficulty')!,
    ];
    const { cards, buttons } = build();
    expect([...cards.children].map(shape)).toEqual([...oldCards.children].map(shape));
    expect([...buttons.children].map(shape)).toEqual([...oldButtons.children].map(shape));
  });

  it('read the same once translated', () => {
    setLanguage('fr');
    const { cards, buttons } = build();
    translateDom(cards);
    translateDom(buttons);
    expect([...buttons.children].map((b) => b.textContent)).toEqual([
      'Bon vent',
      'Capitaine',
      'Vieux loup de mer',
    ]);
    expect(cards.querySelectorAll('li')).toHaveLength(14);
    expect(cards.querySelectorAll('li.extra')).toHaveLength(5);
  });
});
