import { type MessageKey, t } from '../../i18n';
import { el } from '../components/dom';
import { listRow } from '../components/listRow';
import { label } from '../hud/parts';

/** The legend's symbols, drawn with the chart's own classes so they always match it. */
const SYMBOLS = {
  you: '<path class="chart-player-hull" transform="translate(18 12) rotate(60) scale(0.8)" d="M0 -13C5 -8 6 -2 6 3V9C6 12 3 14 0 14S-6 12 -6 9V3C-6 -2 -5 -8 0 -13Z"/>',
  port: '<circle cx="18" cy="12" r="5" class="chart-port-dot"/>',
  course:
    '<path d="M3 20L29 6" class="chart-course"/><circle cx="29" cy="6" r="4" class="chart-selected"/>',
  quest:
    '<g class="chart-flag chart-flag-quest"><circle cx="18" cy="12" r="10" class="chart-flag-disc"/><path class="chart-flag-cloth" d="M15.5 18V6H24L21.5 9 24 12H17V18Z"/></g>',
  mark: '<g class="chart-flag chart-flag-mark"><circle cx="18" cy="12" r="10" class="chart-flag-disc"/><path class="chart-flag-cross" d="M13 7L23 17M23 7L13 17"/></g>',
  land: '<path d="M4 20L8 5 22 3 32 18Z" class="chart-land"/>',
  reef: '<path d="M4 20L8 5 22 3 32 18Z" class="chart-reef"/>',
  bank: '<path d="M4 20L8 5 22 3 32 18Z" class="chart-bank"/>',
  uncharted:
    '<rect x="3" y="3" width="30" height="18" class="chart-key-uncharted"/><path d="M3 21L21 3M11 21L29 3M19 21L33 7" class="chart-key-hatch"/>',
  nogo: '<path d="M18 22L8 4A20 20 0 0 1 28 4Z" class="chart-key-nogo"/><path d="M18 22L8 4M13 13L18 4M18 22L28 4M20 16L24 8" class="chart-key-hatch"/>',
  storm:
    '<g class="hazard-storm"><circle cx="18" cy="12" r="10" class="hazard-badge"/><use href="#i-storm" x="8" y="2" width="20" height="20"/></g>',
} as const;
type Symbol = keyof typeof SYMBOLS;

const KEYS: readonly [Symbol, MessageKey][] = [
  ['you', 'chart.keyYou'],
  ['port', 'chart.keyPort'],
  ['course', 'chart.keyTarget'],
  ['quest', 'chart.keyQuestPlace'],
  ['mark', 'chart.keyMark'],
  ['land', 'chart.keyLand'],
  ['reef', 'chart.keyReef'],
  ['bank', 'chart.keyBank'],
  ['uncharted', 'chart.uncharted'],
  ['nogo', 'chart.keyNoGo'],
  ['storm', 'chart.keyStorm'],
];

/** The help lines under the keys. */
const HELP: readonly MessageKey[] = [
  'chart.instructions',
  'chart.gestures',
  'chart.bearingHelp',
  'chart.pauseHelp',
];

const symbol = (name: Symbol, cls = 'chart-key-symbol') =>
  `<svg class="${cls}" viewBox="0 0 36 24" aria-hidden="true">${SYMBOLS[name]}</svg>`;

/** The Legend page (issue #444): every mark of the chart as a row, then how to use it. */
export function legendPage(): HTMLElement[] {
  const keys = el('div', 'chart-legend');
  for (const [name, key] of KEYS) {
    const row = listRow({ label: t(key) });
    label(row.querySelector<HTMLElement>('.ui-row-label')!, key);
    row.insertAdjacentHTML('afterbegin', symbol(name));
    keys.append(row);
  }
  const help = el('div', 'chart-page-help');
  for (const key of HELP) help.append(label(el('p', ''), key));
  return [keys, help];
}

/** The short key on the map beside the rose (round 3 D): her course, a quest's place, a reef, the no-go. */
export function keyStrip(): HTMLElement {
  const strip = el('div', 'chart-keystrip');
  const keys: [Symbol, MessageKey][] = [
    ['course', 'chart.keyCourse'],
    ['quest', 'chart.keyQuestPlace'],
    ['reef', 'chart.keyReef'],
    ['nogo', 'chart.keyNoGo'],
  ];
  for (const [name, key] of keys) {
    const item = el('span', 'chart-keystrip-item');
    item.innerHTML = symbol(name, 'chart-keystrip-symbol');
    item.append(label(el('span', ''), key));
    strip.append(item);
  }
  return strip;
}
