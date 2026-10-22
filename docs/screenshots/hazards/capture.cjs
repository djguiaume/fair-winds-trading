/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, window, localStorage */
// Hazard markers (decision 0070): the storm on the chart, its legend entry and its warning toast.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = process.env.OUT ?? './';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [name, w, h, mode] of [['built', 1280, 720, 'chart'], ['built-portrait', 390, 844, 'chart'], ['built-legend', 1280, 720, 'legend'], ['built-toast', 1280, 720, 'toast'], ['built-fr', 1280, 720, 'fr']]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.addInitScript((lang) => { localStorage.setItem('fwt.settings.v1', JSON.stringify({ seenWindHint: true, tutorialOffered: true, language: lang })); }, mode === 'fr' ? 'fr' : 'en');
    await p.goto('http://localhost:5199/?debug'); await p.waitForTimeout(1500);
    await p.click('#menu-play').catch(() => {}); await p.waitForTimeout(800); await p.keyboard.press('Escape');
    await p.evaluate(() => { const w = window.fwt.world; w.time = 1650; w.boat.x = 250; w.boat.y = -60; w.boat.heading = 3.6; window.fwt.view.target.set(250, 0, 60); });
    await p.waitForTimeout(1500);
    if (mode === 'toast') {
      await p.evaluate(() => { const w = window.fwt.world; w.stormsWarned = []; w.boat.x = 186; w.boat.y = -32; window.fwt.view.target.set(186, 0, 32); });
      await p.waitForTimeout(700);
    } else {
      await p.click('#chart-btn'); await p.waitForTimeout(1200);
      if (mode === 'legend') { await p.click('#chart-legend-toggle'); await p.waitForTimeout(500); }
    }
    await p.screenshot({ path: OUT + name + '.png' });
    await p.close();
  }
  await b.close();
})();
