const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const dir = path.resolve('mock');
const src = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');
const opts = {
  A: { title: 'Option A · Un mot sur le quai', shots: [['A1-quay', '1. Vous accostez : Kit attend dans l’écran du port, le marché reste utilisable'], ['A2-listen', '2. Vous touchez « Écouter Kit » : la conversation remplace le marché, dans l’écran du port']] },
  B: { title: 'Option B · Onglet Quai', shots: [['B1-badge', '1. Vous accostez : rien ne s’ouvre, un badge sur l’onglet QUAI et une ligne en bas'], ['B2-people', '2. Vous ouvrez l’onglet QUAI : toutes les personnes du port']] },
  C: { title: 'Option C · Carte d’arrivée', shots: [['C1-arrival', '1. Vous accostez : la carte s’affiche AVANT l’écran du port'], ['S-sea-note', 'En mer (toutes les options) : une petite note au lieu d’une carte']] },
};
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 2000, height: 1200 } });
  for (const [k, o] of Object.entries(opts)) {
    const fig = (f, label, cls) => `<figure class="${cls}"><figcaption>${label}</figcaption><img src="${src(f)}"></figure>`;
    const row = ([s, cap]) => `<h2>${cap}</h2><div class="row">${fig(s + '-desktop.png', 'Ordinateur', 'd')}${fig(s + '-landscape.png', 'Téléphone, paysage', 'l')}${fig(s + '-portrait.png', 'Téléphone, portrait', 'p')}</div>`;
    await p.setContent(`<html><head><style>
      body{margin:0;background:#0b1e2a;color:#eef3f4;font:600 26px sans-serif;padding:28px}
      h1{margin:0 0 6px;font-size:40px;color:#e8c46a} h2{margin:26px 0 10px;font-size:28px}
      .row{display:flex;gap:24px;align-items:flex-start} figure{margin:0} figcaption{font-size:22px;color:#e8c46a;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em}
      .d img{width:820px}.l img{width:720px}.p img{height:540px}
      img{display:block;border:2px solid #e8c46a55;border-radius:8px}
    </style></head><body><h1>${o.title}</h1>${o.shots.map(row).join('')}</body></html>`);
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({ w: Math.max(...[...document.querySelectorAll('.row')].map((e) => e.scrollWidth)) + 56, h: document.body.scrollHeight }));
    await p.setViewportSize({ width: r.w, height: r.h });
    await p.screenshot({ path: `mock/overview-${k}.jpg`, type: 'jpeg', quality: 85, fullPage: true });
    await p.setViewportSize({ width: 2000, height: 1200 });
  }
  await b.close();
})();
