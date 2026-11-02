// The loading screen (issue #459) as one line of plain markup in index.html, so it paints before any script or stylesheet of the game. It is cut from the
// sprite's own symbols (the CSS variables replaced by their fallbacks), so the two cannot drift.

// The screen is the div after the ignore comment, up to the stage.
const SCREEN = /<div id="splash"[\s\S]*?<\/div>(?=\s*<div id="stage">)/;

const plain = (s) => s.replace(/var\(--[\w-]+,([^)]*)\)/g, '$1');

/** [viewBox, body] of one symbol of the sprite file. */
function symbol(sprite, id) {
  const m = sprite.match(new RegExp(`<symbol id="${id}" viewBox="([^"]*)">([\\s\\S]*?)</symbol>`));
  if (!m) throw new Error(`splash: symbol ${id} is missing from the sprite`);
  return { viewBox: m[1], body: plain(m[2]).replace(/\n\s*/g, '') };
}

const nested = (sym, x, y, width, height) =>
  `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${sym.viewBox}">${sym.body}</svg>`;

const WAVE = `M0 24q12.5 -10 25 0${'t25 0'.repeat(11)}`;
const waveSvg = (cls) =>
  `<svg class="splash-wave splash-wave--${cls}" viewBox="0 0 300 40" preserveAspectRatio="none"><path d="${WAVE}"/></svg>`;
const BOAT =
  '<svg class="splash-boat" viewBox="0 0 36 36"><path class="splash-boat-sail" d="M18 5 30 23H18zM16 10V23H6z"/><path class="splash-boat-hull" d="M3 25H33L28 32H9z"/></svg>';

/** The whole loading screen as one line of index.html (the words are English until boot.ts sets the language). */
export function splashBlock(sprite) {
  const parts = [
    nested(symbol(sprite, 'i-logo'), 90, 0, 120, 120),
    nested(symbol(sprite, 'i-wordmark'), 0, 124, 300, 60),
    nested(symbol(sprite, 'i-banderole'), 60, 192, 180, 24),
  ];
  const logo = `<svg class="splash-logo" viewBox="0 0 300 216" aria-hidden="true">${parts.join('')}</svg>`;
  const sea = `<div class="splash-sea" aria-hidden="true">${waveSvg('track')}${waveSvg('fill')}${BOAT}</div>`;
  const tag =
    '<p class="splash-tag" id="splash-tag">Read the wind, carry the cargo, find a home.</p>';
  const status = '<p class="splash-status" id="splash-status">Hoisting sail</p>';
  const screen = `<div id="splash" role="status">${logo}${tag}${sea}${status}</div>`;
  // Prettier would wrap the long line and the check would never settle.
  return screen;
}

/** index.html with the loading screen rewritten from the sprite. */
export function withSplash(html, sprite) {
  if (!SCREEN.test(html)) throw new Error('splash: the loading screen is missing from index.html');
  return html.replace(SCREEN, () => splashBlock(sprite));
}
