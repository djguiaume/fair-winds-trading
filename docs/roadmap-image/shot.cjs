// Renders roadmap.html to roadmap.png (1080 px wide, phone portrait).
const { chromium } = require('/opt/node-tools/node_modules/playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 540, height: 800 }, deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(__dirname, 'roadmap.html'));
  await page.screenshot({ path: path.join(__dirname, 'roadmap.png'), fullPage: true });
  await browser.close();
})();
