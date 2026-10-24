// Decision 0141 as built: the live game (French) at Saltmere after the prologue, at three sizes.
// Run from the repo root against `npx vite --port 5199`.
const { chromium } = require('playwright');
const VP = { desktop: [1280, 720], landscape: [915, 412], portrait: [412, 915] };
const OUT = process.env.OUT || 'docs/reviews/quest-ui/built';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [name, [w, h]] of Object.entries(VP)) {
    const ctx = await b.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 2,
      locale: 'fr-FR',
      hasTouch: name !== 'desktop',
      isMobile: name !== 'desktop',
    });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('pageerror', e.message));
    const shot = (file) => p.screenshot({ path: `${OUT}/${file}-${name}.jpg`, quality: 80 });
    await p.goto('http://localhost:5199/?debug');
    await p.waitForTimeout(1500);
    await p.click('#menu-play');
    await p.waitForTimeout(500);
    const ss = await p.$('#set-sail');
    if (ss) {
      await ss.click();
      await p.waitForTimeout(500);
    }
    await p.click('#tutorial-free');
    await p.waitForTimeout(800);
    // 1. Docking at Saltmere: Rook's thanks (a main quest) greet the captain first.
    await p.evaluate(() => {
      const f = window.fwt;
      const h = f.view.harbours.saltmere;
      Object.assign(f.world.boat, { x: h.x, y: h.y, speedKn: 0 });
      f.world.boat.sailStep = 0;
    });
    await p.waitForSelector('#quest-card[open]', { timeout: 15000 });
    await p.waitForTimeout(600);
    await shot('1-arrival');
    // 2. "To the market": the harbour screen, Kit waiting on the Quay tab.
    await p.click('#quest-card [data-act="market"]');
    await p.waitForTimeout(500);
    await shot('2-badge');
    // 3. The Quay tab.
    await p.click('#tp-tab-quay');
    await p.waitForTimeout(400);
    await shot('3-quay');
    // 4. At sea, a step moves on away from Kit's harbour: a small note, no card.
    await p.click('.quay-person [data-act="accept"]');
    await p.waitForTimeout(300);
    await p.click('#tp-undock');
    await p.evaluate(() => {
      const f = window.fwt;
      Object.assign(f.world.boat, { x: 205, y: 30, speedKn: 0 });
      f.world.boat.sailStep = 2;
      f.world.destination = null;
    });
    await p.waitForTimeout(1500);
    await p.evaluate(() => {
      const f = window.fwt;
      const q = f.world.trade.quests.byId['saltmere-shoals'];
      q.step = 'channel';
      q.counts = [0];
      f.quests.onEvent({ type: 'step', quest: 'saltmere-shoals', step: 'channel' });
    });
    await p.waitForSelector('#quest-note:not([hidden])', { timeout: 5000 });
    await p.waitForTimeout(300);
    await shot('4-sea-note');
    await ctx.close();
  }
  await b.close();
})();
