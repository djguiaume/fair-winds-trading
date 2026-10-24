/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, window, localStorage */
// Wind zones as built (decision 0144): real game captures of a doldrums zone painted next to the
// ring, through the editor's "Play this map" path (`?map=edited`). Run against `npx vite --port 5199`:
//   node docs/reviews/wind-zones/src/capture.cjs
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = path.join(__dirname, '..');
const map = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../../src/data/phase1-map.json')));

// An oval of doldrums in the open water east of the middle (where 0140's mockup sat).
const outline = [];
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  outline.push([Math.round(262 + Math.cos(a) * 62), Math.round(-12 + Math.sin(a) * 44)]);
}
map.windZones = [{ id: 'glass-calm', name: 'The Glass', kind: 'doldrums', outline }];

const SHOTS = [
  // name, w, h, boat x, y, zones on
  ['doldrums-desktop', 1280, 720, 200, 10, true],
  ['doldrums-portrait', 390, 844, 230, -6, true],
  ['doldrums-off-desktop', 1280, 720, 200, 10, false],
];

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  for (const [name, w, h, x, y, on] of SHOTS) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.addInitScript(
      ([m, on]) => {
        localStorage.setItem('fwt.editor.map.v1', m);
        localStorage.setItem(
          'fwt.settings.v1',
          JSON.stringify({
            seenWindHint: true,
            tutorialOffered: true,
            language: 'en',
            dayNight: false,
            windZones: on,
          }),
        );
      },
      [JSON.stringify(map), on],
    );
    await p.goto('http://localhost:5199/?debug&map=edited');
    await p.waitForTimeout(1500);
    await p.click('#menu-play', { timeout: 2000 }).catch(() => {});
    await p.waitForTimeout(500);
    await p.click('#set-sail', { timeout: 2000 }).catch(() => {});
    await p.waitForTimeout(800);
    await p.keyboard.press('Escape');
    await p.click('#tp-undock', { timeout: 1500 }).catch(() => {});
    await p.waitForTimeout(300);
    await p.evaluate(
      ([x, y]) => {
        const { world } = window.fwt;
        world.time = 260;
        world.boat.x = x;
        world.boat.y = y;
        world.boat.heading = (world.seaWind.from + Math.PI / 2) % (Math.PI * 2);
        window.fwt.view.setZoom?.(0.8);
        world.boat.sailStep = 2;
        world.boat.sail = 1;
      },
      [x, y],
    );
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(OUT, `${name}.png`) });
    await p.close();
  }
  await b.close();
})();
