// usage: node cap.mjs <out.png> <x> <y> [w h zoom heading]
import { chromium } from '/home/user/fair-winds-trading/node_modules/playwright/index.mjs';
const [out, x, y, w = 1600, h = 900, zoom = 0.6, heading = 0, extra = ''] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +(process.env.DPR||1) });
if (process.env.SHIPAT) await page.addInitScript((s) => { window.SHIPAT = JSON.parse(s); }, process.env.SHIPAT);
if (process.env.HIDEBOAT) await page.addInitScript(() => { window.HIDEBOAT = 1; });
await page.addInitScript(() => localStorage.setItem('fwt.settings.v1', JSON.stringify({ quality: 'high', musicVolume: 0, seenHelp: true, dayNight: false, storms: false, weather: false })));
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto((process.env.PORT ? 'http://127.0.0.1:'+process.env.PORT+'/' : 'http://127.0.0.1:5182/')+'?debug' + extra);
await page.waitForFunction(() => !!window.fwt);
await page.locator('#menu-play').click();
if (await page.locator('#set-sail').isVisible()) await page.locator('#set-sail').click();
if (await page.locator('#tutorial-free').isVisible()) await page.locator('#tutorial-free').click();
await page.evaluate(({ x, y, zoom, heading }) => {
  const { world, view } = window.fwt;
  window.HOLDXY = [x, y]; const r0 = view.render.bind(view); view.render = (dt) => { Object.assign(world.boat, { x: window.HOLDXY[0], y: window.HOLDXY[1], heading: heading * Math.PI / 180, speedKn: 0, sail: 0, sailStep: 0, drift: { x: 0, y: 0 } }); r0(dt); if (window.SHIPAT) { const [sx, sy, sh] = window.SHIPAT; const b = view.boat.root; b.visible = true; b.position.x = sx; b.position.z = -sy; b.rotation.y = -sh * Math.PI / 180 + Math.PI; view.boatShadow.visible = false; view.renderer.render(view.scene, view.camera); } };
  view.setZoom(zoom); view.target.set(x, 0, -y); if (window.HIDEBOAT) { view.boat.root.visible = false; view.boatShadow.visible = false; }
}, { x: +x, y: +y, zoom: +zoom, heading: +heading });
if (process.env.NOHUD) await page.addStyleTag({ content: 'body > *:not(#stage):not(script){visibility:hidden !important}' });
await page.waitForTimeout(5000);
for (let it = 0; it < 3 && process.env.CENTER; it++) {
  await page.evaluate(([cx, cy]) => {
    const { world, view } = window.fwt;
    const p = view.project(cx, cy), px = view.project(cx + 10, cy), py = view.project(cx, cy + 10);
    const W = view.renderer.domElement.clientWidth, H = view.renderer.domElement.clientHeight;
    const ex = W / 2 - p.x, ey = H / 2 - p.y;
    // solve ex = a*(px-p) + b*(py-p) in screen space for world shifts a,b (units of 10)
    const ax = (px.x - p.x), ay = (px.y - p.y), bx = (py.x - p.x), by = (py.y - p.y);
    const det = ax * by - bx * ay;
    const a = (ex * by - bx * ey) / det, b = (ax * ey - ex * ay) / det;
    window.SHIFT = [(window.SHIFT?.[0] ?? 0) - a * 10, (window.SHIFT?.[1] ?? 0) - b * 10];
    window.HOLDXY = [window.HOLDXY[0] - a * 10, window.HOLDXY[1] - b * 10];
  }, JSON.parse(process.env.CENTER));
  await page.waitForTimeout(4000);
}
if (process.env.CHART) { await page.keyboard.press('m'); await page.waitForTimeout(1500); }
if (process.env.SPOTS) { const pts = await page.evaluate((s) => JSON.parse(s).map(([x,y]) => window.fwt.view.project(x,y)), process.env.SPOTS); console.log(JSON.stringify(pts)); }
await page.screenshot({ path: out, timeout: 180000 });
console.log(errs.join('\n'));
await browser.close();
