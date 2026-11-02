// The loading screen's logo (issue #459): the rose, the wordmark and the banderole as one plain SVG
// in index.html, so it paints before any script or stylesheet of the game. It is cut from the
// sprite's own symbols (the CSS variables replaced by their fallbacks), so the two cannot drift.

export const SPLASH_MARKERS = ['<!-- identity:splash-logo -->', '<!-- /identity:splash-logo -->'];

const plain = (s) => s.replace(/var\(--[\w-]+,([^)]*)\)/g, '$1');

/** [viewBox, body] of one symbol of the sprite file. */
function symbol(sprite, id) {
  const m = sprite.match(new RegExp(`<symbol id="${id}" viewBox="([^"]*)">([\\s\\S]*?)</symbol>`));
  if (!m) throw new Error(`splash: symbol ${id} is missing from the sprite`);
  return { viewBox: m[1], body: plain(m[2]).replace(/\n\s*/g, '') };
}

const nested = (sym, x, y, width, height) =>
  `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${sym.viewBox}">${sym.body}</svg>`;

/** The marked block for index.html. */
export function splashLogoBlock(sprite) {
  const parts = [
    nested(symbol(sprite, 'i-logo'), 90, 0, 120, 120),
    nested(symbol(sprite, 'i-wordmark'), 0, 124, 300, 60),
    nested(symbol(sprite, 'i-banderole'), 60, 192, 180, 24),
  ];
  const svg = `<svg class="splash-logo" viewBox="0 0 300 216" aria-hidden="true">${parts.join('')}</svg>`;
  // Prettier would wrap the long line and the check would never settle.
  const pad = '      ';
  return `${SPLASH_MARKERS[0]}\n${pad}<!-- prettier-ignore -->\n${pad}${svg}\n${pad}${SPLASH_MARKERS[1]}`;
}

/** index.html with the block between the markers replaced. */
export function withSplashLogo(html, sprite) {
  const [open, close] = SPLASH_MARKERS;
  const a = html.indexOf(open);
  const b = html.indexOf(close);
  if (a < 0 || b < a) throw new Error('splash: the identity markers are missing from index.html');
  return html.slice(0, a) + splashLogoBlock(sprite) + html.slice(b + close.length);
}
