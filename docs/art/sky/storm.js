// Shots only: the weather at the boat as under a storm's core, held while the light greys.
(() => {
  const sea = window.fwt.view.sea;
  const shown = sea.shownWeather.bind(sea);
  sea.shownWeather = (w) => ({ ...shown(w), gloom: 1, rain: 0.8, storm: 0.9 });
  return new Promise((done) => setTimeout(done, 7000));
})();
