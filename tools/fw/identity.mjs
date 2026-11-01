/* global console, document */
// `npm run identity` (decision 0153): the game's identity assets from one source. The logo symbols
// are drawn in identityLogo.mjs and live in the icon sprite of index.html between two markers; the
// favicon and the PWA icons are rendered from them; the one-sheet shows logo, icons and type.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, chromiumPath, startVite } from './lib.mjs';
import { logoSymbols } from './identityLogo.mjs';
import { sheetHtml } from './identitySheet.mjs';

const HELP = `npm run identity -- <what> [options]
  sprite [--check]   write the logo symbols (src/ui/sprite/logo.svg) (--check: only compare)
  icons              favicon.svg and the PNG icons (apple touch, 192, 512, maskable) in public/
  sheet [--out dir]  the one-sheet: logo, icons at 16, 24 and 32 px, type (default shots/identity)`;

const SPRITE = join(ROOT, 'src/ui/sprite');
const LOGO_FILE = join(SPRITE, 'logo.svg');
const PAPER = '#efe6d1';

const spriteFiles = () =>
  ['ui', 'goods', 'logo'].map((n) => readFileSync(join(SPRITE, `${n}.svg`), 'utf8'));

function writeSprite(check) {
  const next = `${logoSymbols().replace(/^ {6}/gm, '')}\n`;
  const same = existsSync(LOGO_FILE) && readFileSync(LOGO_FILE, 'utf8') === next;
  if (same) return (console.log('sprite: up to date'), 0);
  if (check)
    return (console.log('sprite: logo.svg is out of date, run npm run identity -- sprite'), 1);
  writeFileSync(LOGO_FILE, next);
  return (console.log('sprite: written'), 0);
}

/** A symbol as a standalone SVG: CSS variables replaced by their fallbacks. */
const standalone = (id, extra = '') => {
  const sym = spriteFiles()
    .join('')
    .match(new RegExp(`<symbol id="${id}" viewBox="([^"]*)">([\\s\\S]*?)</symbol>`));
  return { viewBox: sym[1], body: sym[2].replace(/var\(--[\w-]+,([^)]*)\)/g, '$1') + extra };
};

function faviconSvg() {
  const { body } = standalone('i-logo-sm');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="${PAPER}"/><svg x="10" y="10" width="108" height="108" viewBox="0 0 120 120">${body}</svg></svg>\n`;
}

async function withPage(fn) {
  const { chromium } = await import('playwright');
  const server = await startVite(true);
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    await page.goto(`${server.resolvedUrls.local[0]}tools/fw/identity.html`);
    const sprite = `<svg class="icon-sprite">${spriteFiles().join('')}</svg>`;
    await page.evaluate((s) => (document.body.innerHTML = s), sprite);
    await fn(page);
  } finally {
    await browser.close();
    await server.close();
  }
}

/** [file, size, rose share of the size, rounded corners] */
const PNGS = [
  ['apple-touch-icon.png', 180, 0.8, false],
  ['icon-192.png', 192, 0.8, true],
  ['icon-512.png', 512, 0.8, true],
  ['maskable-512.png', 512, 0.56, false],
];

async function writeIcons() {
  writeFileSync(join(ROOT, 'public/favicon.svg'), faviconSvg());
  await withPage(async (page) => {
    for (const [file, size, share, round] of PNGS) {
      await page.setViewportSize({ width: size, height: size });
      await page.evaluate(
        ([s, k, r, paper]) => {
          document.body.insertAdjacentHTML(
            'beforeend',
            `<div id="tile" style="position:fixed;inset:0;display:grid;place-items:center;background:${r ? 'transparent' : paper}"><div style="width:${s}px;height:${s}px;display:grid;place-items:center;background:${paper};border-radius:${r ? s * 0.22 : 0}px"><svg class="logo" style="width:${s * k}px;height:${s * k}px"><use href="#i-logo"/></svg></div></div>`,
          );
        },
        [size, share, round, PAPER],
      );
      await page.screenshot({ path: join(ROOT, 'public/icons', file), omitBackground: round });
      await page.evaluate(() => document.getElementById('tile').remove());
      console.log(`icons: ${file} ${size}px`);
    }
  });
}

async function writeSheet(out) {
  mkdirSync(out, { recursive: true });
  const ids = [
    ...spriteFiles()
      .join('')
      .matchAll(/<symbol id="i-([\w-]+)"/g),
  ]
    .map((m) => m[1])
    .filter((i) => !/^(logo|wordmark|banderole|emblem|chart-boat)/.test(i));
  const cover = `data:image/png;base64,${readFileSync(join(ROOT, 'docs/images/readme/cover.png')).toString('base64')}`;
  await withPage(async (page) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(
      (h) => document.body.insertAdjacentHTML('beforeend', h),
      sheetHtml({ ids, cover }),
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(out, 'identity.png'), fullPage: true });
    console.log(`sheet: ${join(out, 'identity.png')}`);
  });
}

export async function run(args) {
  const [what] = args._;
  if (what === 'sprite') return writeSprite(!!args.check);
  if (what === 'icons') return void (await writeIcons());
  if (what === 'sheet')
    return void (await writeSheet(String(args.out ?? join(ROOT, 'shots/identity'))));
  console.log(HELP);
  return what ? 1 : 0;
}
