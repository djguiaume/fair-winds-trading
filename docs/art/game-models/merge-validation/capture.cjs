const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], captures = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    for (const id of ['sloop','cutter','schooner','clipper','hoy','fluyt','indiaman']) {
      for (const night of (['fluyt','indiaman'].includes(id) ? [false,true] : [false])) {
        const name = `${id}-${night ? 'night' : 'day'}`;
        await page.goto(`http://127.0.0.1:5185/models.html?view=${id}&level=3&still&yaw=45&boom=-45${night ? '&night&quality=low' : ''}`);
        await page.waitForFunction(() => document.querySelector('#stats').textContent.includes('triangles'));
        await page.screenshot({ path: `docs/art/game-models/merge-validation/${name}.png` });
        captures.push({ name, stats: await page.locator('#stats').innerText() });
      }
    }
    fs.writeFileSync('docs/art/game-models/merge-validation/results.json', JSON.stringify({errors,captures},null,2));
    console.log(JSON.stringify({errors,captures}));
    if(errors.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
