import { chromium } from '/opt/node-tools/node_modules/playwright-core/index.mjs';
import fs from 'fs';
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const sizes = { landscape: [844,390,2], desktop: [1280,720,1], portrait: [390,844,2] };
const meta = {};
for (const [name,[w,h,dpr]] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: name!=='desktop', hasTouch: name!=='desktop' });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/?debug'); await page.waitForTimeout(2000);
  await page.click('#menu-play'); await page.waitForTimeout(800);
  if (await page.locator('#tutorial-offer[open]').count()) await page.click('#tutorial-free');
  await page.waitForTimeout(500);
  if (await page.locator('#tp-close').count()) await page.click('#tp-close');
  await page.addStyleTag({ content: '#hud,#trade-panel,dialog{display:none!important}' });
  // at sea, Saltmere in view
  await page.evaluate(() => { const w = fwt.world; const hb = fwt.view.harbours.saltmere; w.boat.x = hb.x - 38; w.boat.y = hb.y + 22; w.boat.heading = 125*Math.PI/180; w.boat.speedKn = 7; w.trade.dockedAt = null; w.boat.sailStep = 2; });
  for (let i=0;i<3;i++){ await page.keyboard.press('ArrowUp'); await page.waitForTimeout(80);} 
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => { const w=fwt.world; const h = fwt.view.harbours; const out={}; for (const p of w.map.ports){ const a=h[p.id]; const s=fwt.view.project(a.x,a.y); out[p.id]=s;} out.boat=fwt.view.project(w.boat.x,w.boat.y); return out; });
  await page.screenshot({ path: `${OUT}/sea-${name}.png` });
  meta[`sea-${name}`] = info;
  // harbour
  await page.evaluate(() => { const w = fwt.world; const h = fwt.view.harbours.saltmere; w.boat.x = h.x; w.boat.y = h.y; w.boat.speedKn = 0; w.boat.sailStep=0; w.boat.sail=0; });
  for (let i=0;i<3;i++) await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/port-${name}.png` });
  await ctx.close();
}
fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta,null,1));
await browser.close();
