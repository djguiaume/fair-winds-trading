/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, window, document, localStorage */
// Winds and currents mockups (Phase 4, ADR 0137): real game captures with the proposed readouts
// drawn on top (a band of darker current water, SOG under the speed, a first-time hint). Nothing here is game code. Run against `npx vite --port 5199`:
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
  ['chart-ring-current-desktop', 1280, 720, 'chart'],
  ['chart-ring-current-portrait', 390, 844, 'chart'],
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
        // No arrows (Guillaume): the current is a band of visibly different water. Darker, bluer,
        // with a fine ripple texture inside and a line of broken water (a tide rip) along its edges.
        const cap = document.querySelector('.wind-caption');
        const cur = document.createElement('span');
        cur.className = 'mock-sog';
        cur.textContent = 'Current 1.8 kn SE';
        cap.appendChild(cur);
        const w = window.innerWidth,
          h = window.innerHeight;
        const ns = 'http://www.w3.org/2000/svg';
        const s = document.createElementNS(ns, 'svg');
        s.setAttribute('class', 'mock-streaks');
        s.setAttribute('viewBox', `0 0 ${w} ${h}`);
        const a = ((setDeg - 90) * Math.PI) / 180;
        const dx = Math.cos(a),
          dy = Math.sin(a);
        // The band runs along the current through the middle of the screen, the boat inside it.
        const cx = w * 0.48,
          cy = h * 0.45,
          half = Math.min(w, h) * 0.24,
          len = Math.max(w, h) * 1.2;
        const nx = -dy,
          ny = dx;
        const edge = (side) => {
          const pts = [];
          for (let i = -12; i <= 12; i++) {
            const t = (i / 12) * len;
            const wob = Math.sin(i * 1.7) * half * 0.12;
            pts.push([cx + dx * t + nx * (side * half + wob), cy + dy * t + ny * (side * half + wob)]);
          }
          return pts;
        };
        const left = edge(-1),
          right = edge(1);
        const poly = [...left, ...right.reverse()].map((p) => p.join(',')).join(' ');
        let html = `<defs><filter id="soft"><feGaussianBlur stdDeviation="${half * 0.12}"/></filter></defs>`;
        html += `<polygon points="${poly}" fill="rgba(16,70,120,.33)" filter="url(#soft)"/>`;
        // Ripple texture: short, crossed wavelets, denser than the open sea's.
        let seed = 7;
        const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
        for (let i = 0; i < 70; i++) {
          const t = (r() * 2 - 1) * len * 0.6,
            o = (r() * 2 - 1) * half * 0.8;
          const x = cx + dx * t + nx * o,
            y = cy + dy * t + ny * o;
          const L = 10 + r() * 14;
          html += `<path d="M${x - nx * L},${y - ny * L} q${nx * L},${ny * L - 5} ${nx * L * 2},${ny * L * 2}" stroke="rgba(200,240,255,.35)" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
        }
        // Tide rips: broken white water along both edges.
        for (const side of [left, right]) {
          html += `<polyline points="${side.map((p) => p.join(',')).join(' ')}" fill="none" stroke="rgba(235,250,255,.55)" stroke-width="3" stroke-dasharray="3 9 12 7" stroke-linecap="round"/>`;
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
      tag.textContent = 'MOCKUP: darker current water, readouts and hint are proposals';
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
    // Guillaume: today's ring can have some of this, not all of it. One current only, through the
    // passage between Skerry and Gull Hook, drawn as darker water like at sea (no arrows).
    const lane = [
      [-170, 40],
      [-90, -40],
      [0, -110],
      [90, -200],
      [170, -290],
    ];
    const d = `M${lane.map(([x, y]) => `${x},${-y}`).join(' L')}`;
    html += `<path d="${d}" stroke="rgba(16,70,120,.38)" stroke-width="44" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    html += `<path d="${d}" stroke="rgba(220,245,255,.55)" stroke-width="2" stroke-dasharray="3 10" fill="none" stroke-linecap="round"/>`;
    html += `<text x="190" y="${290 + 22}" class="mock-label">current 1.8 kn</text>`;
    g.innerHTML =
      `<style>.mock-label{font:700 15px system-ui,sans-serif;fill:#0b3c55;stroke:#e9fbff;stroke-width:4;paint-order:stroke;text-anchor:middle}</style>` +
      html;
    svg.appendChild(g);
    // No layer toggle: like at sea, current water is always drawn on the chart.
    // The journal opens by itself on a fresh voyage; close it so the current shows.
    const journal = document.querySelector('#chart-journal-panel');
    if (journal) journal.hidden = true;
    const tag = document.createElement('div');
    tag.textContent = 'MOCKUP: one example current on today’s sea, as darker water';
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
