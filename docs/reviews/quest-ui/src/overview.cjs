const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const src = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');
const dir = path.resolve('mock');
const opts = {
  A: { title: 'A · Un mot sur le quai — the person waits inside the harbour screen', shots: ['A1-quay', 'A2-listen'] },
  B: { title: 'B · Onglet Quai — a People tab with a badge, nothing pops up', shots: ['B1-badge', 'B2-people'] },
  C: { title: 'C · Carte d’arrivée — the card first, then the market', shots: ['C1-arrival', 'S-sea-note'] },
};
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 2200, height: 1300 } });
  for (const [k, o] of Object.entries(opts)) {
    const col = (s) => `<div class="col"><img class="d" src="${src(s + '-desktop.png')}"><img class="l" src="${src(s + '-landscape.png')}"></div><img class="p" src="${src(s + '-portrait.png')}">`;
    await p.setContent(`<html><body style="margin:0;background:#0b1e2a;color:#eef3f4;font:600 30px sans-serif;padding:24px">
      <div style="margin-bottom:16px">${o.title}</div>
      <style>.row{display:flex;gap:16px;align-items:flex-start}.col{display:flex;flex-direction:column;gap:16px}.d{width:620px}.l{width:620px}.p{height:${620*720/1280+620*412/915+16}px}</style>
      <div class="row">${o.shots.map(col).join('')}</div></body></html>`);
    await p.waitForTimeout(500);
    const h = await p.evaluate(() => document.body.scrollHeight);
    const w = await p.evaluate(() => document.querySelector('.row').scrollWidth + 48);
    await p.setViewportSize({ width: w, height: h });
    const r = await p.evaluate(() => { const b = document.querySelector('.row').getBoundingClientRect(); return { w: b.right + 24, h: b.bottom + 24 }; });
    await p.screenshot({ path: `mock/overview-${k}.jpg`, type: 'jpeg', quality: 85, clip: { x: 0, y: 0, width: r.w, height: r.h } });
    await p.setViewportSize({ width: 2200, height: 1300 });
  }
  await b.close();
})();
