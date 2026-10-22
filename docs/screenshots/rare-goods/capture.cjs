/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, window, localStorage, fwt, console */
// Rare goods from the far yards (decision 0065): Abbey Head grows and makes honey, sells it, and
// Saltmere waits for honey before it can become a port town. Run from the repo root:
// node docs/screenshots/rare-goods/capture.cjs
const { chromium } = require('playwright');
const root = process.cwd();
(async () => {
  const { createServer } = await import(root + '/node_modules/vite/dist/node/index.js');
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 5194 } });
  await server.listen();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const dir = root + '/docs/screenshots/rare-goods';
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
      await page.goto('http://127.0.0.1:5194/?debug');
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
      // Abbey Head, found and fed, grows into a village: its honey goes on sale.
      await page.evaluate(() => {
        const w = fwt.world;
        w.trade.progress.discovered.push('abbey-head');
        const island = w.map.islands.find((i) => i.id === 'abbey-head');
        w.boat.x = island.x + island.radius + 25;
        w.boat.y = island.y;
        w.boat.speedKn = 0;
        w.boat.sailStep = 0;
        w.trade.settlements.byPort['abbey-head'].growth = 45;
      });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${dir}/abbey-head-honey-toast-${name}.png` });
      await dockAt('abbey-head', `w.trade.captain.gold = 3000;`);
      await page.waitForSelector('.port-screen');
      await page.screenshot({ path: `${dir}/abbey-head-sells-honey-${name}.png` });
      await page.click('#tp-close');
      // Saltmere, a town at full growth, has had 12 honey of the 20 it needs to become a port town.
      await dockAt(
        'saltmere',
        `const s = w.trade.settlements.byPort.saltmere; s.level = 3; s.growth = 350; s.rare = 12; w.trade.captain.cargo.honey = 6;`,
      );
      await page.waitForSelector('.port-screen');
      await page.screenshot({ path: `${dir}/saltmere-needs-honey-${name}.png` });
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
