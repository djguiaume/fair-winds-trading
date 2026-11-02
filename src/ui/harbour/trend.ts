import { formatNumber, t } from '../../i18n';

/**
 * The ledger's price line (decision 0276): the buy price at each logged day's end and today's,
 * drawn as a small ink line, and said in words in the detail pane ("Up 9 in 6 days").
 */

/** An SVG line through `prices`, `w`×`h`, a dot on today's price; none before a day has closed. */
export function sparkline(prices: readonly number[], w: number, h: number): string {
  if (prices.length < 2) return '';
  const lo = Math.min(...prices);
  const span = Math.max(1, Math.max(...prices) - lo);
  const pad = 3;
  const step = (w - pad * 2) / (prices.length - 1);
  const points = prices.map((p, i) => [
    pad + i * step,
    h - pad - ((p - lo) / span) * (h - pad * 2),
  ]);
  const [x, y] = points.at(-1)!;
  const line = `<polyline points="${points.map(([px, py]) => `${px!.toFixed(1)},${py!.toFixed(1)}`).join(' ')}"/>`;
  return `<svg class="hb-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${line}<circle cx="${x!.toFixed(1)}" cy="${y!.toFixed(1)}" r="2.6"/></svg>`;
}

/** The line in words: how far today's price moved since the oldest logged day. */
export function trendWords(prices: readonly number[]): string {
  const days = prices.length - 1;
  if (days < 1) return t('harbour.trendNew');
  const change = prices.at(-1)! - prices[0]!;
  const n = formatNumber(Math.abs(change));
  if (change > 0) return t(days === 1 ? 'harbour.trendUpDay' : 'harbour.trendUp', { n, days });
  if (change < 0) return t(days === 1 ? 'harbour.trendDownDay' : 'harbour.trendDown', { n, days });
  return t(days === 1 ? 'harbour.trendSteadyDay' : 'harbour.trendSteady', { days });
}
