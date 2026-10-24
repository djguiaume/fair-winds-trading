/* global window, document */
// Mockup: open the build choice of Skerry's first spot, as after the arc that offers it.
(() => {
  const home = window.fwt.world.trade.home.islands.skerry;
  if (!home.offered.includes('spot-1')) home.offered.push('spot-1');
  window.fwt.homePanel.render();
  document.documentElement.dataset.input = 'pad';
  window.fwt.homePanel.open('spot-1');
})();
