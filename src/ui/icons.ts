/**
 * Icons from the inline SVG sprite in index.html (decision 0049): colour goods, coin, hull,
 * anchor and line icons, drawn in code so they look the same on every device.
 */
export function icon(id: string, cls = ''): string {
  return `<svg class="icon${cls ? ` ${cls}` : ''}" aria-hidden="true"><use href="#i-${id}" /></svg>`;
}

export const COIN = icon('coin', 'coin');

/** Cargo crate that fills from the bottom with the hold (0..1), instead of a bar. */
export function crateIcon(fill: number): string {
  const h = (16 * Math.min(1, Math.max(0, fill))).toFixed(1);
  return `<svg class="icon crate" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" fill="currentColor" fill-opacity=".18" /><rect x="3" y="${(20 - Number(h)).toFixed(1)}" width="18" height="${h}" fill="#bf8f66" /><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="M3 9.3h18M3 14.6h18" stroke="currentColor" stroke-width="1.7" /></svg>`;
}
