// The logo's symbols for the icon sprite in index.html (v1.5, the chart table): the compass rose
// with its pennant, the wordmark and the banderole, each in a title size and a small size.
// Colours are CSS variables (src/ui/identity/logo.css), so one drawing serves paper and the scene;
// `--logo-halo` is the 1 px ink halo that keeps the logo readable on the sea.

const v = (name, fallback) => `var(--logo-${name},${fallback})`;
const INK = v('ink', '#23303a');
const PAPER = v('paper', '#efe6d1');
const SIG = v('sig', '#4a6d41');
const HALO = v('halo', 'none');

const point = (deg, tip, half, edge) => {
  const d = (side) => `M60 60 60 ${60 - tip} ${60 + side * half} ${60 - half * 0.9}z`;
  const line = `stroke:${INK};stroke-width:${edge};stroke-linejoin:round`;
  return `<g transform="rotate(${deg} 60 60)"><path style="fill:${INK};${line}" d="${d(1)}"/><path style="fill:${PAPER};${line}" d="${d(-1)}"/></g>`;
};
const PENNANT = 'M60 8c10 -2 22 -6 30 -2l-6 6 8 4c-10 2-22 0-32 -2z';

function rose(small) {
  const w = small ? 4 : 2.4;
  const [tip, half, edge] = small ? [50, 9, 2] : [52, 6, 1.2];
  const points =
    [0, 90, 180, 270].map((d) => point(d, tip, half, edge)).join('') +
    [45, 135, 225, 315].map((d) => point(d, tip * 0.62, half * 0.7, edge)).join('');
  const rings = `<circle cx="60" cy="60" r="54" style="fill:none;stroke:${INK};stroke-width:${w}"/>${
    small ? '' : `<circle cx="60" cy="60" r="46" style="fill:none;stroke:${INK};stroke-width:1"/>`
  }`;
  const hub = `<circle cx="60" cy="60" r="${small ? 6 : 4}" style="fill:${SIG};stroke:${INK};stroke-width:1.4"/>`;
  const pennant = `<path d="${PENNANT}" style="fill:${SIG};stroke:${INK};stroke-width:${small ? 2.4 : 1.2};stroke-linejoin:round"/>`;
  const halo = `<g style="fill:${HALO};stroke:${HALO};stroke-width:${small ? 8 : 2};stroke-linejoin:round"><circle cx="60" cy="60" r="${54 + w / 2}"/><path d="${PENNANT}"/></g>`;
  return `${halo}${rings}${points}${hub}${pennant}`;
}

const wordmark = () => `
      <symbol id="i-wordmark" viewBox="-4 -78 458 92">
        <text textLength="450" lengthAdjust="spacingAndGlyphs" style="font:400 100px var(--font-title,'IM Fell English',Georgia,serif);fill:${INK};stroke:${HALO};stroke-width:3;stroke-linejoin:round;paint-order:stroke">Fair Winds</text>
      </symbol>`;

const RIBBON = 'M14 6h272l-12 14 12 14H14l12-14z';
const banderole = (small) => `
      <symbol id="i-banderole${small ? '-sm' : ''}" viewBox="0 0 300 40">
        <path d="${RIBBON}" style="fill:none;stroke:${HALO};stroke-width:3;stroke-linejoin:round"/>
        <path d="${RIBBON}" style="fill:${SIG};stroke:${INK};stroke-width:1.6;stroke-linejoin:round"/>${
          small
            ? ''
            : `
        <text x="150" y="27" text-anchor="middle" textLength="150" lengthAdjust="spacingAndGlyphs" style="font:italic 400 22px var(--font-title,'IM Fell English',Georgia,serif);fill:${v('on-sig', '#efe6d1')}">Trading Company</text>`
        }
      </symbol>`;

/** The symbol block between the identity markers of index.html. */
export function logoSymbols() {
  return [
    `      <symbol id="i-logo" viewBox="0 0 120 120">${rose(false)}</symbol>`,
    `      <symbol id="i-logo-sm" viewBox="0 0 120 120">${rose(true)}</symbol>`,
    wordmark(),
    banderole(false),
    banderole(true),
  ].join('\n');
}
