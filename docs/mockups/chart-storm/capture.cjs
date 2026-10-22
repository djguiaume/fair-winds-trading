/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, window, localStorage, document */
// Storm-on-chart mockups (decision 0067 follow-up): injects proposal SVG into the live chart.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = '/tmp/claude-0/shots/chart/';
const variants = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const v of variants) {
    const [name, w, h] = v.split(':');
    const p = await b.newPage({ viewport: { width: +(w || 1280), height: +(h || 720) } });
    await p.addInitScript(() => { localStorage.setItem('fwt.settings.v1', JSON.stringify({ seenWindHint: true, tutorialOffered: true, lang: 'en' })); });
    await p.goto('http://localhost:5199/?debug'); await p.waitForTimeout(1500);
    await p.click('#menu-play').catch(() => {}); await p.waitForTimeout(800); await p.keyboard.press('Escape');
    await p.evaluate(() => { const w = window.fwt.world; w.time = 1650; w.boat.x = 250; w.boat.y = -60; w.boat.heading = 3.6; window.fwt.view.target.set(250, 0, 60); });
    await p.waitForTimeout(1500);
    await p.click('#chart-btn'); await p.waitForTimeout(1000);
    await p.evaluate((name) => {
      const NS = 'http://www.w3.org/2000/svg';
      const old = document.querySelector('.chart-storm');
      const svg = old.ownerSVGElement;
      const parent = old.parentNode;
      const s = window.fwt.world.weather.storms[0];
      const vb = svg.viewBox.baseVal;
      const u = vb.width / svg.clientWidth; // map units per px
      const cx = s.x, cy = -s.y, R = s.radius, ux = s.dx, uy = -s.dy;
      const el = (tag, attrs, into, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text) e.textContent = text; (into || g).appendChild(e); return e; };
      old.remove();
      const g = document.createElementNS(NS, 'g'); parent.appendChild(g);
      const defs = el('defs', {});
      // rain hatching
      const pat = el('pattern', { id: 'rainhatch', width: 10 * u, height: 10 * u, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(25)' }, defs);
      el('line', { x1: 0, y1: 0, x2: 0, y2: 10 * u, stroke: 'rgba(230,240,255,0.55)', 'stroke-width': 1.6 * u }, pat);
      const pat2 = el('pattern', { id: 'dangerhatch', width: 9 * u, height: 9 * u, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
      el('line', { x1: 0, y1: 0, x2: 0, y2: 9 * u, stroke: 'rgba(200,70,50,0.55)', 'stroke-width': 3 * u }, pat2);
      const rg = el('radialGradient', { id: 'stormglow' }, defs);
      el('stop', { offset: '0', 'stop-color': 'rgb(22,32,44)', 'stop-opacity': '0.75' }, rg);
      el('stop', { offset: '0.55', 'stop-color': 'rgb(28,40,54)', 'stop-opacity': '0.5' }, rg);
      el('stop', { offset: '1', 'stop-color': 'rgb(28,40,54)', 'stop-opacity': '0' }, rg);
      const halo = { 'paint-order': 'stroke', stroke: 'rgba(6,20,28,0.85)', 'stroke-width': 4 * u, 'stroke-linejoin': 'round', 'text-anchor': 'middle', 'font-family': 'var(--display)', 'font-weight': 700, 'letter-spacing': '0.04em' };
      const cloudIcon = (x, y, size, into) => {
        const k = size / 24;
        const gg = el('g', { transform: `translate(${x - 12 * k},${y - 12 * k}) scale(${k})` }, into);
        el('circle', { cx: 12, cy: 12, r: 14, fill: '#1d2a36', stroke: '#f4ead2', 'stroke-width': 1.6 }, gg);
        el('path', { d: 'M6 14.5a3.6 3.6 0 0 1 1.2-7 5 5 0 0 1 9.4 1.2 3 3 0 0 1 1.4 5.8z', fill: '#f4ead2' }, gg);
        el('path', { d: 'M12.6 13.2l-3 4.6h2.6l-1.4 4.2 4.4-5.6h-2.6l1.6-3.2z', fill: '#ffcf4a' }, gg);
        return gg;
      };
      const label = (x, y, text, size, fill = '#fff', into) => el('text', { x, y, fill, 'font-size': size * u, ...halo }, into || g, text);
      const chevrons = (x, y, n, size, color, into) => {
        for (let i = 0; i < n; i++) {
          const px = x + ux * i * size * 0.9, py = y + uy * i * size * 0.9;
          const pts = [[px + ux * size * 0.5, py + uy * size * 0.5], [px - ux * size * 0.3 - uy * size * 0.55, py - uy * size * 0.3 + ux * size * 0.55], [px - ux * size * 0.1, py - uy * size * 0.1], [px - ux * size * 0.3 + uy * size * 0.55, py - uy * size * 0.3 - ux * size * 0.55]];
          el('polygon', { points: pts.map((q) => q.join(',')).join(' '), fill: color, opacity: 1 - i * 0.22, stroke: 'rgba(6,20,28,0.6)', 'stroke-width': u }, into || g);
        }
      };
      const dirName = (() => { const a = Math.atan2(s.dx, s.dy) * 180 / Math.PI; const n = ['N','NE','E','SE','S','SW','W','NW']; return n[Math.round(((a + 360) % 360) / 45) % 8]; })();
      if (name === 'A') {
        el('circle', { cx, cy, r: R, fill: 'url(#stormglow)' });
        chevrons(cx + ux * R * 0.45, cy + uy * R * 0.45, 3, 20 * u, '#f4ead2');
        cloudIcon(cx, cy, 34 * u);
        label(cx, cy - 26 * u, 'STORM', 15);
      } else if (name === 'B') {
        el('circle', { cx, cy, r: R, fill: 'rgba(28,40,54,0.45)' });
        el('circle', { cx, cy, r: R, fill: 'url(#rainhatch)' });
        el('circle', { cx, cy, r: R, fill: 'none', stroke: 'rgba(240,245,250,0.7)', 'stroke-width': 1.5 * u });
        // hurricane symbol, anticlockwise arms
        const k = 26 * u;
        const sym = el('g', { transform: `translate(${cx},${cy})` });
        el('circle', { r: k * 0.38, fill: 'none', stroke: '#f4ead2', 'stroke-width': 4 * u }, sym);
        el('path', { d: `M ${k*0.38} 0 C ${k*0.5} ${-k*0.9}, ${-k*0.2} ${-k*1.25}, ${-k*0.85} ${-k*1.05}`, fill: 'none', stroke: '#f4ead2', 'stroke-width': 4 * u, 'stroke-linecap': 'round' }, sym);
        el('path', { d: `M ${-k*0.38} 0 C ${-k*0.5} ${k*0.9}, ${k*0.2} ${k*1.25}, ${k*0.85} ${k*1.05}`, fill: 'none', stroke: '#f4ead2', 'stroke-width': 4 * u, 'stroke-linecap': 'round' }, sym);
        label(cx, cy + R + 18 * u, `Storm · drifting ${dirName}`, 14);
        chevrons(cx + ux * (R + 10 * u), cy + uy * (R + 10 * u), 3, 20 * u, '#f4ead2');
      } else if (name === 'C') {
        // corridor: where it will be over the next 2 minutes
        const speed = 3.2, t1 = 60;
        const p1 = [cx + ux * speed * t1, cy + uy * speed * t1];
        const nx = -uy, ny = ux;
        const corr = [[cx + nx * R, cy + ny * R], [p1[0] + nx * R, p1[1] + ny * R], [p1[0] - nx * R, p1[1] - ny * R], [cx - nx * R, cy - ny * R]];
        el('polygon', { points: corr.map((q) => q.join(',')).join(' '), fill: 'rgba(28,40,54,0.12)' });
        corr[1] = [p1[0] + nx * R, p1[1] + ny * R]; corr[2] = [p1[0] - nx * R, p1[1] - ny * R];
        for (const [p, t] of [[p1, 'in 1 min']]) {
          el('circle', { cx: p[0], cy: p[1], r: R, fill: 'none', stroke: 'rgba(28,40,54,0.55)', 'stroke-width': 1.5 * u, 'stroke-dasharray': `${6*u} ${5*u}` });
          label(p[0] + ux * R * 0.0, p[1] + uy * R * 0.0 + 5 * u, t, 13, '#f4ead2');
        }
        el('circle', { cx, cy, r: R, fill: 'url(#stormglow)' });
        cloudIcon(cx, cy, 34 * u);
        label(cx, cy - 26 * u, 'STORM', 15);
      } else if (name === 'D') {
        el('circle', { cx, cy, r: R, fill: 'rgba(200,70,50,0.12)' });
        el('circle', { cx, cy, r: R, fill: 'url(#dangerhatch)' });
        el('circle', { cx, cy, r: R, fill: 'none', stroke: '#c8463a', 'stroke-width': 2.5 * u });
        el('circle', { cx, cy, r: 14 * u, fill: '#c8463a', stroke: '#fff', 'stroke-width': 2 * u });
        el('text', { x: cx, y: cy + 6 * u, fill: '#fff', 'font-size': 18 * u, 'text-anchor': 'middle', 'font-weight': 900, 'font-family': 'var(--display)' }, g, '!');
        label(cx, cy - 22 * u, 'STORM', 15, '#ffd2c8');
        chevrons(cx + ux * (R + 10 * u), cy + uy * (R + 10 * u), 3, 20 * u, '#c8463a');
      }
      document.querySelectorAll('.chart-storm').forEach((e) => e.remove());
    }, name.split('-')[0]);
    await p.waitForTimeout(300);
    await p.screenshot({ path: OUT + name + '.png' });
    await p.close();
  }
  await b.close();
})();
