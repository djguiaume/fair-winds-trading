/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, localStorage, window, document, fwt, requestAnimationFrame, getComputedStyle, console */
const { chromium } = require('playwright');
const fs = require('node:fs');
const root = process.cwd();
(async () => {
  const { createServer } = await import(root + '/node_modules/vite/dist/node/index.js');
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 5184 } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const dir = root + '/docs/screenshots/overlay-navigation';
  fs.mkdirSync(dir, { recursive: true });
  const errors = [], results = [];
  try {
    for (const quality of ['low', 'medium', 'high']) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(q => localStorage.setItem('fwt.settings.v1', JSON.stringify({ quality: q, seenHelp: true, seenWindHint: true, musicVolume: 0, language: 'en' })), quality);
      await page.goto('http://127.0.0.1:5184/?debug');
      await page.waitForFunction(() => window.fwt);
      await page.click('#menu-play');
      if (await page.locator('#tutorial-offer').evaluate(e => e.open)) await page.click('#tutorial-free');
      // Keep simulation paused through the real menu; the debug camera still renders.
      // Hide only the menu for an unobscured, stationary screenshot of the real engine/HUD.
      await page.click('#menu-btn');
      await page.evaluate(() => {
        document.getElementById('menu').hidden = true;
        document.body.classList.remove('in-menu');
        const { world, view } = fwt;
        const island = world.map.islands.find(i => i.id === 'south-cay');
        Object.assign(world.boat, { x: island.x + 35, y: island.y + 35, speedKn: 0, sail: 1, sailStep: 2, heading: 2.4 });
        world.trade.dockedAt = null;
        world.destination = null;
        view.render(10);
      });
      await page.waitForTimeout(200);
      const visible = await page.locator('.port-marker:not([hidden])').count();
      if (!visible) throw new Error('No visible pier marker');
      await page.screenshot({ path: dir + '/port-label-' + quality + '.png' });
      const motion = await page.evaluate(async () => {
        const { world, view } = fwt;
        const marker = document.querySelector('.port-marker:not([hidden])');
        const before = marker.style.transform;
        world.boat.x += 0.5;
        view.render(1 / 60);
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        return { before, after: marker.style.transform, willChange: getComputedStyle(marker).willChange, contain: getComputedStyle(marker).contain };
      });
      if (motion.before === motion.after) throw new Error('Pier marker did not move');
      // Far south target lies behind the perspective camera: direct projection points north.
      await page.evaluate(() => {
        const { world, view } = fwt;
        Object.assign(world.boat, { x: 225, y: -60, speedKn: 0 });
        view.render(10);
        world.destination = { portId: 'calda', label: 'Port Calda', x: 100, y: 300 };
      });
      await page.waitForTimeout(100);
      const bearing = await page.evaluate(async () => {
        const { world, view } = fwt;
        const target = view.harbours['watchman-key'];
        world.destination = { portId: 'watchman-key', label: 'Watchman Key', ...target };
        // One HUD update, on the very next animation frame.
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        const arrow = document.getElementById('obj-arrow');
        const edge = document.getElementById('wp-arrow');
        const rotation = Number(arrow.style.transform.match(/rotate\((.*)rad/)[1]);
        return { target, name: document.getElementById('obj-name').textContent, rotation, pointsSouth: Math.cos(rotation) < 0, edgeVisible: !edge.hidden, edgeRotation: edge.firstElementChild.style.transform, originalProjection: view.project(target.x, target.y), boatProjection: view.project(world.boat.x, world.boat.y), calls: view.renderer.info.render.calls, triangles: view.renderer.info.render.triangles };
      });
      if (bearing.name !== 'Watchman Key' || !bearing.pointsSouth || !bearing.edgeVisible) throw new Error(JSON.stringify(bearing));
      await page.screenshot({ path: dir + '/watchman-bearing-' + quality + '.png' });
      results.push({ quality, visibleMarkers: visible, motion, bearing });
      await page.close();
    }
    fs.writeFileSync(dir + '/browser-checks.json', JSON.stringify({ errors, results }, null, 2) + '\n');
    console.log(JSON.stringify({ errors, results }, null, 2));
    if (errors.length) throw new Error('Browser errors');
  } finally { await browser.close(); await server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
