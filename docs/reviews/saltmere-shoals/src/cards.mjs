import { chromium } from 'playwright';
const OUT = process.argv[2];
const lang = process.argv[3] ?? 'en';
const views = { desktop: [1280, 800], landscape: [844, 390], portrait: [390, 844] };
const which = (process.argv[4] ?? 'desktop,landscape,portrait').split(',');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
for (const name of which) {
  const [width, height] = views[name];
  const ctx = await b.newContext({ viewport: { width, height }, hasTouch: name !== 'desktop', isMobile: name !== 'desktop' });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:5199/?debug');
  await p.waitForTimeout(2000);
  if (lang === 'fr') { await p.click('button:text-is("FR")'); await p.waitForTimeout(300); }
  await p.click('#menu-play'); await p.waitForTimeout(500);
  for (const id of ['#set-sail', '#tutorial-free']) if (await p.$(id + ':visible')) { await p.click(id); await p.waitForTimeout(600); }
  const dock = async () => {
    if (await p.$('#tp-close:visible')) { await p.click('#tp-close'); await p.waitForTimeout(500); }
    await p.evaluate(() => { fwt.world.trade.dockedAt = null; Object.assign(fwt.world.boat, { x: 252, y: -134, speedKn: 0 }); });
    await p.waitForTimeout(400);
    await p.click('.port-marker[data-port-id="saltmere"]', { force: true });
    await p.waitForTimeout(900);
  };
  const close = async () => { const btn = await p.$('#quest-card[open] button[data-act]'); if (btn) { await btn.click(); await p.waitForTimeout(500); } };
  const card = async (file) => {
    await p.waitForSelector('#quest-card[open]', { timeout: 4000 });
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${file}-${name}${lang === 'fr' ? '-fr' : ''}.png` });
  };
  await dock();
  await close(); // Rook's "call at Saltmere"
  await p.evaluate(() => fwt.quests.check());
  await dock();
  // Rook's thanks, then Kit's offer.
  for (let i = 0; i < 3; i++) {
    const text = await p.evaluate(() => document.querySelector('#quest-card[open]')?.textContent ?? '');
    if (text.includes('Kit Marlow') || text.includes('Kit MarlowP')) break;
    await close(); await p.waitForTimeout(300);
    if (!(await p.$('#quest-card[open]'))) await dock();
  }
  await card('1-offer-gulls');
  await p.click('#quest-card[open] button[data-act="accept"]'); await p.waitForTimeout(500);
  await p.evaluate(() => { fwt.world.trade.quests.byId['saltmere-shoals'] = { step: 'channel', counts: [0, 0], chose: {} }; });
  await dock(); await card('2-channel'); await close();
  await p.evaluate(() => { fwt.world.trade.quests.byId['saltmere-shoals'] = { step: 'catch', counts: [0, 0, 0, 0, 0, 0], chose: {} }; });
  await dock(); await card('3-catch'); await close();
  await p.evaluate(() => { fwt.world.trade.quests.byId['saltmere-shoals'].counts = [0, 6, 0, 2, 0, 0]; fwt.quests.check(); });
  await dock(); await card('4-done'); await close();
  await ctx.close();
}
await b.close();
