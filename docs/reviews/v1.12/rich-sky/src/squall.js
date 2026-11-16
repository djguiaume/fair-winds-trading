// Shots only: a squall 140 units off the bow (south of the boat), coming, seen from clear sky.
(() => {
  const { view, world } = window.fwt;
  const shown = view.sea.shownWeather.bind(view.sea);
  const storm = { id: 99, x: world.boat.x + 30, y: world.boat.y - 220, radius: 80, intensity: 1, dx: 0, dy: 1, squall: true };
  view.sea.shownWeather = (w) => ({ ...shown(w), storms: [storm] });
  return new Promise((done) => setTimeout(done, 1500));
})();
