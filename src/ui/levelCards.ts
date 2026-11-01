import { hasText, t } from '../i18n';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, DIFFICULTY, type Difficulty } from '../sim/difficulty';
import { card } from './components';
import { el } from './components/dom';
import './theme/boot';

/*
 * The difficulty levels on screen (decisions 0083, 0113): a card per level on the New voyage
 * screen, built from `difficulty.json`, so a new level is one entry there. Text comes from
 * `level.<id>` and `level.<id>Tag`; a level not translated yet shows its file `name` and `tag`.
 * The level that plays by default wears the "Standard" badge.
 */

const SVG = 'http://www.w3.org/2000/svg';
/** Wave heights on a card, by number of waves; more waves share the card evenly. */
const WAVE_Y: Record<number, number[]> = { 1: [20], 2: [13, 25], 3: [8, 18, 28] };
const waveYs = (n: number) =>
  WAVE_Y[n] ?? Array.from({ length: n }, (_, i) => Math.round(6 + (i * 24) / Math.max(1, n - 1)));

const words = (key: string, fallback: string) => (hasText(key) ? t(key) : fallback);

/** One wave line per sea state, in the level's colour: the card's picture. */
function waves(id: Difficulty): SVGElement {
  const level = DIFFICULTY[id]!;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'level-waves');
  svg.setAttribute('viewBox', '0 0 46 34');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('style', `color: ${level.color}`);
  for (const y of waveYs(level.waves)) {
    const use = document.createElementNS(SVG, 'use');
    use.setAttribute('href', '#i-level-wave');
    use.setAttribute('y', String(y));
    svg.append(use);
  }
  return svg;
}

/** The level cards, in order; `choose` runs on a press, `mark` shows the chosen one. */
export function levelCards(choose: (id: Difficulty) => void) {
  const cards = DIFFICULTIES.map((id) => {
    const level = DIFFICULTY[id]!;
    const node = card({
      title: words(`level.${id}`, level.name),
      text: words(`level.${id}Tag`, level.tag),
      media: waves(id),
      selected: false,
      onPress: () => choose(id),
    });
    node.classList.add('level-card');
    node.dataset.level = id;
    node.setAttribute('role', 'radio');
    node.setAttribute('aria-checked', 'false');
    if (id === DEFAULT_DIFFICULTY) node.append(el('span', 'level-badge', t('level.asDesigned')));
    return node;
  });
  return {
    cards,
    mark(chosen: Difficulty) {
      for (const c of cards) {
        const on = c.dataset.level === chosen;
        c.setAttribute('aria-pressed', String(on));
        c.setAttribute('aria-checked', String(on));
      }
    },
  };
}
