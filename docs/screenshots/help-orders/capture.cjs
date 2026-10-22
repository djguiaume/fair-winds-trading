/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, window, localStorage, fwt, console */
// Help orders (decision 0069): the home port, Saltmere, holds back a level 3 upgrade and asks for
// help; its order pays extra and grows it twice as fast. Run from the repo root:
// node docs/screenshots/help-orders/capture.cjs
const { chromium } = require('playwright');
const root = process.cwd();
(async () => {
  const { createServer } = await import(root + '/node_modules/vite/dist/node/index.js');
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 5195 } });
  await server.listen();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const dir = root + '/docs/screenshots/help-orders';
  const errors = [];
  try {
    for (const [name, width, height, language] of [
      ['landscape', 1280, 720, 'en'],
      ['landscape-fr', 844, 390, 'fr'],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript((language) => {
        localStorage.clear();
        localStorage.setItem('fwt.settings.v1', JSON.stringify({ quality: 'low', language, seenHelp: true, seenWindHint: true, musicVolume: 0 }));
      }, language);
      await page.goto('http://127.0.0.1:5195/?debug');
      await page.waitForFunction(() => window.fwt);
      await page.click('#menu-play');
      if (await page.locator('#tutorial-offer').evaluate((e) => e.open)) await page.click('#tutorial-free');
      const dockAt = (id, before) =>
        page.evaluate(([id, before]) => {
          const w = fwt.world;
          if (before) new Function('w', before)(w);
          const port = w.map.ports.find((p) => p.id === id);
          const island = w.map.islands.find((i) => i.id === port.islandId);
          w.trade.dockedAt = null;
          w.boat.x = island.x + island.radius + 6;
          w.boat.y = island.y;
          w.boat.speedKn = 0;
          w.boat.sailStep = 0;
        }, [id, before]);
      // A sloop with a level 2 hold: the next hold upgrade needs Saltmere to be a town.
      await page.evaluate(() => {
        const w = fwt.world;
        w.trade.captain.ships.sloop.hold = 2;
        w.boat.x = 0;
        w.boat.y = -400;
      });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${dir}/help-toast-${name}.png` });
      await dockAt('saltmere', `const o = w.trade.contracts.byPort.saltmere; w.trade.captain.cargo[o.good] = o.qty;`);
      await page.waitForSelector('.port-screen');
      await page.screenshot({ path: `${dir}/saltmere-help-order-${name}.png` });
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  if (errors.length) {
    console.error(errors);
    process.exit(1);
  }
  console.log('captured');
})();
