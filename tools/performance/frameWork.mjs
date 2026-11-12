/* global window, performance */
/**
 * Page script (issue #516): times every animation-frame callback, the game's own work in a frame
 * (simulation, HUD, builds, shader waits, the render call), into `window.perfWork` as
 * `[startMs, workMs]`. A stall shows here on any machine; the gap between frames in the headless
 * software renderer is mostly drawing, which a real graphics chip does elsewhere.
 */
export function timeFrameWork() {
  const work = [];
  window.perfWork = work;
  const request = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) =>
    request((time) => {
      const start = performance.now();
      callback(time);
      work.push([start, performance.now() - start]);
    });
}
