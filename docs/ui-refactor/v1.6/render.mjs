// Renders every mockup screen to JPG: node render.mjs [direction ...]; round 2: node render.mjs --r2 [direction ...]
// Desktop 1280 x 800 and phone landscape 844 x 390 (drawn at 2x, like a phone), as `npm run shots` sizes them.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.OUT || join(here, process.argv.includes('--r2') ? 'out-r2' : 'out');
const r2 = process.argv.includes('--r2');
const args = process.argv.slice(2).filter((a) => a !== '--r2');
const dirs = args.length ? args : r2 ? ['chart', 'harbour'] : ['chart', 'club', 'harbour'];
const VARIANTS = r2 ? ['framed', 'minimal'] : [''];
const SHOTS = r2
  ? [['title', 'day'], ['hud', 'day'], ['hud', 'night'], ['harbour', 'day']]
  : [['title', 'day'], ['hud', 'night'], ['harbour', 'day'], ['chart', 'day'], ['hud', 'day'], ['hud', 'storm']];
const SIZES = { desktop: { width: 1280, height: 800, scale: 1 }, phone: { width: 844, height: 390, scale: 2 } };

const server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { cwd: here, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const browser = await chromium.launch();
try {
  for (const d of dirs) {
    mkdirSync(join(out, d), { recursive: true });
    for (const [z, v] of Object.entries(SIZES)) {
      const page = await browser.newPage({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.scale });
      for (const [s, t] of SHOTS) {
        for (const v of VARIANTS) {
          await page.goto(`http://127.0.0.1:8765/mock.html?d=${d}&s=${s}&z=${z}&t=${t}${v ? `&v=${v}` : ''}`);
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(150);
          await page.screenshot({ path: join(out, d, `${s}-${t}${v ? `-${v}` : ''}-${z}.jpg`), type: 'jpeg', quality: 88 });
        }
      }
      await page.close();
    }
    if (r2) continue;
    const card = await browser.newPage({ viewport: { width: 1280, height: 420 }, deviceScaleFactor: 1 });
    await card.goto(`http://127.0.0.1:8765/mock.html?d=${d}&s=identity&z=desktop`);
    await card.evaluate(() => document.fonts.ready);
    await card.waitForTimeout(150);
    await card.screenshot({ path: join(out, d, 'identity.jpg'), type: 'jpeg', quality: 90 });
    await card.close();
    console.log('drew', d);
  }
} finally {
  await browser.close();
  server.kill();
}
