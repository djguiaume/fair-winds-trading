import { islandOpen } from './island/builder';
import { questsOpen } from './quest/builder';
import { controlsOpen, openControls, setupControlsPage } from './controls/page';
import { openSounds, setupSoundsPage, soundsOpen } from './sounds/page';
import { openRegatta, regattaOpen, setupRegattaPage } from './regatta/page';
import { cosmeticsOpen, openCosmetics, setupCosmeticsPage } from './cosmetics/page';

/** Whether a full-screen page (not the map) is open, so the map's own shortcuts stand down. */
export const pageOpen = () =>
  islandOpen() ||
  questsOpen() ||
  controlsOpen() ||
  soundsOpen() ||
  regattaOpen() ||
  cosmeticsOpen();

/** The editors' data pages: each opens from its button on the map and comes back through `close`. */
export function setupPages(close: () => void) {
  const pages: [string, () => void, (close: () => void) => void][] = [
    ['ed-controls', openControls, setupControlsPage],
    ['ed-sounds', openSounds, setupSoundsPage],
    ['ed-regatta', openRegatta, setupRegattaPage],
    ['ed-cosmetics', openCosmetics, setupCosmeticsPage],
  ];
  for (const [id, open, setup] of pages) {
    setup(close);
    document.getElementById(id)!.addEventListener('click', open);
  }
}
