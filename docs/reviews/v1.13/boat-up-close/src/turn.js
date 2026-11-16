// Shot helper (docs/reviews/v1.13/boat-up-close): sails her at `from` degrees off the wind for
// `settle` ms, turns her the short way to `to` degrees off it at about a sloop's turning rate,
// then waits `after` ms before the shot. Positive angles have the wind over her starboard side.
// Set window.turn = { from, to, settle, after } in a script before this one.
(async () => {
  const { from, to, settle, after } = window.turn;
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const boat = () => window.fwt.world.boat;
  const wind = () => window.fwt.world.wind.from;
  const deg = Math.PI / 180;
  boat().heading = wind() - from * deg;
  await pause(settle);
  const turn = ((((from - to + 180) % 360) + 360) % 360) - 180;
  const steps = Math.ceil(Math.abs(turn) / 2);
  for (let i = 1; i <= steps; i++) {
    boat().heading = wind() - (from - (turn * i) / steps) * deg;
    await pause(40);
  }
  await pause(after);
})();
