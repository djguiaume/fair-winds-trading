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

// Set of the current in the mockups: towards the east, 1.8 kn.
const SET_DEG = 90;

async function scene(p, kind) {
  await p.evaluate(
    ([kind]) => {
      const { world } = window.fwt;
      world.time = 260;
      world.dynamicWeather = false;
      // Guillaume's current (2026-10-24): from the north-west edge, north of Westholm, east through
      // the middle gap between Greyback Ridge and Gull Hook, out towards Saltmere's reefs.
      window.__lane = [
        [-362, 248],
        [-330, 200],
        [-245, 142],
        [-168, 52],
        [-52, 19],
        [103, 52],
        [155, 84],
        [271, 65],
      ];
      // In the middle gap, sailing west against the current: the slow way home.
      world.boat.x = kind === 'current' ? -60 : 230;
      world.boat.y = kind === 'current' ? 22 : -10;
      world.boat.heading = kind === 'current' ? (275 * Math.PI) / 180 : (world.seaWind.from + Math.PI / 2) % (Math.PI * 2);
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
    async ([kind, setDeg]) => {
      const css = document.createElement('style');
      css.textContent = `
        .mock-sog{display:block;font:600 12px system-ui,sans-serif;color:#9fe3ff;letter-spacing:.02em;margin-top:2px}
        .mock-streaks{position:fixed;inset:0;pointer-events:none}
        .mock-sheen{position:fixed;inset:0;pointer-events:none;z-index:2;background:radial-gradient(ellipse at 50% 60%,rgba(235,250,255,.28),rgba(235,250,255,0) 65%)}
        .mock-tag{position:fixed;z-index:50;font:700 11px system-ui,sans-serif;color:#10303a;background:#ffd166;border-radius:6px;padding:2px 6px}`;
      document.head.appendChild(css);
      const log = document.querySelector('#speed-log');
      if (kind === 'current') {
        const sog = document.createElement('span');
        sog.className = 'mock-sog';
        sog.textContent = 'SOG 6.1 kn';
        log.appendChild(sog);
        // Only visuals (Guillaume): the current is water of another colour along its lane, with
        // soft edges and no outline. Drawn along the real lane, projected through the game camera.
        const cap = document.querySelector('.wind-caption');
        const cur = document.createElement('span');
        cur.className = 'mock-sog';
        cur.textContent = 'Current 1.8 kn E';
        cap.appendChild(cur);
        const w = window.innerWidth,
          h = window.innerHeight;
        const cam = window.fwt.view.camera;
        cam.updateMatrixWorld();
        const mul = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
        // World (x, y) sits at (x, 0, -y) in the scene.
        const proj = (x, y) => {
          const c = mul(cam.projectionMatrix.elements, mul(cam.matrixWorldInverse.elements, [x, 0, -y, 1]));
          return [((c[0] / c[3] + 1) / 2) * w, ((1 - c[1] / c[3]) / 2) * h];
        };
        const lane = window.__lane;
        const pts = lane.map(([x, y]) => proj(x, y));
        const [ax, ay] = proj(lane[3][0], lane[3][1]);
        const [bx, by] = proj(lane[3][0] + 25, lane[3][1]);
        const halfPx = Math.hypot(bx - ax, by - ay);
        // Tint only the water pixels of a clean capture of the sea (the boat, reefs, foam and land
        // keep their colours), with a soft-edged band and no outline, as a sea shader would.
        const img = new Image();
        img.src = window.__seaShot;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const k = img.width / w;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const band = document.createElement('canvas');
        band.width = c.width;
        band.height = c.height;
        const bctx = band.getContext('2d');
        bctx.filter = `blur(${halfPx * 0.3 * k}px)`;
        bctx.strokeStyle = '#000';
        bctx.lineWidth = halfPx * 2 * k;
        bctx.lineCap = 'round';
        bctx.lineJoin = 'round';
        bctx.beginPath();
        pts.forEach(([x, y], i) => (i ? bctx.lineTo(x * k, y * k) : bctx.moveTo(x * k, y * k)));
        bctx.stroke();
        const px = ctx.getImageData(0, 0, c.width, c.height);
        const m = bctx.getImageData(0, 0, c.width, c.height).data;
        const d = px.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = (m[i + 3] / 255) * 0.62;
          if (!a) continue;
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (!(b > r + 45 && g > r + 35)) continue; // water only
          d[i] = r + (8 - r) * a;
          d[i + 1] = g + (66 - g) * a;
          d[i + 2] = b + (120 - b) * a;
        }
        ctx.putImageData(px, 0, 0);
        c.className = 'mock-streaks';
        c.style.width = w + 'px';
        c.style.height = h + 'px';
        // Just after the game canvas, so it covers the sea and the HUD still paints over it.
        const game = document.querySelector('canvas');
        game.after(c);
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
          ? 'A current runs east through the gap: quick going east, slow coming back. Around Greyback Ridge may be faster.'
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
    // Guillaume: today's ring gets one current, along the line he drew, as darker water only.
    const lane = window.__lane;
    const d = `M${lane.map(([x, y]) => `${x},${-y}`).join(' L')}`;
    html += `<path d="${d}" stroke="rgba(16,70,120,.36)" stroke-width="50" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    html += `<text x="215" y="${-112}" class="mock-label">current 1.8 kn</text>`;
    g.innerHTML =
      `<style>.mock-label{font:700 15px system-ui,sans-serif;fill:#0b3c55;stroke:#e9fbff;stroke-width:4;paint-order:stroke;text-anchor:middle}</style>` +
      html;
    svg.appendChild(g);
    // No layer toggle: like at sea, current water is always drawn on the chart.
    // The journal opens by itself on a fresh voyage; close it so the current shows.
    const journal = document.querySelector('#chart-journal-panel');
    if (journal) journal.hidden = true;
    const tag = document.createElement('div');
    tag.textContent = 'MOCKUP: Guillaume’s current through the middle gap, darker water only';
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
    if (kind === 'current') await p.evaluate(() => window.fwt.view.setZoom(1.6));
    await p.waitForTimeout(1500);
    if (kind === 'chart') {
      await p.click('#chart-btn');
      await p.waitForTimeout(800);
      await chartOverlay(p);
    } else {
      if (kind === 'current') {
        // A clean capture of the sea alone (HUD hidden), which the overlay tints.
        await p.addStyleTag({ content: 'body *{visibility:hidden!important} canvas{visibility:visible!important}' }).then((h) => h.evaluate((el) => (el.id = 'clean-css')));
        const shot = await p.screenshot();
        await p.evaluate((u) => { window.__seaShot = u; document.querySelector('#clean-css').remove(); }, 'data:image/png;base64,' + shot.toString('base64'));
      }
      await seaOverlay(p, kind, SET_DEG);
    }
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(OUT, `${name}.png`) });
    await p.close();
    console.log('wrote', name);
  }
  await b.close();
})();
