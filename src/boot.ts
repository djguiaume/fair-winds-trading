// The page's entry (issue #396): the start view in index.html paints first, then the game loads.
// Without this pause the browser would parse and run the whole game before its first paint.
requestAnimationFrame(() => {
  setTimeout(() => void import('./main'), 0);
});
