/* Run from the repository root with playwright available. CHROMIUM_PATH optionally selects a local browser. */
const { chromium } = require('playwright');
const { writeFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 5179 } });
  await server.listen();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const dir = path.join(process.cwd(), 'docs/art/game-models/refined-clipper');
  mkdirSync(dir, { recursive: true });
  const results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const cases = [
      ['level1-high', 'level=1&quality=high'],
      ['level2-high', 'level=2&quality=high'],
      ['level3-high', 'level=3&quality=high'],
      ['level3-medium', 'level=3&quality=medium'],
      ['level3-low', 'level=3&quality=low'],
      ['level3-reefed', 'level=3&quality=high&sail=0.35&boom=-45'],
      ['level3-stern', 'level=3&quality=high&yaw=-45'],
      ['mixed-upgrades', 'hull=1&hold=3&sails=2&quality=medium'],
      ['furled-low', 'level=3&quality=low&sail=0&boom=-45'],
    ];
    for (const [name, query] of cases) {
      errors = [];
      await page.goto(`http://127.0.0.1:5179/models.html?view=clipper&still&${query}`);
      await page.waitForFunction(() => document.querySelector('#stats').textContent.includes('triangles'));
      await page.screenshot({ path: path.join(dir, `${name}.png`) });
      results.push({ name, query, stats: await page.locator('#stats').textContent(), errors: [...errors] });
    }
    results.push({ name: 'model-budgets', stats: await page.evaluate(async () => {
      const { shipModel } = await import('/src/render/models/shipModels.ts');
      const { StorybookBoat, BOAT_CLASSES } = await import('/src/render/models/storybookBoat.ts');
      return [1, 2, 3].map(level => {
        const upgrades = { sails: level, hold: level, hull: level };
        const refined = shipModel('clipper', { upgrades });
        const previous = new StorybookBoat(BOAT_CLASSES.clipper, upgrades);
        const result = { level, refined: refined.stats, previous: previous.stats };
        refined.dispose(); previous.dispose();
        return result;
      });
    }), errors: [] });
    for (const quality of ['low', 'medium', 'high']) {
      errors = [];
      await page.addInitScript(q => localStorage.setItem('fwt.settings.v1', JSON.stringify({ quality: q, seenHelp: true, seenWindHint: true, language: 'en', musicVolume: 0 })), quality);
      await page.goto('http://127.0.0.1:5179/?debug');
      await page.waitForFunction(() => Boolean(window.fwt));
      // The existing debug interface drives the real GameView. No scene/model substitution.
      const stats = await page.evaluate(async quality => {
        const {world, view, trade} = window.fwt;
        world.trade.captain.ships.clipper = { sails: 3, hold: 3, hull: 3 };
        world.trade.captain.activeShip = 'clipper';
        world.ship = trade.activeShip(world.trade);
        world.trade.dockedAt = null;
        world.boat.sail = 1;
        world.boat.speedKn = 7;
        world.boat.heading = Math.PI / 3;
        view.setQuality(quality);
        view.setZoom(0.7);
        const draw = view.renderer.render;
        view.renderer.render = () => {};
        for (let i=0;i<360;i++) {
          world.time = 30 + i/60;
          world.boat.x = 80 + i * 0.04;
          world.boat.y = 60 + i * 0.025;
          view.render(1/60);
        }
        view.renderer.render = draw;
        const play = document.querySelector('#menu-play');
        if (play) play.click();
        for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
        view.render(0);
        const r = view.renderer;
        return { calls: r.info.render.calls, triangles: r.info.render.triangles, geometries: r.info.memory.geometries,
          profile: view.level, boat: view.boat.stats, hull: view.boat.wakeHull,
          wakeDrawVertices: view.wake.mesh.geometry.drawRange.count,
          drawingBuffer: {width:r.domElement.width,height:r.domElement.height} };
      }, quality);
      await page.screenshot({ path: path.join(dir, `game-${quality}.png`) });
      results.push({name:`game-${quality}`, stats, errors:[...errors]});
    }
    writeFileSync(path.join(dir, 'render-results.json'), JSON.stringify(results, null, 2)+'\n');
    console.log(JSON.stringify(results, null, 2));
    if (results.some(r => r.errors.length)) throw new Error('Browser errors recorded');
  } finally { await browser.close(); await server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
