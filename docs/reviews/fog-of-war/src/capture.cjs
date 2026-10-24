/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, window, document, localStorage */
// Fog of war screenshots (ADR 0155): real captures of the Phase 4 sea, `?map=phase4`, in each
// proposed look (`&fog=a|b|c`, review only; the game draws A since). Run against `npx vite --port 5199`:
//   node docs/reviews/fog-of-war/src/capture.cjs [name ...]
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = process.env.OUT ?? path.join(__dirname, '..');
const STYLES = (process.env.STYLES ?? 'final').split(',');

// Mid-voyage: Old Ness's chart gave the Coral Line and Sunreach Sound, and she sailed past Lone
// Palm, so that island alone is charted in the Sugar Bar area. Palm Key Narrows is still fogged.
const MID = { areas: ['coral-line', 'sunreach-waters'], sighted: ['lone-palm'] };
// name, width, height, what
const SHOTS = [
  ['chart-start-desktop', 1280, 800, { chart: true, progress: {}, boat: [140, -380, 170] }],
  ['chart-desktop', 1280, 800, { chart: true, progress: MID, boat: [-104, -700, 95] }],
  ['chart-portrait', 390, 844, { chart: true, progress: MID, boat: [-104, -700, 95] }],
  ['chart-zoomed', 1280, 800, { chart: true, progress: MID, boat: [150, -640, 110], chartZoom: 2 }],
];
// At sea, the same for every look: sailing into Palm Key Narrows charts it, with a toast.
const SEA = [
  ['sea-charted-desktop', 1280, 800, { progress: MID, boat: [236, -655, 120], x: 240, y: -680, zoom: 2.2 }],
  ['sea-charted-portrait', 390, 844, { progress: MID, boat: [236, -655, 120], x: 240, y: -680, zoom: 1.6 }],
];

async function start(p, style) {
  const url = `http://localhost:5199/?map=phase4&debug&fog=${style}`;
  await p.goto(url);
  await p.evaluate(() => localStorage.clear());
  await p.goto(url);
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

async function shoot(browser, style, [name, w, h, what]) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await start(p, style);
  await p.evaluate((what) => {
    const { world, view } = window.fwt;
    world.time = 300;
    world.dynamicWeather = false;
    world.storms = false;
    const pr = world.trade.progress;
    pr.areas = [...(what.progress.areas ?? [])];
    pr.sighted = [...(what.progress.sighted ?? [])];
    if (what.progress.areas) pr.zones = ['sunreach-sound', 'the-trades'];
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
  // At sea, sail on into the fogged area until it is charted.
  await p.waitForTimeout(what.chart ? 600 : 1200);
  await p.evaluate(() => {
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
  });
  if (what.chart) {
    await p.evaluate((what) => {
      const pr = window.fwt.world.trade.progress;
      pr.areas = [...(what.progress.areas ?? [])];
      pr.sighted = [...(what.progress.sighted ?? [])];
      document.getElementById('chart-btn').click();
    }, what);
    await p.waitForTimeout(800);
    for (let i = 0; i < (what.chartZoom ?? 0); i++) {
      await p.click('#chart-zoom-in');
      await p.waitForTimeout(200);
    }
    await p.waitForTimeout(300);
    await p.evaluate(() => document.getElementById('chart-journal-panel')?.setAttribute('hidden', ''));
  }
  const file = what.chart ? `${style}-${name}.png` : `${name}.png`;
  await p.screenshot({ path: path.join(OUT, file) });
  await p.close();
  console.log('shot', file);
}

(async () => {
  const only = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  for (const style of STYLES)
    for (const s of SHOTS) if (!only.length || only.includes(s[0])) await shoot(browser, style, s);
  for (const s of SEA) if (!only.length || only.includes(s[0])) await shoot(browser, 'final', s);
  await browser.close();
})();
