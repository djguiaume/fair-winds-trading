import { t } from '../i18n';
import './chartDial.css';

/**
 * The chart's wind dial (decision 0040): north up like the chart, the wind arrow, the no-go zone,
 * the reaching bands, the boat and the course dot; `seaChart.ts` turns them. The sea HUD's own
 * compass turns with the boat instead (issue #441), so the chart keeps this one to itself.
 */
export function chartDial(): SVGSVGElement {
  const box = document.createElement('div');
  box.innerHTML = `<svg viewBox="-50 -50 100 100" aria-hidden="true">
    <circle r="46" class="face" />
    <g><path d="M43.23 -15.73 A46 46 0 0 1 15.73 43.23" class="band" />
      <path d="M-43.23 -15.73 A46 46 0 0 0 -15.73 43.23" class="band" /></g>
    <g><path d="M0 0 L-28.28 -28.28 A40 40 0 0 1 28.28 -28.28 Z" class="nogo" /></g>
    <path class="ticks" d="M0 -40V-34M40 0H34M0 40V34M-40 0H-34M20 -34.64L18.5 -32.04M34.64 -20L32.04 -18.5M34.64 20L32.04 18.5M20 34.64L18.5 32.04M-20 34.64L-18.5 32.04M-34.64 20L-32.04 18.5M-34.64 -20L-32.04 -18.5M-20 -34.64L-18.5 -32.04" />
    <text y="-24" class="north">${t('compass.N')}</text>
    <text x="27" y="3.5" class="cardinal">${t('compass.E')}</text>
    <text y="30.5" class="cardinal">${t('compass.S')}</text>
    <text x="-27" y="3.5" class="cardinal">${t('compass.W')}</text>
    <g><g><path d="M0 -30 L9 -6 L2 -9 L2 26 L-2 26 L-2 -9 L-9 -6 Z" class="wind" /></g></g>
    <g><path d="M0 -17 L6 6 L0 3 L-6 6 Z" class="boat" /></g>
    <g><circle cy="-44" r="4" class="wp" /></g>
  </svg>`;
  return box.firstElementChild as SVGSVGElement;
}
