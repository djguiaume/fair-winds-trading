// Shots of the Boat looks mockup (#299): node docs/mockups/src/boat-looks/shot.cjs [out-dir]
// Writes a-desktop.png, a-phone.png, b-desktop.png, b-phone.png (PNG; convert to JPG to share).
const { chromium } = require('playwright');
const path = require('node:path');

const out = path.resolve(process.argv[2] || 'docs/mockups/boat-looks');
const SIZES = { desktop: [1280, 800], phone: [390, 844] };

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 5183 }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch({
    executablePath: require('node:fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const v of ['a', 'b'])
      for (const [size, [width, height]] of Object.entries(SIZES)) {
        const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
        page.on('pageerror', (e) => console.log('ERR', e.message));
        await page.goto(`http://127.0.0.1:5183/docs/mockups/src/boat-looks/index.html?v=${v}`);
        await page.waitForFunction(() => document.title === 'done', null, { timeout: 60000 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(out, `${v}-${size}.png`) });
        await page.close();
      }
  } finally {
    await browser.close();
    await server.close();
  }
})();
