/*
 * Engine captures of ship models from models.html (decision 0077), shared by every per-ship
 * redesign. Run from the repository root with playwright available:
 *   node tools/ship-models/capture.cjs compare            -> docs/art/game-models/ship-compare.png
 *   node tools/ship-models/capture.cjs hoy [out-dir]      -> one ship at each upgrade/quality
 *   node tools/ship-models/capture.cjs damage [out-dir]   -> every ship at the 4 damage steps (0208)
 * CHROMIUM_PATH optionally selects a local Chromium binary.
 */
const { chromium } = require('playwright');
const { writeFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');

const target = process.argv[2] || 'compare';
const SHIP_CASES = [
  ['level1-high', 'level=1&quality=high'],
  ['level2-high', 'level=2&quality=high'],
  ['level3-high', 'level=3&quality=high'],
  ['level3-low', 'level=3&quality=low'],
  ['level3-reefed', 'level=3&quality=high&sail=0.35&boom=-45'],
  ['level3-stern', 'level=3&quality=high&yaw=-45'],
  ['mixed-upgrades', 'hull=1&hold=3&sails=2&quality=medium'],
];

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 5181 } });
  await server.listen();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: [
      '--no-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });
  const results = [];
  try {
    const compare = target === 'compare';
    const damage = target === 'damage';
    const dir = path.resolve(
      process.argv[3] ||
        (compare
          ? 'docs/art/game-models'
          : damage
            ? 'docs/art/game-models/damage'
            : `docs/art/game-models/refined-${target}`),
    );
    mkdirSync(dir, { recursive: true });
    const page = await browser.newPage({
      viewport: compare || damage ? { width: 1920, height: 760 } : { width: 1280, height: 720 },
    });
    const cases = compare
      ? [
          ['ship-compare-stock', 'level=1'],
          ['ship-compare-level3', 'level=3'],
        ]
      : damage
        ? ['sloop', 'cutter', 'schooner', 'clipper', 'hoy', 'fluyt', 'indiaman'].map((id) => [
            id,
            `ship=${id}&level=2`,
          ])
        : SHIP_CASES;
    for (const [name, query] of cases) {
      const errors = [];
      const onError = (e) => errors.push(e.message ?? e.text());
      page.on('pageerror', onError);
      await page.goto(`http://127.0.0.1:5181/models.html?view=${target}&still&${query}`);
      await page.waitForFunction(() =>
        document.querySelector('#stats').textContent.includes('triangles'),
      );
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(dir, `${name}.png`) });
      page.off('pageerror', onError);
      results.push({ name, query, stats: await page.locator('#stats').textContent(), errors });
    }
    if (!compare && !damage)
      writeFileSync(path.join(dir, 'render-results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
    await server.close();
  }
})();
