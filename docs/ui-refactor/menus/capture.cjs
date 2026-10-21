/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, document, MouseEvent, sessionStorage, localStorage, fwt, console */
// Screenshots of the built menus and coach marks (decision 0061). Run from the repo root:
// node docs/ui-refactor/menus/capture.cjs [landscape,desktop,portrait]
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
const root = process.cwd();
const out = root + '/docs/ui-refactor/menus/built';
const only = process.argv[2] || '';
(async () => {
  require('node:fs').mkdirSync(out, { recursive: true });
  const { createServer } = await import(root + '/node_modules/vite/dist/node/index.js');
  const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 5195 } });
  await server.listen();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  for (const [size, width, height, lang] of [
    ['landscape', 844, 390, 'en'],
    ['desktop', 1280, 720, 'en'],
    ['portrait', 390, 844, 'fr'],
  ]) {
    if (only && !only.split(',').includes(size)) continue;
    const touch = size !== 'desktop';
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
    page.on('pageerror', (e) => errors.push(`${size}: ${e.message}`));
    await page.addInitScript((lang) => {
      if (sessionStorage.getItem('x')) return;
      sessionStorage.setItem('x', '1');
      localStorage.clear();
      localStorage.setItem('fwt.settings.v1', JSON.stringify({ quality: 'low', language: lang, seenWindHint: true, musicVolume: 0.6 }));
    }, lang);
    // ?debug exposes fwt for docking; its Shift-the-wind button is hidden from the shots.
    await page.goto('http://127.0.0.1:5195/?debug');
    await page.addStyleTag({ content: '#shift-wind{display:none!important}' });
    await page.waitForFunction(() => document.getElementById('menu') && !document.getElementById('menu').hidden);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const shot = async (name) => {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/${name}-${size}.jpg`, quality: 80 });
    };
    const tap = (sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
    await shot('01-menu');
    await tap('#menu-settings');
    await shot('05-settings');
    await tap('#close-settings');
    await tap('#menu-help');
    await shot('06-help');
    await tap('#start');
    await tap('#menu-play');
    await shot('02-offer');
    await tap('#tutorial-start');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await shot('03-coach-map');
    await tap('#menu-btn');
    await shot('04-pause');
    await tap('#menu-play');
    await tap('#chart-btn');
    await shot('07-coach-port');
    await page.evaluate(() => {
      const port = document.querySelector('.chart-port-target');
      port.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await tap('#close-chart');
    await shot('08-coach-sails');
    await tap('#tutorial-continue');
    await shot('09-coach-wind');
    await tap('#tutorial-action');
    await shot('11-wind-help');
    await tap('#close-wind-help');
    await page.waitForTimeout(300);
    await tap('#tutorial-continue');
    await page.waitForTimeout(300);
    // Dock at the chosen harbour: the boat is put at its pier and the sails come down.
    await page.evaluate(() => {
      const id = fwt.world.destination.portId;
      const h = fwt.view.harbours[id];
      Object.assign(fwt.world.boat, { x: h.x, y: h.y, speedKn: 0 });
    });
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(2500);
    await shot('10-coach-buy');
    await page.close();
  }
  await browser.close();
  await server.close();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
