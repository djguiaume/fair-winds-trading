import { hasText, t } from '../i18n';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, DIFFICULTY } from '../sim/difficulty';
import './theme.css';

/*
 * The difficulty levels on screen (decisions 0083, 0113): a card per level on the New voyage
 * screen and a button per level in Settings, built from `difficulty.json`, so a new level is one
 * entry there. Text comes from `level.<id>`, `level.<id>Tag` and the points `level.<id>1`,
 * `level.<id>2`… in the text files; a level not translated yet shows its file `name` and `tag`
 * and no points. The level that plays by default wears the "Standard" badge.
 */

/** Points shown on a small screen; the rest are folded away (`.extra`). */
const SHORT_POINTS = 3;
/** Wave heights on a card, by number of waves; more waves share the card evenly. */
const WAVE_Y: Record<number, number[]> = { 1: [20], 2: [13, 25], 3: [8, 18, 28] };
const waveYs = (n: number) =>
  WAVE_Y[n] ?? Array.from({ length: n }, (_, i) => Math.round(6 + (i * 24) / Math.max(1, n - 1)));

const SVG = 'http://www.w3.org/2000/svg';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

/** A translated element, or the data's English text until the level is translated. */
function text<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  key: string,
  fallback: string,
) {
  const e = el(tag, className);
  if (hasText(key)) e.dataset.i18n = key;
  else e.textContent = fallback;
  return e;
}

/** The point keys a level has text for: `level.<id>1`, `level.<id>2`… until one is missing. */
function pointKeys(id: string): string[] {
  const keys: string[] = [];
  while (hasText(`level.${id}${keys.length + 1}`)) keys.push(`level.${id}${keys.length + 1}`);
  return keys;
}

/** Fill the New voyage screen's card list, one card per level. */
export function renderLevelCards(root: HTMLElement): void {
  root.replaceChildren(
    ...DIFFICULTIES.map((id) => {
      const level = DIFFICULTY[id]!;
      const card = el('button', 'level-card');
      card.type = 'button';
      card.setAttribute('role', 'radio');
      card.dataset.level = id;
      card.setAttribute('aria-checked', 'false');
      if (id === DEFAULT_DIFFICULTY) {
        const badge = el('span', 'level-badge');
        badge.dataset.i18n = 'level.asDesigned';
        badge.textContent = t('level.asDesigned');
        card.append(badge);
      }
      const top = el('span', 'level-top');
      const waves = document.createElementNS(SVG, 'svg');
      waves.setAttribute('class', 'level-waves');
      waves.setAttribute('viewBox', '0 0 46 34');
      waves.setAttribute('aria-hidden', 'true');
      waves.setAttribute('style', `color: ${level.color}`);
      for (const y of waveYs(level.waves)) {
        const use = document.createElementNS(SVG, 'use');
        use.setAttribute('href', '#i-level-wave');
        use.setAttribute('y', String(y));
        waves.append(use);
      }
      top.append(waves, text('span', 'level-name', `level.${id}`, level.name));
      const points = el('ul');
      pointKeys(id).forEach((key, i) => {
        const li = el('li', i < SHORT_POINTS ? undefined : 'extra');
        li.dataset.i18n = key;
        points.append(li);
      });
      card.append(top, text('span', 'level-tag', `level.${id}Tag`, level.tag), points);
      return card;
    }),
  );
}

/** Fill the Settings difficulty switch, one button per level. */
export function renderDifficultyButtons(root: HTMLElement): void {
  root.replaceChildren(
    ...DIFFICULTIES.map((id) => {
      const level = DIFFICULTY[id]!;
      const b = text('button', '', `level.${id}`, level.name);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.level = id;
      if (!b.textContent) b.textContent = level.name;
      return b;
    }),
  );
}
