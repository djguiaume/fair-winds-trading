/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, window, localStorage, fwt, console */
// Settlement levels (decision 0059) and specialized goods (0063): port screen captures with the
// town's size tag, its wants, the home-port upgrade gate and a workshop's specialty on sale. Run from the repo root: node docs/screenshots/settlements/capture.cjs
const { chromium } = require('playwright');
const root = process.cwd();
(async () => {
  const { createServer } = await import(root + '/node_modules/vite/dist/node/index.js');
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 5193 } });
  await server.listen();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const dir = root + '/docs/screenshots/settlements';
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
      await page.goto('http://127.0.0.1:5193/?debug');
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
      // Saltmere, the home port, as a village: the top upgrades wait for it to grow.
      await dockAt('saltmere', `w.trade.captain.gold = 5000; w.trade.captain.ships.sloop.hold = 2; w.trade.settlements.byPort.saltmere.growth = 60;`);
      await page.waitForSelector('.port-screen');
      await page.click('#tp-tab-shipyard');
      await page.screenshot({ path: `${dir}/home-village-${name}.png` });
      await page.click('#tp-close');
      // Port Calda grows into a town: a level-up toast, then it wants grain too.
      await page.evaluate(() => {
        fwt.world.trade.dockedAt = null;
        fwt.world.boat.x = 0; fwt.world.boat.y = -400;
        fwt.world.trade.settlements.byPort.calda.growth = 200;
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${dir}/level-up-toast-${name}.png` });
      // The island grows with the town (decision 0060): Calda as a town, seen from the sea.
      await page.evaluate(() => {
        const w = fwt.world;
        const island = w.map.islands.find((i) => i.id === 'calda');
        w.boat.x = island.x + island.radius + 25;
        w.boat.y = island.y;
        w.boat.speedKn = 0;
        w.boat.sailStep = 0;
      });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${dir}/calda-town-island-${name}.png` });
      await dockAt('calda');
      await page.waitForSelector('.port-screen');
      await page.screenshot({ path: `${dir}/calda-town-${name}.png` });
      await page.click('#tp-close');
      // Specialized goods (decision 0063): Saltmere now buys Calda's planks.
      await page.evaluate(() => {
        fwt.world.trade.captain.cargo.planks = 5;
      });
      await dockAt('saltmere');
      await page.waitForSelector('.port-screen');
      await page.screenshot({ path: `${dir}/saltmere-buys-planks-${name}.png` });
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
