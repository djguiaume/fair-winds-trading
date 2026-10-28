/* global process, console, document, URL */
// `node tools/ci/sheet.mjs [out.jpg]`: takes the standard views (tools/ci/sheet.json, the
// `npm run shots` list format) and joins them in one small JPG contact sheet, so a PR shows
// the look at a glance without a thread taking, resizing and checking screenshots.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { ROOT } from '../fw/lib.mjs';
import { chromiumPath, planShots, takeShots } from '../fw/shots.mjs';

const SHEET_WIDTH = 1280;
const CELL_HEIGHT = 400;

const shotsFor = () =>
  JSON.parse(readFileSync(new URL('./sheet.json', import.meta.url), 'utf8')).flatMap((entry) =>
    planShots(entry),
  );

const pageFor = (files) =>
  `<body style="margin:0;background:#111;display:flex;flex-wrap:wrap;gap:4px;width:${SHEET_WIDTH}px">` +
  files
    .map(
      (f) =>
        `<figure style="margin:0"><img style="height:${CELL_HEIGHT}px;display:block" src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption style="color:#ddd;font:12px sans-serif;padding:2px">${f.split('/').pop().replace('.png', '')}</figcaption></figure>`,
    )
    .join('') +
  '</body>';

export async function run(outFile = 'shots/sheet.jpg') {
  const dir = resolve(ROOT, 'shots/sheet-parts');
  const files = await takeShots(shotsFor(), dir);
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
  });
  try {
    const page = await browser.newPage({ viewport: { width: SHEET_WIDTH, height: 400 } });
    await page.setContent(pageFor(files.sort()));
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    await page.screenshot({
      path: resolve(ROOT, outFile),
      type: 'jpeg',
      quality: 70,
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
  console.log(`sheet of ${files.length} views in ${outFile}`);
  return 0;
}

if (process.argv[1]?.endsWith('sheet.mjs')) process.exitCode = await run(process.argv[2]);
