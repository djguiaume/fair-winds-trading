import { chromium } from 'playwright';
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:5199/?debug');
await p.waitForTimeout(2000);
await p.click('#menu-play'); await p.waitForTimeout(500);
for (const id of ['#set-sail', '#tutorial-free']) if (await p.$(id + ':visible')) { await p.click(id); await p.waitForTimeout(600); }
const at = async (x, y, deg, file, step, counts, extra = () => {}) => {
  await p.evaluate(([x, y, deg, step, counts]) => {
    const t = fwt.world.trade;
    t.dockedAt = null;
    t.quests.byId['rooks-thanks'] = { step: 'done', counts: [], chose: {} };
    t.quests.byId['saltmere-shoals'] = { step, counts, chose: {} };
    t.quests.tracked = step === 'done' ? undefined : 'saltmere-shoals';
    Object.assign(fwt.world.boat, { x, y, heading: (deg * Math.PI) / 180, speedKn: 0 });
    fwt.world.time = 0;
    fwt.view.setQuestsDone(new Set(step === 'done' ? ['saltmere-shoals'] : []));
  }, [x, y, deg, step, counts]);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/${file}.png` });
};
await at(214, 2, -20, 'sea-1-gulls', 'gulls', [0, 0]);
await at(108, 40, 45, 'sea-2-channel-gates', 'channel', [0, 0]);
await at(110, 38, 45, 'sea-3-after-buoys', 'done', []);
await at(222, 8, -30, 'sea-4-after-fishing-boats', 'done', []);
await p.click('#chart-btn'); await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/chart-after.png` });
await b.close();
