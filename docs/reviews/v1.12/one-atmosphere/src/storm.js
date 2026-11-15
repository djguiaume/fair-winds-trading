// Shots only: a storm's core held at the boat, its light already fallen (no easing to wait for).
(() => {
  const { view } = window.fwt;
  const shown = view.sea.shownWeather.bind(view.sea);
  view.sea.shownWeather = (w) => ({ ...shown(w), gloom: 1, rain: 0.8, storm: 0.9 });
  view.atmosphere.gloom = 1;
  return new Promise((done) => setTimeout(done, 1500));
})();
