import ui from './sprite/ui.svg?raw';
import goods from './sprite/goods.svg?raw';
import logo from './sprite/logo.svg?raw';

/**
 * The icon sprite (decision 0049): every `<use href="#i-…">` in the page and in the HUD code points
 * here. The files hold the symbols (ui, goods, and the logo that `npm run identity` writes), so
 * index.html stays small. Imported by boot.ts, so the symbols exist before the game builds any screen.
 */
document.body.insertAdjacentHTML(
  'afterbegin',
  `<svg class="icon-sprite" aria-hidden="true">${ui}${goods}${logo}</svg>`,
);
