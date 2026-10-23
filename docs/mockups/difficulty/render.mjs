/* global process, document */
// Renders mock.html at desktop, phone landscape and phone portrait sizes, then an overview sheet.
// Usage: node docs/mockups/difficulty/render.mjs (needs playwright-core and Chromium).
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = (q = '') => `file://${dir}/mock.html${q}`;
const shots = [
  ['picker-desktop.png', 1280, 720, ''],
  ['picker-phone-landscape.png', 844, 390, ''],
  ['picker-phone-portrait.png', 390, 844, ''],
  ['settings-row.png', 600, 470, '?view=settings'],
];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
for (const [name, width, height, q] of shots) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(url(q));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(dir, name) });
  await page.close();
}
const page = await browser.newPage({ viewport: { width: 1800, height: 1060 } });
const img = (n) => n;
const fs = await import('node:fs');
fs.writeFileSync(path.join(dir, '.overview.html'), `<body style="margin:0;background:#e9e3d6;font:600 18px Barlow,sans-serif;color:#22323c">
<div style="display:grid;grid-template-columns:1280px 406px;gap:40px;padding:30px 40px">
 <div><div>Desktop · new voyage</div><img src="${img('picker-desktop.png')}" style="width:1280px;border-radius:10px;box-shadow:0 6px 20px #0004;margin-top:8px">
  <div style="display:flex;gap:30px;margin-top:22px">
   <div><div>Phone landscape (844×390)</div><img src="${img('picker-phone-landscape.png')}" style="width:633px;border:8px solid #111;border-radius:22px;margin-top:8px"></div>
   <div><div>Settings · Voyage</div><img src="${img('settings-row.png')}" style="width:600px;border-radius:10px;margin-top:8px"></div>
  </div></div>
 <div><div>Phone portrait</div><img src="${img('picker-phone-portrait.png')}" style="width:390px;border:8px solid #111;border-radius:30px;margin-top:8px"></div>
</div></body>`);
await page.goto(`file://${dir}/.overview.html`);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(dir, 'difficulty-picker-overview.png'), fullPage: true });
fs.unlinkSync(path.join(dir, '.overview.html'));
await browser.close();
