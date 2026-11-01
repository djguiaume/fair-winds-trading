/* global console, window, localStorage, Storage, setTimeout */
// `npm run free -- walk` (decision 0266): the Free Sailing isolation proof in the real game. It
// starts a voyage, leaves it for Free Sailing from the title menu, then launches, changes ships,
// dresses her, pauses, restarts, refreshes and goes back to the voyage, logging every write the
// session pages make to the browser's storage. It passes when the voyage's save is byte for byte
// what it was and the session wrote nothing but Settings. `--shots dir` also shoots the screens.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromiumPath, startVite } from './lib.mjs';

const SAVE_KEY = 'fwt.save.v1';
/**
 * Device preferences, shared by the voyage and the session on purpose: Settings, the chart's zoom
 * and the chart's cleanup of markers older versions kept (decision 0058).
 */
const PREFERENCES = /^fwt\.(settings|chart)\./;
const SIZES = { desktop: { width: 1280, height: 800 }, portrait: { width: 390, height: 844 } };

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Every key and value of the page's storage. */
const snapshot = (page) =>
  page.evaluate(() => Object.fromEntries(Object.entries({ ...localStorage })));

/** Logs each storage write the page makes, kept on `window.__writes` across this page only. */
function logWrites() {
  if (window.top !== window) return;
  window.__writes = [];
  for (const name of ['setItem', 'removeItem', 'clear']) {
    const real = Storage.prototype[name];
    Storage.prototype[name] = function (key, ...rest) {
      window.__writes.push(`${name} ${key ?? ''}`);
      return real.call(this, key, ...rest);
    };
  }
}

async function startVoyage(page) {
  await page.locator('#menu-play').waitFor({ state: 'visible', timeout: 30000 });
  await page.click('#menu-play');
  await page.locator('#set-sail').waitFor({ state: 'visible', timeout: 5000 });
  await page.click('#set-sail');
  await page.locator('#tutorial-free').waitFor({ state: 'visible', timeout: 5000 });
  await page.click('#tutorial-free');
  await page.evaluate(() => window.fwt.freePlay?.());
}

/** The session's own writes so far, without Settings. */
async function sessionWrites(page) {
  const writes = await page.evaluate(() => window.__writes ?? []);
  return writes.filter((w) => !PREFERENCES.test(w.split(' ')[1] ?? ''));
}

async function shoot(page, dir, name) {
  if (!dir) return;
  // Menus fade in and the turntable eases round.
  await pause(800);
  const file = join(dir, `${name}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 82, timeout: 120000 });
  console.log(`  shot ${file}`);
}

/** Sails from the open setup: picks a preset and a ship, then Set sail, and waits at sea. */
async function sail(page, preset, ship, seconds) {
  const setup = page.locator('.free-setup[open]');
  await setup.waitFor({ timeout: 30000 });
  if (preset) await setup.locator(`[data-preset="${preset}"]`).click();
  if (ship) await setup.locator(`[data-ship="${ship}"]`).click();
  await setup.locator('.fs-sail').click();
  await page.locator('.free-setup[open]').waitFor({ state: 'detached', timeout: 5000 });
  await pause(seconds * 1000);
}

/** Sails on until the game's clock has run past an autosave (15 s of game time). */
async function sailPastAutosave(page) {
  const from = await page.evaluate(() => window.fwt.world.time);
  await page.waitForFunction((t) => window.fwt.world.time > t + 16, from, { timeout: 180000 });
  return page.evaluate(() => window.fwt.world.time);
}

export async function walk(args) {
  const dir = typeof args.shots === 'string' ? args.shots : null;
  if (dir) mkdirSync(dir, { recursive: true });
  const { chromium } = await import('playwright');
  const server = await startVite(true);
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const problems = [];
  const step = (text) => console.log(`· ${text}`);
  try {
    const context = await browser.newContext({ viewport: SIZES.desktop, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', (e) => problems.push(`page error: ${e}`));
    await page.goto(`${base}/?debug`);
    step('a voyage under way, with a save');
    await startVoyage(page);
    await page.evaluate(() => {
      window.fwt.world.trade.captain.gold = 4321;
    });
    await page.keyboard.press('Escape');
    await shoot(page, dir, '1-title-menu');
    step('title menu › Free Sailing');
    await page.click('#menu-free');
    await page.waitForURL(/\?free$/);
    const before = await snapshot(page);
    if (!before[SAVE_KEY]) problems.push('the voyage left no save to compare with');
    else if (!before[SAVE_KEY].includes('"gold":4321')) problems.push('the voyage save is stale');
    await page.addInitScript(logWrites);
    // From here on, every session page logs its writes: debug too, to read the session's world.
    await page.goto(`${base}/?free&debug`);
    await page.locator('.free-setup[open]').waitFor({ timeout: 30000 });
    await shoot(page, dir, '2-setup');
    step('launch: Saltmere morning in the sloop');
    await sail(page, 'saltmere-morning', null, 4);
    await shoot(page, dir, '3-at-sea');
    step('pause › Change ship or place › Boat looks, every item open');
    await page.keyboard.press('Escape');
    await shoot(page, dir, '4-pause-menu');
    await page.click('#menu-free-setup');
    await page.locator('.free-setup .fs-looks').click();
    const looks = page.locator('.boat-looks:not(.free-setup)[open]');
    await looks.waitFor({ timeout: 5000 });
    await looks.locator('.bl-tile').nth(2).click();
    await looks.locator('.bl-use').click();
    await shoot(page, dir, '5-looks');
    await page.keyboard.press('Escape');
    step('change ships: the indiaman, restart in the rain');
    await sail(page, 'westholm-rain', 'indiaman', 1);
    const time = await sailPastAutosave(page);
    step(`sailed to game time ${Math.round(time)} s, past an autosave (into the session's memory)`);
    await shoot(page, dir, '6-indiaman');
    problems.push(...(await sessionWrites(page)).map((w) => `session wrote: ${w}`));
    step('refresh: a new session on its setup');
    await page.reload();
    await sail(page, 'rimewick-night', 'clipper', 3);
    problems.push(...(await sessionWrites(page)).map((w) => `session wrote: ${w}`));
    step('back to my voyage');
    await page.keyboard.press('Escape');
    await page.click('#menu-free-leave');
    await page.waitForURL((url) => !url.search.includes('free'));
    await page.locator('#menu-play').waitFor({ state: 'visible', timeout: 30000 });
    const after = await snapshot(page);
    if (after[SAVE_KEY] !== before[SAVE_KEY]) problems.push('the voyage save changed');
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
      if (!PREFERENCES.test(key) && before[key] !== after[key]) problems.push(`${key} changed`);
    await context.close();
    if (dir) await shootPortrait(browser, base, dir);
  } finally {
    await browser.close();
    await server.close();
  }
  for (const p of problems) console.log(`✗ ${p}`);
  if (!problems.length) console.log('✓ the voyage save and storage are untouched by Free Sailing');
  return problems.length ? 1 : 0;
}

async function shootPortrait(browser, base, dir) {
  const context = await browser.newContext({
    viewport: SIZES.portrait,
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(`${base}/?free`);
  await page.locator('.free-setup[open]').waitFor({ timeout: 30000 });
  await pause(1500);
  await shoot(page, dir, '7-setup-portrait');
  await context.close();
}
