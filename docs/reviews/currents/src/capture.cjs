// Currents as built (ADR 0145): real captures of the game. Run against `npx vite --port 5199`.
const { chromium } = require('playwright');
const [,, name = 'sea', w = 1280, h = 720, zoom = '1.6', bx = '-60', by = '22', hd = '275', extra = ''] = process.argv;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await p.addInitScript(() => {
    localStorage.setItem('fwt.settings.v1', JSON.stringify({ seenWindHint: true, tutorialOffered: true, language: 'en', dayNight: false }));
  });
  await p.goto('http://localhost:5199/?debug');
  await p.waitForTimeout(1500);
  await p.click('#menu-play', { timeout: 2000 }).catch(() => {});
  await p.waitForTimeout(500);
  await p.click('#set-sail', { timeout: 2000 }).catch(() => {});
  await p.waitForTimeout(800);
  await p.keyboard.press('Escape');
  await p.click('#tp-undock', { timeout: 1500 }).catch(() => {});
  await p.waitForTimeout(300);
  await p.evaluate(([bx, by, hd]) => {
    const { world } = window.fwt;
    world.time = 260; world.dynamicWeather = false;
    world.boat.x = +bx; world.boat.y = +by; world.boat.heading = (+hd * Math.PI) / 180;
    world.boat.speedKn = 6; world.boat.sailStep = 2; world.boat.sail = 1;
  }, [bx, by, hd]);
  await p.evaluate((z) => window.fwt.view.setZoom(+z), zoom);
  await p.waitForTimeout(2500);
  if (extra === 'chart') { await p.click('#chart-btn'); await p.waitForTimeout(1000); }
  await p.screenshot({ path: `docs/reviews/currents/${name}.png` });
  console.log(await p.evaluate(() => JSON.stringify({ w: window.fwt.world.water, sog: window.fwt.world.sogKn, sp: window.fwt.world.boat.speedKn, charted: window.fwt.world.trade.progress.charted })));
  await b.close();
})();
