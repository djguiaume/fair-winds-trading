/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, document, sessionStorage, localStorage, location, fwt, console */
// Screenshots and an end-to-end check of "Move your voyage" (decision 0066). From the repo root:
// node docs/ui-refactor/transfer/capture.cjs
// Device A shows its voyage as a QR code. That QR is fed to device B as a fake camera, B scans
// it with the game's own scanner, confirms, and must reload into A's voyage.
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const root = process.cwd();
const out = root + '/docs/ui-refactor/transfer/built';
const tmp = fs.mkdtempSync(require('node:os').tmpdir() + '/fwt-transfer-');
const URL = 'http://127.0.0.1:5196/';
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const GL = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const SIZES = {
  landscape: { viewport: { width: 844, height: 390 }, touch: true },
  portrait: { viewport: { width: 390, height: 844 }, touch: true },
  desktop: { viewport: { width: 1280, height: 720 }, touch: false },
};
const errors = [];

async function open(browser, size, lang, voyage) {
  const { viewport, touch } = SIZES[size];
  const page = await browser.newPage({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => errors.push(`${size}: ${e.message}`));
  await page.addInitScript((lang) => {
    if (location.protocol !== 'http:' || sessionStorage.getItem('x')) return;
    sessionStorage.setItem('x', '1');
    localStorage.clear();
    localStorage.setItem(
      'fwt.settings.v1',
      JSON.stringify({ quality: 'low', language: lang, seenWindHint: true, seenHelp: true, musicVolume: 0 }),
    );
  }, lang);
  await page.goto(URL + '?debug');
  await page.addStyleTag({ content: '#shift-wind{display:none!important}' });
  await page.waitForFunction(() => document.getElementById('menu') && !document.getElementById('menu').hidden);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((v) => {
    const c = fwt.world.trade.captain;
    c.gold = v.gold;
    Object.assign(c.ships, v.ships);
    c.activeShip = v.active;
    Object.assign(c.cargo, v.cargo);
    fwt.world.time = v.time;
    fwt.world.ship = fwt.trade.activeShip(fwt.world.trade);
  }, voyage);
  return page;
}
const tap = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
const shot = async (page, name) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${out}/${name}.png` });
};

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { createServer } = await import(root + '/node_modules/vite/dist/node/index.js');
  const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 5196 } });
  await server.listen();

  // --- Device A: a voyage some way in, shown as a QR code -----------------------------------
  const browserA = await chromium.launch({ executablePath: CHROME, args: GL });
  const voyageA = {
    gold: 2480,
    ships: { cutter: { sails: 2, hold: 2, hull: 1 } },
    active: 'cutter',
    cargo: { timber: 14, planks: 6 },
    time: 83 * 60,
  };
  for (const [size, lang] of [
    ['landscape', 'en'],
    ['desktop', 'en'],
    ['portrait', 'fr'],
  ]) {
    const a = await open(browserA, size, lang, voyageA);
    await tap(a, '#menu-play');
    await tap(a, '#tutorial-free');
    await tap(a, '#menu-btn');
    await shot(a, `01-menu-${size}`);
    await tap(a, '#menu-transfer');
    await shot(a, `02-send-${size}`);
    if (size === 'landscape') await a.locator('#transfer-qr svg').screenshot({ path: `${tmp}/qr.png` });
    await tap(a, '#transfer-tab-receive');
    await a.fill('#transfer-paste', 'FW1eJzLSM3JyVcozy/KSQEAGgQEXQ');
    await tap(a, '#transfer-load');
    await shot(a, `03-receive-error-${size}`);
    await a.close();
  }
  await browserA.close();

  // The QR as a fake camera: grey surround, as if held up in front of the lens.
  execFileSync('ffmpeg', [
    '-loglevel', 'error', '-y', '-loop', '1', '-i', `${tmp}/qr.png`, '-t', '3',
    '-vf', 'scale=420:420,pad=640:480:110:30:color=0x777777,format=yuv420p', `${tmp}/qr.y4m`,
  ]);

  // --- Device B: its own short voyage; scans A's code and takes it --------------------------
  const browserB = await chromium.launch({
    executablePath: CHROME,
    args: [...GL, '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${tmp}/qr.y4m`],
  });
  const voyageB = { gold: 310, ships: {}, active: 'sloop', cargo: { fish: 4 }, time: 12 * 60 };
  for (const [size, lang] of [
    ['portrait', 'en'],
    ['landscape', 'fr'],
    ['desktop', 'en'],
  ]) {
    const b = await open(browserB, size, lang, voyageB);
    await tap(b, '#menu-transfer');
    await tap(b, '#transfer-tab-receive');
    await tap(b, '#scan-start');
    await b.waitForFunction(() => !document.getElementById('transfer-confirm').hidden, null, { timeout: 15000 });
    await shot(b, `04-confirm-${size}`);
    if (size === 'portrait') {
      await tap(b, '#transfer-replace');
      await b.waitForLoadState('load');
      await b.waitForFunction(() => typeof fwt !== 'undefined');
      const gold = await b.evaluate(() => fwt.world.trade.captain.gold);
      if (gold !== voyageA.gold) errors.push(`after replace, gold is ${gold}, expected ${voyageA.gold}`);
      else console.log('scan → confirm → replace: device B now has device A voyage');
    }
    await b.close();
  }

  // --- A link opened by a phone camera app goes straight to the question --------------------
  const c = await open(browserB, 'landscape', 'en', voyageB);
  const link = await c.evaluate(async (v) => {
    const t = await import('/src/sim/saveTransfer.ts');
    const s = await import('/src/sim/save.ts');
    const save = s.serializeWorld(fwt.world);
    Object.assign(save, { gold: v.gold, activeShip: v.active, time: v.time });
    save.ships = { sloop: save.ships.sloop, ...v.ships };
    return t.transferLink(location.origin + '/', t.encodeSaveCode(save));
  }, voyageA);
  await c.goto('about:blank');
  await c.goto(link.replace('/#', '/?debug#'));
  await c.waitForFunction(() => !document.getElementById('transfer-confirm').hidden);
  if (!(await c.evaluate(() => location.hash === ''))) errors.push('code left in the address bar');
  await shot(c, '05-camera-app-link-landscape');
  await browserB.close();
  await server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
})();
