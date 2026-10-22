const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
(async () => {
  const dir = path.join(process.cwd(), 'docs/art/game-models/raised-sterns');
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    let errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const results = [];
    for (const id of ['fluyt', 'indiaman']) for (const [name, query] of [
      ['side', 'level=3'], ['stern-day', 'level=3&yaw=45&boom=-45'],
      ['stern-night', 'level=3&yaw=45&boom=-45&night'],
      ['stock', 'level=1&yaw=45&boom=45'],
      ['reefed', 'hull=2&hold=3&sails=2&sail=.35&boom=45&yaw=-45'],
      ['furled-low-night', 'level=3&quality=low&sail=0&yaw=45&night'],
    ]) {
      errors = [];
      await page.goto(`http://127.0.0.1:5173/models.html?view=${id}&still&${query}`);
      await page.waitForFunction(() => document.querySelector('#stats').textContent.includes('triangles'));
      await page.screenshot({ path: path.join(dir, `${id}-${name}.png`) });
      results.push({ id, name, query, stats: await page.locator('#stats').textContent(), errors: [...errors] });
    }
    writeFileSync(path.join(dir, 'results.json'), JSON.stringify(results, null, 2));
    await page.goto('http://127.0.0.1:5173/docs/art/game-models/fleet-comparison/comparison.html');
    await page.waitForFunction(() => window.comparisonReady);
    await page.setViewportSize({ width: 2940, height: 1183 });
    await page.screenshot({ path: path.join(dir, 'fleet-features.png'), fullPage: true });
    await page.setViewportSize({ width: 1600, height: 1030 });
    await page.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;background:#10343b;color:#fff;font:22px Arial}h1{margin:0;padding:18px 25px;font-size:28px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 12px}h2{font-size:21px;margin:8px 0}img{width:100%;display:block}p{margin:13px 25px;color:#c4dddd;font-size:18px}</style></head><body><h1>Raised merchant sterns · daylight and subtle night windows</h1><div class="grid">${['stern-day','stern-night'].flatMap(view=>['fluyt','indiaman'].map(id=>`<div><h2>${id==='fluyt'?'Fluyt':'Indiaman'} · ${view==='stern-day'?'Day':'Night'}</h2><img src="http://127.0.0.1:5173/docs/art/game-models/raised-sterns/${id}-${view}.png"></div>`)).join('')}</div><p>Actual game models · matching pose and angle · raised rear booms clear the restored quarterdecks · windows emit a muted amber glow without scene lights</p></body></html>`);
    await page.locator('img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    await page.screenshot({ path: path.join(dir, 'day-and-night.png'), fullPage: true });
    console.log(JSON.stringify({ captures: results.length, errors: results.filter(r=>r.errors.length), comparison: 'day-and-night.png' }));
    if (results.some(r=>r.errors.length)) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
