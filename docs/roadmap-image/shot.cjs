// Renders roadmap.html to roadmap.png (1080 px wide, phone portrait).
// Pass a name to render another page: `node shot.cjs roadmap-fr` → roadmap-fr.png.
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
const name = process.argv[2] || 'roadmap';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 540, height: 800 }, deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(__dirname, name + '.html'));
  await page.screenshot({ path: path.join(__dirname, name + '.png'), fullPage: true });
  await browser.close();
})();
