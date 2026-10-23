// Screenshots for the characters' look mockups. Needs Vite running at the repo root:
//   npx vite --port 5179 &  node docs/reviews/characters/src/render.mjs [filter]
import { chromium } from '../../../../node_modules/playwright/index.mjs';
const out = new URL('..', import.meta.url).pathname;
const only = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const sizes = { desktop: [1280, 720], landscape: [844, 390], portrait: [390, 844] };
const shots = [['sheet', 'A', 'sheet', [1600, 840]]];
for (const screen of ['dialogue', 'journal']) for (const size of Object.keys(sizes)) shots.push([screen, 'A', size, sizes[size]]);
for (const s of ['B', 'C']) shots.push(['dialogue', s, 'desktop', sizes.desktop]);
for (const [screen, style, size, [w, h]] of shots) {
  const name = screen === 'sheet' ? 'portrait-styles' : `${screen}-${size}${style === 'A' ? '' : `-style-${style}`}`;
  if (only && !name.includes(only)) continue;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.log('ERR', name, e.message));
  await page.goto(`http://localhost:5179/docs/reviews/characters/src/mock.html?screen=${screen}&size=${size}&style=${style}`);
  await page.waitForSelector('body[data-ready]');
  await page.waitForTimeout(200);
  await page.screenshot(screen === 'sheet' ? { path: `${out}${name}.png` } : { path: `${out}${name}.jpg`, quality: 85 });
  await page.close();
  console.log(name);
}
await browser.close();
