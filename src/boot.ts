import './ui/sprite';
import { dismissSplash, followSplashProgress, showSplashLanguage } from './ui/splash';
import { installPortraitGate } from './ui/screens/portraitGate';

// The page's entry (issue #396): the start view in index.html paints first, then the game loads.
// Without this pause the browser would parse and run the whole game before its first paint.
// main.ts has shown the menu by the time its import settles (or failed, as without WebGL2), and
// the splash stays up while its shaders compile (issue #516).
showSplashLanguage();
installPortraitGate();
const progress = followSplashProgress();
requestAnimationFrame(() => {
  setTimeout(
    () =>
      void import('./main')
        .then(({ warmed }) => warmed)
        .finally(() => progress.finish())
        .finally(dismissSplash),
    0,
  );
});
