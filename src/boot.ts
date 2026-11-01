import './ui/sprite';
import { dismissSplash, showSplashLanguage } from './ui/splash';

// The page's entry (issue #396): the start view in index.html paints first, then the game loads.
// Without this pause the browser would parse and run the whole game before its first paint.
// main.ts has shown the menu by the time its import settles (or failed, as without WebGL2).
showSplashLanguage();
requestAnimationFrame(() => {
  setTimeout(() => void import('./main').finally(dismissSplash), 0);
});
