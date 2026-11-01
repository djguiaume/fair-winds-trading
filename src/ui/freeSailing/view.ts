import { SHIP_FILES } from '../../data/ships';
import { FREE_RULES } from '../../data/freeSailing';
import type { FreePreset, FreeSetup } from '../../sim/freeSailing';
import { UPGRADE_TRACKS, MAX_UPGRADE_LEVEL } from '../../sim/upgrades';
import { type MessageKey, language, shipName, t } from '../../i18n';

/**
 * The Free Sailing setup's markup (#300): presets on paper at the left, the boat on her turntable
 * in the middle (the Boat looks screen's stage, decision 0265), ship and upgrades at the right.
 * Strings only; `setup.ts` puts them in place and wires them.
 */

const lang = () => (language() === 'fr' ? 'fr' : 'en');
const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0');
const clock = (hour: number) => `${pad2(hour)}:${pad2((hour % 1) * 60)}`;

export function shellHtml(): string {
  return `
    <aside class="bl-slots on-paper fs-side">
      <h2 class="bl-title" id="fs-title">${t('free.title')}</h2>
      <p class="fs-note">${t('free.note')}</p>
      <h3 class="fs-head">${t('free.place')}</h3>
      <div class="fs-presets" role="radiogroup" aria-label="${t('free.place')}"></div>
    </aside>
    <section class="bl-stage">
      <div class="bl-ship-line"></div>
      <canvas class="bl-canvas"></canvas>
      <div class="bl-view">
        <button type="button" class="bl-round" data-turn="-1" title="${t('customise.turnLeft')}" aria-label="${t('customise.turnLeft')}">⟲</button>
        <button type="button" class="bl-round" data-turn="1" title="${t('customise.turnRight')}" aria-label="${t('customise.turnRight')}">⟳</button>
      </div>
    </section>
    <aside class="bl-items on-paper fs-side">
      <div class="fs-ship-head">
        <h3 class="fs-head">${t('free.ship')}</h3>
        <button type="button" class="d-btn fs-looks">${t('customise.title')}</button>
      </div>
      <div class="bl-ships fs-ships" role="radiogroup" aria-label="${t('free.ship')}"></div>
      <h3 class="fs-head">${t('free.upgrades')}</h3>
      <div class="fs-upgrades"></div>
      <div class="fs-actions">
        <button type="button" class="d-btn brass big fs-sail">${t('menu.play')}</button>
        <button type="button" class="d-btn fs-leave">${t('free.leave')}</button>
      </div>
    </aside>
    <button type="button" class="close-btn bl-close" title="${t('customise.close')}" aria-label="${t('customise.close')}">✕</button>`;
}

/** The weather's icon from the rules file; decorative, the weather's name sits beside it. */
function weatherIcon(kind: string): string {
  const inner = FREE_RULES.weatherIcons[kind] ?? '';
  return `<svg class="fs-weather" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}

export function presetsHtml(presets: readonly FreePreset[], current: string): string {
  return presets
    .map((p) => {
      const when = `${clock(p.hour)} · ${t(`weather.${p.weather}` as MessageKey)}`;
      return `<button type="button" role="radio" class="fs-preset" data-preset="${p.id}" aria-checked="${p.id === current}">
        <b>${p.name[lang()]}</b><small>${weatherIcon(p.weather)}${when}</small><span>${p.about[lang()]}</span>
      </button>`;
    })
    .join('');
}

export function shipsHtml(current: string): string {
  return SHIP_FILES.map(
    (s) =>
      `<button type="button" role="radio" data-ship="${s.id}" aria-pressed="${s.id === current}" aria-checked="${s.id === current}">${shipName(s)}</button>`,
  ).join('');
}

/** One row per upgrade track, its levels as a segmented choice. */
export function upgradesHtml(setup: FreeSetup): string {
  const levels = Array.from({ length: MAX_UPGRADE_LEVEL }, (_, i) => i + 1);
  return UPGRADE_TRACKS.map(
    (track) => `<div class="fs-track" role="radiogroup" aria-label="${t(`free.${track}`)}">
      <span>${t(`free.${track}`)}</span>
      <span class="fs-levels" data-pad="steps">${levels
        .map(
          (n) =>
            `<button type="button" role="radio" data-track="${track}" data-level="${n}" aria-checked="${setup.upgrades[track] === n}">${n}</button>`,
        )
        .join('')}</span>
    </div>`,
  ).join('');
}
