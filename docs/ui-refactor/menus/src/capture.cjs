/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, __dirname, console, window, document, sessionStorage, localStorage, mock, fwt */
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const root = '/home/user/fair-winds-trading';
const S = __dirname;
const out = process.argv[2]; const only = process.argv[3] || '';
const css = fs.readFileSync(S + '/mock.css', 'utf8');
const js = fs.readFileSync(S + '/mock.js', 'utf8');
const CM = {
  en: {
    map: ['Open the map', 'Pick your first harbour on the map. Sailing pauses while you plan.'],
    port: ['Choose a harbour', 'Tap a port to set your course, then close the map.'],
    sails: ['Sails and steering', 'Lower the sails, raise them again, and drag left or right to steer.', 'I know these controls'],
    wind: ['Let the wind help', 'Keep the bow out of the red zone. The green band is your fastest angle.', 'Continue', 'Tacking tips'],
    buy: ['Pick up a cargo', 'Saltmere makes fish, so it is cheap here. Buy one lot.'],
  },
  fr: {
    map: ['Ouvrez la carte', 'Choisissez votre premier port. La navigation est en pause pendant que vous regardez.'],
    port: ['Choisissez un port', 'Touchez un port pour fixer le cap, puis fermez la carte.'],
    sails: ['Voiles et barre', 'Affalez, puis hissez les voiles, et glissez à gauche ou à droite pour barrer.', 'Je connais'],
    wind: ['Le vent vous aide', 'Gardez l’étrave hors de la zone rouge. La bande verte est votre allure la plus rapide.', 'Continuer', 'Louvoyer'],
    buy: ['Prenez une cargaison', 'Saltmere produit du poisson, il est bon marché ici. Achetez un lot.'],
  },
};
(async () => {
  const { createServer } = await import(root + '/node_modules/vite/dist/node/index.js');
  const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 5194 } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const sizes = [['landscape', 844, 390, 'en'], ['desktop', 1280, 720, 'en'], ['portrait', 390, 844, 'fr']];
  for (const [size, width, height, lang] of sizes) {
    if (only && !only.split(',').includes(size)) continue;
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: size !== 'desktop', deviceScaleFactor: 2 });
    page.on('pageerror', e => console.log('ERR', size, e.message));
    page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
    await page.addInitScript((lang) => { window.MOCK_LANG = lang; if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x','1'); localStorage.clear(); localStorage.setItem('fwt.settings.v1', JSON.stringify({ quality: 'low', language: lang, seenWindHint: true, musicVolume: 0.6 })); } }, lang);
    await page.goto('http://127.0.0.1:5194/?debug');
    await page.waitForFunction(() => window.fwt);
    await page.addStyleTag({ content: css + '\n#menu,.tutorial-card,#tutorial-offer,#settings,#help{display:none!important} dialog#tutorial-offer::backdrop{display:none}' });
    await page.addScriptTag({ content: js });
    await page.evaluate((size) => document.body.classList.add(size), size);
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
    const shot = async (name) => { await page.waitForTimeout(300); await page.screenshot({ path: `${out}/${name}-${size}.png` }); };
    const c = CM[lang];
    await page.evaluate(() => mock.menu(false)); await shot('01-menu');
    await page.evaluate(() => document.getElementById('menu-play').click()); await page.waitForTimeout(400);
    await page.evaluate(() => mock.offer()); await shot('02-offer');
    await page.evaluate(() => { document.getElementById('tutorial-start').click(); mock.clear(); document.activeElement?.blur(); }); await page.waitForTimeout(300);
    await page.evaluate((c) => mock.coach({ target: '#chart-btn', step: 0, title: c.map[0], text: c.map[1], prefer: 'top' }), c); await shot('03-coach-map');
    await page.evaluate(() => mock.menu(true)); await shot('04-pause');
    await page.evaluate(() => mock.settings()); await shot('05-settings');
    await page.evaluate(() => mock.help()); await shot('06-help');
    await page.evaluate(() => { mock.clear(); document.getElementById('chart-btn').click(); }); await page.waitForTimeout(500);
    await page.evaluate((c) => { const n = [...document.querySelectorAll('.chart-port-name')].find(e => e.textContent.includes('Saltmere')); const g = n.closest('g') || n; mock.coach({ target: g.getBoundingClientRect(), pad: 8, step: 1, title: c.port[0], text: c.port[1] }); }, c); await shot('07-coach-port');
    await page.evaluate(() => { mock.clear(); document.getElementById('close-chart').click(); });
    await page.waitForTimeout(400);
    await page.evaluate((c) => mock.coach({ target: '#sail-lever', step: 2, title: c.sails[0], text: c.sails[1], act: `<div class="btn">${c.sails[2]}</div>`, prefer: 'left' }), c); await shot('08-coach-sails');
    await page.evaluate((c) => mock.coach({ target: '#wind-compass', step: 3, title: c.wind[0], text: c.wind[1], act: `<div class="btn brass">${c.wind[2]}</div><div class="btn">${c.wind[3]}</div>`, prefer: 'left' }), c); await shot('09-coach-wind');
    await page.evaluate(() => { mock.clear(); const w = fwt.world; const h = fwt.view.harbours.saltmere; w.boat.x = h.x; w.boat.y = h.y; w.boat.speedKn = 0; });
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(2500);
    await page.evaluate((c) => mock.coach({ target: '.good-row .buy-btn', step: 5, title: c.buy[0], text: c.buy[1], prefer: 'bottom' }), c); await shot('10-coach-buy');
    await page.close();
  }
  await browser.close(); await server.close();
})().catch(e => { console.error(e); process.exit(1); });
