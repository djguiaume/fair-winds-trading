/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, window, document, localStorage */
// Founding screenshots (ADR 0155): Palm Key before founding and at each outpost level, on the
// south sea (`?map=phase4`). Run against `npx vite --port 5199`:
//   node docs/reviews/founding/src/capture.cjs [name ...]
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = process.env.OUT ?? path.join(__dirname, '..');
const URL = 'http://localhost:5199/?map=phase4&debug';

// name, width, height, { level (0 = not founded), x, y, zoom, boat: [x, y, heading], chart }
const SHOTS = [
  ['palm-key-site', 1280, 800, { level: 0, x: 505, y: -733, zoom: 1.2, boat: [440, -770, 180] }],
  ['palm-key-founded', 1280, 800, { level: 1, x: 505, y: -733, zoom: 1.2, boat: [440, -770, 180] }],
  ['palm-key-village', 1280, 800, { level: 2, x: 505, y: -733, zoom: 1.2, boat: [440, -770, 180] }],
  ['palm-key-town', 1280, 800, { level: 3, x: 505, y: -733, zoom: 1.2, boat: [440, -770, 180] }],
  ['palm-key-close', 1280, 800, { level: 1, x: 495, y: -735, zoom: 0.7, boat: [476, -742, 180] }],
  ['palm-key-landscape', 844, 390, { level: 1, x: 505, y: -733, zoom: 1.2, boat: [440, -770, 180] }],
  ['palm-key-portrait', 390, 844, { level: 1, x: 505, y: -733, zoom: 1.0, boat: [440, -770, 180] }],
  ['chart-site', 1280, 800, { level: 0, chart: true, chartZoom: 2, pan: [['ArrowRight', 10], ['ArrowDown', 6]], boat: [440, -745, 180] }],
  ['chart-founded', 1280, 800, { level: 1, chart: true, chartZoom: 2, pan: [['ArrowRight', 10], ['ArrowDown', 6]], boat: [440, -745, 180] }],
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
    const { world, view, hud } = window.fwt;
    world.time = 300;
    world.dynamicWeather = false;
    world.storms = false;
    const trade = world.trade;
    if (what.level > 0) {
      // As the founding reward does (decision 0155), then grown to the level shown.
      if (!trade.progress.discovered.includes('palm-key')) trade.progress.discovered.push('palm-key');
      trade.settlements.byPort['palm-key'].level = what.level;
    }
    const levels = {};
    for (const [id, s] of Object.entries(trade.settlements.byPort)) levels[id] = s.level;
    if (what.level === 0) levels['palm-key'] = 0;
    view.setSettlementLevels(levels);
    hud?.portLabels?.rebuild?.();
    const [x, y, deg] = what.boat;
    world.boat.x = x;
    world.boat.y = y;
    world.boat.heading = (deg * Math.PI) / 180;
    world.boat.speedKn = 5;
    world.boat.sailStep = 2;
    if (what.x !== undefined) {
      view.focus = { x: what.x, y: what.y };
      view.zoom = what.zoom;
    }
    for (const id of ['menu', 'help']) document.getElementById(id)?.setAttribute('hidden', '');
  }, what);
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
  });
  if (what.chart) {
    await p.evaluate(() => document.getElementById('chart-btn').click());
    await p.waitForTimeout(800);
    for (let i = 0; i < what.chartZoom; i++) {
      await p.click('#chart-zoom-in');
      await p.waitForTimeout(200);
    }
    for (const [key, n] of what.pan ?? []) {
      await p.focus('#chart-map');
      for (let i = 0; i < n; i++) await p.keyboard.press(key);
    }
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('#chart-journal-close, .journal-close')?.click());
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
