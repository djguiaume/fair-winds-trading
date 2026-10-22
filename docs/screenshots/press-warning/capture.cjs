/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, window, localStorage, document */
// Press warning (decision 0078): the sails control and the lee edge in amber and red, the
// one-time message, and the Strong wind card in How to play. Run with the dev server on 5199.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = process.env.OUT ?? './';
const shots = [
  ['landscape-amber', 844, 390, 'amber', true],
  ['landscape-red', 844, 390, 'red', true],
  ['landscape-first-message', 844, 390, 'amber', false],
  ['portrait-amber', 390, 844, 'amber', true],
  ['portrait-red', 390, 844, 'red', true],
  ['desktop-red', 1280, 720, 'red', true],
  ['help', 1280, 720, 'help', true],
  ['help-portrait', 390, 844, 'help', true],
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [name, w, h, mode, seen] of shots) {
    const phone = w < 1000;
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
    await p.addInitScript((seen) => {
      localStorage.setItem('fwt.settings.v1', JSON.stringify({ seenWindHint: true, seenHelp: true, tutorialOffered: true, language: 'en', storms: false, seenPressHint: seen }));
    }, seen);
    await p.goto('http://localhost:5199/?debug'); await p.waitForTimeout(1500);
    if (mode === 'help') {
      await p.click('#menu-help'); await p.waitForTimeout(800);
      await p.screenshot({ path: OUT + name + '.png' });
      await p.close();
      continue;
    }
    await p.click('#menu-play').catch(() => {}); await p.waitForTimeout(800); await p.keyboard.press('Escape');
    await p.evaluate((mode) => {
      const wd = window.fwt.world, v = window.fwt.view;
      wd.boat.x = 120; wd.boat.y = 20; v.target.set(120, 0, -20);
      wd.boat.sailStep = 2; wd.boat.sail = 1;
      wd.boat.heading = wd.wind.from + Math.PI / 2;
      // Hold the press steady (headless runs at a few fps): amber 18.5 kn, red 20 kn right now.
      const [avg, now] = mode === 'red' ? [19, 20.2] : [18.4, 18.6];
      Object.defineProperty(wd, 'pressKn', { get: () => avg, set() {} });
      Object.defineProperty(wd, 'pressNowKn', { get: () => now, set() {} });
      const a = ((mode === 'red' ? 23 : 19) * Math.PI) / 180;
      v.heel.update = () => { v.heel.angle = a; return a; };
      document.querySelector('.press-glow').style.animation = 'none';
    }, mode);
    await p.waitForTimeout(3000);
    await p.screenshot({ path: OUT + name + '.png' });
    await p.close();
  }
  await b.close();
})();
