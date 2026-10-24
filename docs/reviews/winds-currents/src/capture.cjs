/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, window, document, localStorage */
// Winds and currents mockups (Phase 4, ADR 0137): real game captures with the proposed readouts
// drawn on top (blue current arrow on the compass, SOG under the speed, current streaks, a first-time
// hint, a chart layer). Nothing here is game code. Run against `npx vite --port 5199`:
//   node docs/reviews/winds-currents/src/capture.cjs
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = path.join(__dirname, '..');

const SHOTS = [
  // name, w, h, scene
  ['sea-current-desktop', 1280, 720, 'current'],
  ['sea-current-landscape', 844, 390, 'current'],
  ['sea-current-portrait', 390, 844, 'current'],
  ['sea-doldrums-desktop', 1280, 720, 'doldrums'],
  ['chart-layer-desktop', 1280, 720, 'chart'],
  ['chart-layer-portrait', 390, 844, 'chart'],
];

// Set of the current in the mockups: towards the south-east, 1.8 kn.
const SET_DEG = 135;

async function scene(p, kind) {
  await p.evaluate(
    ([kind]) => {
      const { world } = window.fwt;
      world.time = 260;
      world.dynamicWeather = false;
      world.boat.x = 230;
      world.boat.y = -10;
      const from = world.seaWind.from;
      world.boat.heading = (from + Math.PI / 2) % (Math.PI * 2);
      world.boat.speedKn = kind === 'doldrums' ? 1.4 : 8.2;
      world.boat.sailStep = 2;
      world.boat.sail = 1;
    },
    [kind],
  );
}

// Proposed sea readouts, drawn over the live HUD.
async function seaOverlay(p, kind, setDeg) {
  await p.evaluate(
    ([kind, setDeg]) => {
      const css = document.createElement('style');
      css.textContent = `
        .mock-sog{display:block;font:600 12px system-ui,sans-serif;color:#9fe3ff;letter-spacing:.02em;margin-top:2px}
        .mock-streaks{position:fixed;inset:0;pointer-events:none;z-index:3}
        .mock-sheen{position:fixed;inset:0;pointer-events:none;z-index:2;background:radial-gradient(ellipse at 50% 60%,rgba(235,250,255,.28),rgba(235,250,255,0) 65%)}
        .mock-tag{position:fixed;z-index:50;font:700 11px system-ui,sans-serif;color:#10303a;background:#ffd166;border-radius:6px;padding:2px 6px}`;
      document.head.appendChild(css);
      const log = document.querySelector('#speed-log');
      if (kind === 'current') {
        const sog = document.createElement('span');
        sog.className = 'mock-sog';
        sog.textContent = 'SOG 9.6 kn';
        log.appendChild(sog);
        // Current arrow on the compass ring: blue, pointing where the water flows.
        const svg = document.querySelector('#wind-help-trigger svg');
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `rotate(${setDeg})`);
        g.innerHTML =
          '<path d="M0 -47 L6 -37 L2 -38 L2 -30 L-2 -30 L-2 -38 L-6 -37 Z" fill="#2f8fff" stroke="#0b2a4a" stroke-width="1"/>';
        svg.appendChild(g);
        const cap = document.querySelector('.wind-caption');
        const cur = document.createElement('span');
        cur.className = 'mock-sog';
        cur.textContent = 'Current 1.8 kn → SE';
        cap.appendChild(cur);
        // Streaks on the water, flowing with the current.
        const w = window.innerWidth,
          h = window.innerHeight;
        const ns = 'http://www.w3.org/2000/svg';
        const s = document.createElementNS(ns, 'svg');
        s.setAttribute('class', 'mock-streaks');
        s.setAttribute('viewBox', `0 0 ${w} ${h}`);
        const a = ((setDeg - 90) * Math.PI) / 180;
        const dx = Math.cos(a),
          dy = Math.sin(a);
        let html = '';
        let seed = 7;
        const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
        for (let i = 0; i < 26; i++) {
          const x = r() * w,
            y = h * 0.25 + r() * h * 0.7;
          const L = 40 + r() * 50;
          html += `<path d="M${x},${y} q${(dx * L) / 2 + dy * 6},${(dy * L) / 2 - dx * 6} ${dx * L},${dy * L}" stroke="rgba(190,235,255,.55)" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
          if (i % 3 === 0)
            html += `<path d="M${x + dx * L},${y + dy * L} l${-dx * 8 + dy * 5},${-dy * 8 - dx * 5} M${x + dx * L},${y + dy * L} l${-dx * 8 - dy * 5},${-dy * 8 + dx * 5}" stroke="rgba(190,235,255,.7)" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
        }
        s.innerHTML = html;
        document.body.appendChild(s);
      } else {
        const sheen = document.createElement('div');
        sheen.className = 'mock-sheen';
        document.body.appendChild(sheen);
        // The live loop rewrites the readouts every frame: hide them and draw the proposed ones.
        css.textContent += `#speed,#wind-force,#wind-text,#wind-gust{display:none!important}
          .mock-big{font:inherit}.mock-wind{display:block;font:700 13px system-ui,sans-serif;color:#9fe3ff;text-transform:uppercase}`;
        const speed = document.createElement('span');
        speed.className = 'mock-big';
        speed.textContent = '1.4';
        document.querySelector('#speed').after(speed);
        const cap = document.querySelector('.wind-caption');
        const wind = document.createElement('span');
        wind.className = 'mock-wind';
        wind.textContent = 'Light air NE · 2 kn';
        const zone = document.createElement('span');
        zone.className = 'mock-sog';
        zone.textContent = 'DOLDRUMS';
        cap.prepend(zone);
        cap.prepend(wind);
      }
      const toast = document.querySelector('#toast');
      toast.hidden = false;
      toast.textContent =
        kind === 'current'
          ? 'A strong current sets you south-east. Aim a little up-current to hold your course.'
          : 'The doldrums: the wind is light here. Light, swift ships slip through best.';
      const tag = document.createElement('div');
      tag.className = 'mock-tag';
      tag.textContent = 'MOCKUP: blue readouts, streaks and hint are proposals';
      tag.style.left = '8px';
      tag.style.bottom = '8px';
      document.body.appendChild(tag);
    },
    [kind, setDeg],
  );
}

// Proposed chart layer, drawn into the live chart's own SVG (world units, y flipped).
async function chartOverlay(p) {
  await p.evaluate(() => {
    const svg = document.querySelector('#chart-map');
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    const chev = (x, y, deg, color, size = 9) =>
      `<path transform="translate(${x},${-y}) rotate(${deg})" d="M${-size},${size * 0.7} L0,${-size * 0.7} L${size},${size * 0.7}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    let html = '';
    // Example current lane through the passage between Skerry and Gull Hook, flowing south-east.
    const lane = [
      [-170, 40],
      [-90, -40],
      [0, -110],
      [90, -200],
      [170, -290],
    ];
    html += `<path d="M${lane.map(([x, y]) => `${x},${-y}`).join(' L')}" stroke="rgba(47,143,255,.28)" stroke-width="44" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    for (let i = 0; i < lane.length - 1; i++) {
      const [x0, y0] = lane[i],
        [x1, y1] = lane[i + 1];
      const deg = (Math.atan2(x1 - x0, y1 - y0) * 180) / Math.PI;
      for (const t of [0.3, 0.75]) html += chev(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, deg, '#1b6fd6');
    }
    html += `<text x="190" y="${290 + 22}" class="mock-label">current 1.8 kn</text>`;
    // Example doldrums patch and a trade-wind belt.
    html += `<ellipse cx="-300" cy="${230}" rx="95" ry="55" fill="rgba(235,250,255,.45)" stroke="#fff" stroke-dasharray="8 6" stroke-width="2.5"/>`;
    html += `<text x="-300" y="${236}" class="mock-label">doldrums</text>`;
    for (let i = 0; i < 5; i++) html += chev(-80 + i * 70, 370, -100, 'rgba(255,255,255,.85)', 8);
    html += `<text x="60" y="${-370 + 30}" class="mock-label">steady trade wind</text>`;
    g.innerHTML =
      `<style>.mock-label{font:700 15px system-ui,sans-serif;fill:#0b3c55;stroke:#e9fbff;stroke-width:4;paint-order:stroke;text-anchor:middle}</style>` +
      html;
    svg.appendChild(g);
    // A layer toggle in the chart header, next to the legend button.
    const legend = document.querySelector('#chart-legend-toggle');
    const btn = legend.cloneNode(true);
    btn.id = 'mock-layer';
    const label = btn.querySelector('.chart-legend-label');
    label.textContent = 'Winds & currents';
    label.style.display = 'inline';
    btn.querySelector('use').setAttribute('href', '#i-compass');
    btn.style.width = 'auto';
    btn.style.padding = '0 10px';
    // The journal opens by itself on a fresh voyage; close it so the layer shows.
    const journal = document.querySelector('#chart-journal-panel');
    if (journal) journal.hidden = true;
    btn.style.outline = '2px solid #2f8fff';
    btn.style.background = '#2f8fff';
    btn.style.color = '#fff';
    legend.parentNode.insertBefore(btn, legend);
    const tag = document.createElement('div');
    tag.textContent = 'MOCKUP: example current, doldrums and trade wind on today’s sea';
    tag.style.cssText =
      'position:fixed;left:8px;bottom:8px;z-index:9999;font:700 11px system-ui,sans-serif;color:#10303a;background:#ffd166;border-radius:6px;padding:2px 6px';
    document.body.appendChild(tag);
  });
}

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  for (const [name, w, h, kind] of SHOTS) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.addInitScript(() => {
      localStorage.setItem(
        'fwt.settings.v1',
        JSON.stringify({ seenWindHint: true, tutorialOffered: true, language: 'en', dayNight: false }),
      );
    });
    await p.goto('http://localhost:5199/?debug');
    await p.waitForTimeout(1500);
    await p.click('#menu-play', { timeout: 2000 }).catch(() => {});
    await p.waitForTimeout(500);
    // A fresh voyage asks for a difficulty level first (decision 0083): Captain is preselected.
    await p.click('#set-sail', { timeout: 2000 }).catch(() => {});
    await p.waitForTimeout(800);
    await p.keyboard.press('Escape');
    await p.click('#tp-undock', { timeout: 1500 }).catch(() => {});
    await p.waitForTimeout(300);
    await scene(p, kind === 'chart' ? 'current' : kind);
    await p.waitForTimeout(1500);
    if (kind === 'chart') {
      await p.click('#chart-btn');
      await p.waitForTimeout(800);
      await chartOverlay(p);
    } else {
      await seaOverlay(p, kind, SET_DEG);
    }
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(OUT, `${name}.png`) });
    await p.close();
    console.log('wrote', name);
  }
  await b.close();
})();
