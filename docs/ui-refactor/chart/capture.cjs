/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, window, localStorage, document, fwt, MutationObserver, setTimeout, console */
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = process.cwd();
(async () => {
  const { createServer } = await import(root + '/node_modules/vite/dist/node/index.js');
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 5191 } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const dir = root + '/docs/ui-refactor/chart';
  const results = [], errors = [];
  try {
    for (const [name, width, height, quality, language] of [
      ['desktop', 1280, 720, 'medium', 'en'],
      ['tablet-fr', 1024, 768, 'low', 'fr'],
      ['phone-landscape-fr', 844, 390, 'low', 'fr'],
      ['phone-portrait', 390, 844, 'high', 'en'],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(({quality,language}) => localStorage.setItem('fwt.settings.v1', JSON.stringify({ quality, language, seenHelp: true, seenWindHint: true, musicVolume: 0 })), {quality,language});
      await page.goto('http://127.0.0.1:5191/?debug');
      await page.waitForFunction(() => window.fwt);
      await page.click('#menu-play');
      if (await page.locator('#tutorial-offer').evaluate(e => e.open)) await page.click('#tutorial-free');
      // Staged discovery exposes every harbour for a complete chart review; geometry is unchanged.
      await page.evaluate(() => { fwt.world.trade.progress.discovered = fwt.world.map.ports.map(p => p.id); });
      await page.click('#chart-btn');
      await page.waitForTimeout(150); // allow ResizeObserver and font layout to settle
      const idle = await page.evaluate(async () => {
        let mutations = 0, renders = 0;
        const observer = new MutationObserver(list => mutations += list.length);
        observer.observe(document.querySelector('#chart-map'), { subtree:true,childList:true,attributes:true });
        const render = fwt.view.render; fwt.view.render = () => { renders++; };
        const time = fwt.world.time;
        await new Promise(resolve => setTimeout(resolve, 250));
        observer.disconnect(); fwt.view.render = render;
        return { mutations, renders, elapsedWorldTime: fwt.world.time-time };
      });
      assert.deepEqual(idle, {mutations:0,renders:0,elapsedWorldTime:0});
      const layout = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        map: document.querySelector('#chart-map').getBoundingClientRect().toJSON(),
        player: document.querySelector('.chart-player').getBoundingClientRect().toJSON(),
        sheets: document.querySelectorAll('.chart-sheet:not([hidden])').length,
      }));
      assert.equal(layout.width, width); assert.equal(layout.sheets, 0);
      assert.ok(layout.map.height > height * .75); assert.ok(layout.player.height >= 25);
      await page.screenshot({ path: `${dir}/${name}.png` });
      await page.click('#chart-legend-toggle');
      await page.screenshot({ path: `${dir}/${name}-legend.png` });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#chart').evaluate(e=>e.open), true);
      assert.equal(await page.locator('#chart-legend-panel').evaluate(e=>e.hidden), true);
      await page.click('#chart-market-toggle');
      const marketFits = await page.locator('#chart-market-panel').evaluate(e => e.scrollWidth <= e.clientWidth + 2);
      assert.equal(marketFits, true);
      await page.screenshot({ path: `${dir}/${name}-prices.png` });
      await page.click('[data-compare="westholm"]');
      assert.equal(await page.evaluate(()=>fwt.world.destination.portId), 'westholm');
      await page.click('#chart-market-panel [data-chart-close]');
      await page.locator('[data-chart-target="calda"] .chart-port-name').click();
      assert.equal(await page.evaluate(()=>fwt.world.destination.portId), 'calda');
      const pins = () => page.evaluate(() => JSON.parse(localStorage.getItem(`fwt.chart.v1.${fwt.world.map.name}`) || '[]').length);
      assert.equal(await pins(), 0);
      for (let i=0;i<3;i++) await page.click('#chart-zoom-in');
      const zoomed = await page.locator('.chart-player').evaluate(e => e.getBoundingClientRect().toJSON());
      assert.ok(Math.abs(zoomed.height-layout.player.height)<.6,JSON.stringify({name,zoomed,initial:layout.player}));
      const before = await page.locator('#chart-map').getAttribute('viewBox');
      await page.mouse.move(width/2,height/2);await page.mouse.down();
      await page.mouse.move(width/2-60,height/2-45,{steps:8});await page.mouse.up();
      assert.notEqual(await page.locator('#chart-map').getAttribute('viewBox'),before);
      assert.equal(await pins(),0);
      await page.click('#chart-fit');
      const water = await page.locator('#chart-map').evaluate(svg => {
        const p=svg.createSVGPoint(); p.x=0;p.y=100; const screen=p.matrixTransform(svg.getScreenCTM());return {x:screen.x,y:screen.y};
      });
      await page.touchscreen.tap(water.x,water.y);assert.equal(await pins(),1);
      await page.click('#chart-markers-toggle');await page.click('#chart-pin-here');assert.equal(await pins(),2);
      await page.click('#chart-pins button');
      assert.equal(await page.evaluate(()=>fwt.world.destination.label.startsWith('Marker') || fwt.world.destination.label.startsWith('Repère')),true);
      await page.click('#chart-pins button:nth-child(2)');
      assert.equal(await pins(), 1);
      assert.equal(await page.evaluate(() => fwt.world.destination), null);
      await page.click('#chart-pin-here');
      assert.equal(await pins(), 2);
      await page.click('#chart-pins button');
      await page.click('#chart-clear-target');assert.equal(await page.evaluate(()=>fwt.world.destination),null);
      await page.keyboard.press('Escape');await page.keyboard.press('Escape');
      assert.equal(await page.locator('#chart').evaluate(e=>e.open),false);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'chart-btn');
      await page.click('#chart-btn');assert.equal(await pins(),2);
      assert.equal(await page.locator('#chart-zoom-out').isDisabled(),true);
      await page.setViewportSize({ width: height, height: width });
      await page.waitForTimeout(100);
      const resized = await page.evaluate(() => ({ width:document.documentElement.scrollWidth,
        mapHeight:document.querySelector('#chart-map').getBoundingClientRect().height,
        playerHeight:document.querySelector('.chart-player').getBoundingClientRect().height }));
      assert.equal(resized.width, height);
      assert.ok(resized.mapHeight > width * .75);
      assert.ok(Math.abs(resized.playerHeight - layout.player.height) < .6);
      results.push({name,width,height,quality,language,idle,layout,marketFits,zoomPlayerHeight:zoomed.height,touchAndMouseInteractions:true});
      await page.close();
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(dir+'/browser-checks.json',JSON.stringify({results,errors},null,2)+'\n');
    console.log(JSON.stringify({profiles:results.map(r=>r.name),errors},null,2));
  } finally {await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
