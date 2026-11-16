// Shot helper (docs/reviews/v1.13/boat-up-close): sails her at `from` degrees off the wind for
// `settle` ms, puts her at `to` degrees off it, then waits `after` ms before the shot. Positive
// angles have the wind over her starboard side. Set window.turn = { from, to, settle, after }
// in a script before this one.
(async () => {
  const { from, to, settle, after } = window.turn;
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const boat = () => window.fwt.world.boat;
  const wind = () => window.fwt.world.wind.from;
  const deg = Math.PI / 180;
  boat().heading = wind() - from * deg;
  await pause(settle);
  boat().heading = wind() - to * deg;
  await pause(after);
})();
