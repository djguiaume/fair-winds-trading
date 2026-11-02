/* global document, clearInterval, setTimeout */
// The two shots taken before the game is up (`npm run shots`): `--splash` freezes the loading
// screen with the boat at `--progress` (0 to 1, default 0.55); `--portrait-gate` shows the page a
// phone held upright gets (use `--sizes portrait`, the default for this shot).

/** Before the page opens: for the loading screen, keeps the game from loading past its start view. */
export async function prepareBoot(page, shot) {
  if (shot.boot !== 'splash') return;
  await page.route(/\/src\/main\.ts/, () => {});
}

/** After the page opens: waits for the screen asked for and sets what the shot shows. */
export async function shootBoot(page, shot) {
  if (shot.boot === 'gate') await page.locator('.portrait-gate').waitFor({ timeout: 30000 });
  else {
    await page.locator('#splash').waitFor({ timeout: 30000 });
    // The boat's own timer would keep moving it: stop the page's timers and set the place.
    await page.evaluate((p) => {
      for (let i = 1; i < 10000; i++) clearInterval(i);
      document.getElementById('splash').style.setProperty('--splash-p', String(p));
    }, shot.progress);
  }
  await page.evaluate(() => document.fonts.ready);
  await new Promise((done) => setTimeout(done, shot.wait));
}
