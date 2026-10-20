import { chromium } from '/opt/node-tools/node_modules/playwright-core/index.mjs';
const [,, dir, out, only] = process.argv;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
const sizes = { landscape: [844,390,2], desktop: [1280,720,1.5], portrait: [390,844,2] };
for (const style of ['a','b','c']) for (const screen of ['sea','port','chart']) for (const [size,[w,h,dpr]] of Object.entries(sizes)) {
  if (only && !`${style}-${screen}-${size}`.includes(only)) continue;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  page.on('pageerror', e => console.log('ERR', style, screen, size, e.message));
  await page.goto(`file://${dir}/mock.html?style=${style}&screen=${screen}&size=${size}`);
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${style}-${screen}-${size}.png` });
  await page.close();
}
await browser.close();
