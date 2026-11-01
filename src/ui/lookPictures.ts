import type { FlagDef } from '../sim/regatta';
import { RULES, type ResolvedLook } from '../sim/cosmetics';

/**
 * Small flat pictures of a boat's look as SVG text (decision 0261): a sail swatch with its
 * cloth, pattern and emblem, a hull swatch, a wake swatch and a flag. Shared by the Boat looks
 * screen (#299) and the editors' Cosmetics and Regatta pages, so an item looks the same in both.
 */

/**
 * A flag drawn flat as SVG, as `flagGeometry` builds it in the game: the luff on the left, the
 * bands from the mast out, a swallowtail's fork cut 70 % in. `px` pixels per flag unit.
 */
export function flagSvg(f: FlagDef, px = 80): string {
  const L = f.length * px;
  const H = f.height * px;
  const bands = f.bands.length ? f.bands : ['#d2462f'];
  const n = bands.length;
  const polys: string[] = [];
  const poly = (pts: number[][], c: string) =>
    polys.push(
      `<polygon points="${pts.map(([x, y]) => `${(x! * L).toFixed(1)},${y!.toFixed(1)}`).join(' ')}" fill="${c}"/>`,
    );
  if (f.shape === 'swallowtail') {
    const fork = 0.7;
    for (let i = 0; i < n; i++)
      poly(
        [
          [(i / n) * fork, 0],
          [((i + 1) / n) * fork, 0],
          [((i + 1) / n) * fork, H],
          [(i / n) * fork, H],
        ],
        bands[i]!,
      );
    const last = bands[n - 1]!;
    poly(
      [
        [fork, 0],
        [1, 0],
        [1, H * 0.25],
        [fork, H * 0.5],
      ],
      last,
    );
    poly(
      [
        [fork, H * 0.5],
        [1, H * 0.75],
        [1, H],
        [fork, H],
      ],
      last,
    );
  } else {
    const top = (u: number) => (H / 2) * u;
    const bottom = (u: number) => H - (H / 2) * u;
    for (let i = 0; i < n; i++) {
      const u0 = i / n;
      const u1 = (i + 1) / n;
      poly(
        [
          [u0, top(u0)],
          [u1, top(u1)],
          [u1, bottom(u1)],
          [u0, bottom(u0)],
        ],
        bands[i]!,
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(L) + 6}" height="${Math.ceil(H) + 6}" viewBox="-3 -3 ${Math.ceil(L) + 6} ${Math.ceil(H) + 6}"><line x1="0" y1="-3" x2="0" y2="${H + 3}" stroke="#22252a" stroke-width="3"/>${polys.join('')}</svg>`;
}

/** The shapes inside an emblem's `<svg>`, to place it on a sail. */
export const emblemShapes = (svg: string) =>
  svg.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** A gaff sail seen flat, in a 40 × 56 box: head at the top, foot at the bottom. */
const SAIL = 'M30 3 L30 53 L5 53 L13 15 Z';
const SAIL_TOP = 3;
const SAIL_FOOT = 25;
const SAIL_HEIGHT = 50;

/** Every sail swatch needs its own clip id, as many share one page. */
let clips = 0;

/**
 * A sail in a look: the cloth, the pattern's bands (variant B's places, decision 0259) and the
 * emblem at `rules.json` › `emblem` (a share of the sail's width, its centre down the sail).
 * `emblemWidth` draws it larger, for a logo's own tile.
 */
export function sailSwatchSvg(
  sail: ResolvedLook['sail'],
  emblemWidth = RULES.emblem.width,
): string {
  const id = `sail-clip-${++clips}`;
  const [band, stripe = band] = sail.pattern.colours;
  const bands =
    sail.pattern.kind === 'plain' || !band
      ? ''
      : `<g clip-path="url(#${id})"><rect x="0" y="45" width="40" height="8" fill="${band}"/><rect x="0" y="3" width="40" height="6" fill="${band}"/><rect x="0" y="26" width="40" height="4" fill="${stripe}"/></g>`;
  const size = emblemWidth * SAIL_FOOT;
  const y = Math.max(SAIL_TOP + 8, SAIL_TOP + RULES.emblem.centreV * SAIL_HEIGHT - size / 2);
  const logo = sail.logo
    ? `<svg x="${(29 - size).toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" viewBox="0 0 32 32"><g fill="${sail.logo.colour}">${emblemShapes(sail.logo.svg)}</g></svg>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 56" aria-hidden="true"><defs><clipPath id="${id}"><path d="${SAIL}"/></clipPath></defs><path d="${SAIL}" fill="${sail.cloth}" stroke="#4a3320" stroke-width="1.2"/>${bands}${logo}<rect x="30" y="1" width="2" height="54" fill="#5b3a1e"/></svg>`;
}

/** A hull side: her wood, the band and the rubbing strake. */
export function hullSwatchSvg(hull: string, band: string, strake: string | null): string {
  const rub = strake ? `<rect x="7" y="16" width="42" height="2.5" fill="${strake}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 6 56 24" aria-hidden="true"><path d="M2 8 H54 L46 28 H10 Z" fill="${hull}" stroke="#4a3320"/><rect x="4" y="10" width="48" height="5" fill="${band}"/>${rub}</svg>`;
}

/** Two lines of wake on the sea: plain, dashed foam or bubbles, in her tint. */
export function wakeSwatchSvg(wake: ResolvedLook['wake'], sea: string): string {
  const dash: Record<string, string> = { bubbles: '1 5', foam: '9 4', 'fine-foam': '5 3' };
  const width = wake.style === 'plain' ? 2 : 3.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 32" aria-hidden="true"><rect width="56" height="32" rx="4" fill="${sea}"/><path d="M4 10 Q28 18 52 10 M4 22 Q28 14 52 22" fill="none" stroke="${wake.tint ?? '#f6f9fb'}" stroke-width="${width}" stroke-dasharray="${dash[wake.style] ?? ''}" stroke-linecap="round"/></svg>`;
}
