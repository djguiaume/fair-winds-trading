// Shots only (issue #539): the player's wake in the "fine-foam" cosmetic style (lines and twinkles).
(() => {
  window.fwt.view.wake.setStyle({ style: 'fine-foam', tint: null });
  return new Promise((done) => setTimeout(done, 1500));
})();
