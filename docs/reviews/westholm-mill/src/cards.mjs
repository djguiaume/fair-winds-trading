// Screenshots of the Westholm mill cards (decision 0132), off Westholm.
// usage: node cards.mjs <outDir> [port]; needs `npx vite --port 5190` running.
import { chromium } from '../../../../node_modules/playwright/index.mjs';
const [outDir = '.', port = '5190'] = process.argv.slice(2);
const sizes = { desktop: [1440, 900], landscape: [844, 390], portrait: [390, 844] };
const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const shots = [
  ['offer', 'offer', null],
  ['millstones', 'step', { step: 'millstones', counts: [1, 0] }],
  ['bread', 'step', { step: 'bread', counts: [4, 0, 0, 0, 0] }],
  ['done', 'finished', { step: 'done', counts: [] }],
];
for (const lang of ['en', 'fr'])
  for (const [name, [w, h]] of Object.entries(sizes)) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.addInitScript((language) => {
      const s = { quality: 'low', musicVolume: 0, seenHelp: true, dayNight: false, storms: false };
      localStorage.setItem('fwt.settings.v1', JSON.stringify({ ...s, weather: false, language }));
    }, lang);
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/?debug`);
    await page.waitForFunction(() => !!window.fwt);
    await page.locator('#menu-play').click();
    if (await page.locator('#set-sail').isVisible()) await page.locator('#set-sail').click();
    if (await page.locator('#tutorial-free').isVisible()) await page.locator('#tutorial-free').click();
    await page.evaluate(() => {
      const { world, view } = window.fwt;
      const at = view.harbours.westholm;
      const hold = () => Object.assign(world.boat, { x: at.x + 14, y: at.y - 10, speedKn: 0 });
      const r0 = view.render.bind(view);
      view.render = (dt) => (hold(), r0(dt));
    });
    await page.waitForTimeout(4000);
    for (const [shot, kind, state] of shots) {
      await page.evaluate(
        async ([kind, state]) => {
          const { world, quests } = window.fwt;
          const { QuestCard } = await import('/src/ui/questCard.ts');
          const { cardFor } = await import('/src/ui/questView.ts');
          const q = world.trade.quests;
          q.byId['rooks-thanks'] = { step: 'done', counts: [], chose: {} };
          if (state) q.byId['westholm-mill'] = { chose: {}, ...state };
          else delete q.byId['westholm-mill'];
          const dialog = document.querySelector('#quest-card');
          if (dialog.open) dialog.close();
          new QuestCard(dialog).show(cardFor(quests, world.map, 'westholm-mill', kind));
        },
        [kind, state],
      );
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${outDir}/${lang}-${shot}-${name}.jpg`, quality: 82 });
    }
    if (errs.length) console.log(lang, name, errs.join('\n'));
    await page.close();
  }
await browser.close();
