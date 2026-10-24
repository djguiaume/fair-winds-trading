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
      // Guillaume: smooth, natural curves, not angular. Chaikin corner cutting keeps the ends.
      for (let it = 0; it < 4; it++) {
        const l = window.__lane;
        const out = [l[0]];
        for (let i = 0; i < l.length - 1; i++) {
          const [ax, ay] = l[i],
            [bx, by] = l[i + 1];
          out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
        }
        out.push(l[l.length - 1]);
        window.__lane = out;
      }
      // Points every `step` units along the lane with a width factor: 1.3 at the ends, 0.85 mid-way.
      window.__laneSamples = (step) => {
        const l = window.__lane;
        let total = 0;
        for (let i = 1; i < l.length; i++) total += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
        const out = [];
        let done = 0;
        for (let i = 1; i < l.length; i++) {
          const [x0, y0] = l[i - 1],
            [x1, y1] = l[i];
          const len = Math.hypot(x1 - x0, y1 - y0);
          for (let t = 0; t < len; t += step) {
            const u = (done + t) / total;
            out.push([x0 + ((x1 - x0) * t) / len, y0 + ((y1 - y0) * t) / len, 0.85 + 0.45 * (2 * u - 1) ** 2]);
          }
          done += len;
        }
        return out;
      };
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
        const mid = lane[Math.floor(lane.length / 2)];
        const [ax, ay] = proj(mid[0], mid[1]);
        const [bx, by] = proj(mid[0] + 25, mid[1]);
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
        // Natural width: wide and slack at both ends, narrower (and faster) through the gap.
        bctx.fillStyle = '#000';
        for (const [x, y, f] of window.__laneSamples(4)) {
          const [sx, sy] = proj(x, y);
          bctx.beginPath();
          bctx.arc(sx * k, sy * k, halfPx * f * k, 0, Math.PI * 2);
          bctx.fill();
        }
        // Direction (Guillaume, round 4): soft wave crests across the flow, bowed downstream, that
        // would drift slowly with the current in the game. Lighter water, no outline, no arrows.
        const wave = document.createElement('canvas');
        wave.width = c.width;
        wave.height = c.height;
        const wctx = wave.getContext('2d');
        wctx.filter = `blur(${halfPx * 0.035 * k}px)`;
        wctx.strokeStyle = '#000';
        wctx.lineCap = 'round';
        wctx.lineWidth = Math.max(1.5, halfPx * 0.05) * k;
        const step = halfPx * 1.0;
        let carry = 0,
          row = 0;
        for (let j = 1; j < pts.length; j++) {
          const [x0, y0] = pts[j - 1];
          const [x1, y1] = pts[j];
          const len = Math.hypot(x1 - x0, y1 - y0);
          const tx = (x1 - x0) / len,
            ty = (y1 - y0) / len;
          const nx = -ty,
            ny = tx;
          for (let t = carry; t < len; t += step, row++) {
            const offs = row % 2 ? [-0.45, 0.4] : [-0.05, 0.75, -0.8];
            for (const o of offs) {
              const jit = Math.sin(row * 12.9898 + o * 78.233) * 0.5;
              const cx = x0 + tx * (t + jit * step * 0.4) + nx * o * halfPx;
              const cy = y0 + ty * (t + jit * step * 0.4) + ny * o * halfPx;
              const half = halfPx * (0.2 + 0.06 * jit);
              const bow = halfPx * 0.1;
              wctx.beginPath();
              wctx.moveTo((cx - nx * half) * k, (cy - ny * half) * k);
              wctx.quadraticCurveTo((cx + tx * bow) * k, (cy + ty * bow) * k, (cx + nx * half) * k, (cy + ny * half) * k);
              wctx.stroke();
            }
          }
          carry = (carry - len) % step;
          if (carry < 0) carry += step;
        }
        const wv = wctx.getImageData(0, 0, c.width, c.height).data;
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
          // Crests: lighter water where the band is strong, fading out with it.
          const wa = (wv[i + 3] / 255) * Math.min(1, a / 0.45) * 0.42;
          if (wa) {
            d[i] += (150 - d[i]) * wa;
            d[i + 1] += (205 - d[i + 1]) * wa;
            d[i + 2] += (225 - d[i + 2]) * wa;
          }
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
      tag.textContent = 'MOCKUP: darker current water with crests drifting east, readouts and hint are proposals';
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
        let html = '';
    // Guillaume: today's ring gets one current, along the line he drew, as darker water only.
    const lane = window.__lane;
    // Soft edges and a natural width (wider at the ends, narrower in the gap), no outline.
    html += `<defs><filter id="cur-soft" filterUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"><feGaussianBlur stdDeviation="6"/></filter></defs>`;
    html += `<g opacity=".38" filter="url(#cur-soft)">${window
      .__laneSamples(4)
      .map(([x, y, f]) => `<circle cx="${x.toFixed(1)}" cy="${(-y).toFixed(1)}" r="${(25 * f).toFixed(1)}" fill="rgb(16,70,120)"/>`)
      .join('')}</g>`;
    // The same crests as at sea, bowed downstream (east), so the chart shows the direction too.
    let carry = 0;
    for (let j = 1; j < lane.length; j++) {
      const [x0, y0] = lane[j - 1];
      const [x1, y1] = lane[j];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const tx = (x1 - x0) / len,
        ty = (y1 - y0) / len;
      for (let t = carry; t < len; t += 30) {
        const cx = x0 + tx * t,
          cy = y0 + ty * t;
        const a = [cx - ty * 11, -(cy + tx * 11)],
          q = [cx + tx * 5, -(cy + ty * 5)],
          b = [cx + ty * 11, -(cy - tx * 11)];
        html += `<path d="M${a} Q${q} ${b}" fill="none" stroke="rgba(190,235,250,.55)" stroke-width="2.5" stroke-linecap="round"/>`;
      }
      carry = (carry - len) % 30;
      if (carry < 0) carry += 30;
    }
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
    tag.textContent = 'MOCKUP: Guillaume’s current through the middle gap, darker water with crests';
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
