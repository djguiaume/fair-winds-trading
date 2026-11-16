// Shots only: a fresh breeze (22 kn) under a gale's grey-ish sky, held at once (no easing to wait for).
(() => {
  const { view } = window.fwt;
  const sky = view.atmosphere;
  const setView = sky.setView.bind(sky);
  sky.setView = (low) => setView(low, 22);
  const shown = view.sea.shownWeather.bind(view.sea);
  view.sea.shownWeather = (w) => ({ ...shown(w), gloom: 0.3 });
  sky.gloom = 0.3;
  return new Promise((done) => setTimeout(done, 1500));
})();
