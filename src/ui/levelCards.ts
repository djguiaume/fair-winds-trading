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
/** Wave heights under the boat, by number of waves; more waves share the space evenly. */
const WAVE_Y: Record<number, number[]> = { 1: [20], 2: [13, 25], 3: [8, 18, 28] };
const waveYs = (n: number) =>
  WAVE_Y[n] ?? Array.from({ length: n }, (_, i) => Math.round(6 + (i * 24) / Math.max(1, n - 1)));

const words = (key: string, fallback: string) => (hasText(key) ? t(key) : fallback);

/** Degrees the boat heels on the level's sea: the rougher the level, the more she leans. */
const HEEL = [0, -5, -10];

/**
 * The boat on the level's sea: one hull silhouette in ink, a wave line per sea state under her
 * (`level.waves`) and a heel that grows with them. Ink only: yellow and red are signal colours.
 */
function boatOnWaves(id: Difficulty, order: number): SVGElement {
  const level = DIFFICULTY[id]!;
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'level-boat');
  svg.setAttribute('viewBox', '0 0 120 76');
  svg.setAttribute('aria-hidden', 'true');
  const heel = HEEL[order] ?? HEEL.at(-1)!;
  const boat = document.createElementNS(SVG, 'g');
  boat.setAttribute('transform', `rotate(${heel} 60 50)`);
  boat.innerHTML =
    '<path d="M24 46h72l-10 14H36z" fill="currentColor"/>' +
    '<path d="M58 10v36" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M62 14l26 28H62z" fill="currentColor" fill-opacity=".55"/>' +
    '<path d="M54 20L34 42h20z" fill="currentColor" fill-opacity=".35"/>';
  svg.append(boat);
  waveYs(level.waves).forEach((y, i) => {
    const use = document.createElementNS(SVG, 'use');
    use.setAttribute('href', '#i-level-wave');
    use.setAttribute('x', String(i % 2 ? 22 : 6));
    use.setAttribute('y', String(58 + y * 0.6));
    svg.append(use);
  });
  return svg;
}

/** The level cards, in order; `choose` runs on a press, `mark` shows the chosen one. */
export function levelCards(choose: (id: Difficulty) => void) {
  const cards = DIFFICULTIES.map((id, order) => {
    const level = DIFFICULTY[id]!;
    const node = card({
      title: words(`level.${id}`, level.name),
      text: words(`level.${id}Tag`, level.tag),
      media: boatOnWaves(id, order),
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
