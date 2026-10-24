/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, window, document, localStorage */
// South sea screenshots (ADR 0152): real captures of the Phase 4 sea, `?map=phase4`. Run against
// `npx vite --port 5199`:   node docs/reviews/south-sea/src/capture.cjs [name ...]
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = process.env.OUT ?? path.join(__dirname, '..');
const URL = 'http://localhost:5199/?map=phase4&debug';

// name, width, height, what: chart | sea {x, y, zoom, heading, ship}
const SHOTS = [
  ['chart-desktop', 1280, 800, { chart: true }],
  ['chart-portrait', 390, 844, { chart: true }],
  ['sunreach-desktop', 1280, 800, { x: -60, y: -735, zoom: 4.2, boat: [-104, -700, 95] }],
  ['sunreach-town', 1280, 800, { x: -96, y: -640, zoom: 1.7, boat: [-104, -705, 20] }],
  ['sunreach-tea-gardens', 1280, 800, { x: -40, y: -862, zoom: 1.55, boat: [-20, -800, 200] }],
  ['sunreach-west-entrance', 1280, 800, { x: -230, y: -700, zoom: 2.2, boat: [-300, -690, 100] }],
  ['sunreach-landscape', 844, 390, { x: -60, y: -735, zoom: 4.2, boat: [-104, -700, 95] }],
  ['sunreach-portrait', 390, 844, { x: -60, y: -735, zoom: 2.6, boat: [-104, -700, 95] }],
  ['keepers-passage', 1280, 800, { x: 150, y: -500, zoom: 3.2, boat: [146, -470, 175] }],
  ['narrows-sloop', 1280, 800, { x: 335, y: -742, zoom: 2.0, boat: [352, -745, 250], ship: 'sloop' }],
  ['narrows-indiaman', 1280, 800, { x: 335, y: -742, zoom: 2.0, boat: [300, -742, 90], ship: 'indiaman', push: true }],
  ['the-glass', 1280, 800, { x: 520, y: -520, zoom: 3.6, boat: [400, -470, 120] }],
  ['deep-channel', 1280, 800, { x: 335, y: -870, zoom: 1.6, boat: [300, -878, 90], ship: 'indiaman' }],
  ['cardinals-lineup', 1280, 800, { x: 245, y: -523, zoom: 0.7, boat: [222, -536, 60] }],
  ['cardinal-north', 1280, 800, { x: 320, y: -545, zoom: 1.2, boat: [300, -515, 100] }],
  ['cardinal-south', 1280, 800, { x: 333, y: -855, zoom: 1.2, boat: [310, -880, 90] }],
  ['palm-key', 1280, 800, { x: 505, y: -735, zoom: 1.4, boat: [420, -770, 80] }],
  ['lone-palm', 1280, 800, { x: -470, y: -665, zoom: 1.0, boat: [-450, -650, 250] }],
  ['wreck-reef', 1280, 800, { x: 556, y: -330, zoom: 1.6, boat: [520, -300, 120] }],
  ['sugar-bar', 1280, 800, { x: -505, y: -400, zoom: 2.0, boat: [-460, -360, 230] }],
];

async function start(p) {
  await p.goto(URL);
  await p.evaluate(() => localStorage.clear());
  await p.goto(URL);
  await p.waitForSelector('#menu-play');
  await p.click('#menu-play');
  const sail = await p.waitForSelector('#set-sail', { timeout: 5000 }).catch(() => null);
  if (sail) await sail.click();
  await p.waitForTimeout(800);
  // Skip the tutorial's prologue if it opened.
  await p.evaluate(() => {
    const t = window.fwt.tutorial;
    if (t?.skip) t.skip();
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
  });
}

async function shoot(browser, [name, w, h, what]) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await start(p);
  await p.evaluate((what) => {
    const { world, view } = window.fwt;
    world.time = 300;
    world.dynamicWeather = false;
    world.storms = false;
    if (what.ship) {
      world.trade.captain.ships[what.ship] ??= structuredClone(world.trade.captain.ships.sloop);
      world.trade.captain.activeShip = what.ship;
    }
    if (what.boat) {
      const [x, y, deg] = what.boat;
      world.boat.x = x;
      world.boat.y = y;
      world.boat.heading = (deg * Math.PI) / 180;
      world.boat.speedKn = 5;
      world.boat.sailStep = 2;
    }
    if (what.x !== undefined) {
      view.focus = { x: what.x, y: what.y };
      view.zoom = what.zoom;
    }
    for (const id of ['menu', 'help']) document.getElementById(id)?.setAttribute('hidden', '');
  }, what);
  if (what.push) {
    // Sail the deep ship into the passage for a few seconds so the shallows refuse her.
    await p.keyboard.down('ArrowUp');
    await p.waitForTimeout(2500);
    await p.keyboard.up('ArrowUp');
  } else await p.waitForTimeout(1500);
  // Quest cards that popped up meanwhile (the prologue's) would cover the view.
  await p.evaluate(() => {
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
  });
  if (what.chart) {
    await p.evaluate(() => {
      for (const d of document.querySelectorAll('dialog[open]')) d.close();
      document.getElementById('chart-btn').click();
    });
    await p.waitForTimeout(800);
  }
  await p.screenshot({ path: path.join(OUT, `${name}.png`) });
  await p.close();
  console.log('shot', name);
}

(async () => {
  const only = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  for (const s of SHOTS) if (!only.length || only.includes(s[0])) await shoot(browser, s);
  await browser.close();
})();
