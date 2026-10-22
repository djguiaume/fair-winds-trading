const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

(async () => {
  const dir = path.join(process.cwd(), 'docs/art/game-models/fleet-review');
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const results = [];
  let errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const capture = async (name, query) => {
    errors = [];
    await page.goto(`http://127.0.0.1:5173/models.html?${query}&still`);
    await page.waitForFunction(() => document.querySelector('#stats').textContent.includes('triangles'));
    await page.screenshot({ path: path.join(dir, `${name}.png`) });
    results.push({ name, query, stats: await page.locator('#stats').textContent(), errors: [...errors] });
  };
  try {
    for (const id of ['sloop', 'cutter', 'schooner', 'clipper', 'hoy', 'fluyt', 'indiaman']) {
      await capture(`${id}-stock`, `view=${id}&level=1`);
      await capture(`${id}-upgraded`, `view=${id}&level=3`);
      await capture(`${id}-stern`, `view=${id}&level=3&yaw=45&boom=-45`);
    }
    await capture('fleet-stock', 'view=lines&level=1');
    await capture('fleet-upgraded', 'view=lines&level=3');
    for (const id of ['schooner', 'clipper', 'hoy', 'fluyt', 'indiaman'])
      await capture(`${id}-furled-low`, `view=${id}&level=3&quality=low&sail=0&boom=-45`);
    const budgets = await page.evaluate(async () => {
      const { createBoatModel: createStorybookBoat } = await import('/src/render/models/index.ts');
      const { triangleCount } = await import('/src/render/models/geometry.ts');
      return ['sloop', 'cutter', 'schooner', 'clipper', 'hoy', 'fluyt', 'indiaman'].map(id => ({
        id, levels: [1, 2, 3].map(level => {
          const b = createStorybookBoat(id, { upgrades: { hull: level, hold: level, sails: level } });
          let triangles = 0, meshes = 0;
          b.root.traverse(o => { if (o.isMesh) { meshes++; triangles += triangleCount(o.geometry); } });
          const result = { level, triangles, meshes, cargo: b.stats.crates + b.stats.barrels, wake: b.wakeHull };
          b.dispose();
          return result;
        }),
      }));
    });
    writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ captures: results, budgets }, null, 2));
    console.log(JSON.stringify({ captures: results.length, errors: results.filter(r => r.errors.length), budgets }));
    if (results.some(r => r.errors.length)) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
