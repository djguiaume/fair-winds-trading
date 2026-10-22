/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, window, document, localStorage, innerWidth, innerHeight */
// Solid harbour obstacles (decision 0081): moored boats and grown yard docks, with an overlay of
// the collision capsules drawn from the live world.piers. Run against `npx vite --port 5199`.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const OUT = process.env.OUT ?? './';
const SHOTS = [
  // name, w, h, port, island, overlay, ram
  ['saltmere-overlay', 1280, 720, 'saltmere', 'saltmere', true, false],
  ['saltmere-rammed', 1280, 720, 'saltmere', 'saltmere', false, true],
  ['saltmere-rammed-fr', 1280, 720, 'saltmere', 'saltmere', false, true, 'fr'],
  ['abbey-head-overlay', 1280, 720, 'abbey-head', 'abbey-head', true, false],
  ['abbey-head', 1280, 720, 'abbey-head', 'abbey-head', false, false],
  ['saltmere-portrait', 390, 844, 'saltmere', 'saltmere', true, false],
];
(async () => {
  const b = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  for (const [name, w, h, portId, islandId, overlay, ram, lang = 'en'] of SHOTS) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.addInitScript((lang) => {
      localStorage.setItem(
        'fwt.settings.v1',
        JSON.stringify({ seenWindHint: true, tutorialOffered: true, language: lang, dayNight: false }),
      );
    }, lang);
    await p.goto('http://localhost:5199/?debug');
    await p.waitForTimeout(1500);
    await p.click('#menu-play').catch(() => {});
    await p.waitForTimeout(800);
    await p.keyboard.press('Escape');
    // A new game opens docked at Saltmere: cast off first.
    await p.click('#tp-undock').catch(() => {});
    await p.waitForTimeout(300);
    await p.evaluate(
      ([portId, islandId, ram]) => {
        const { world, view } = window.fwt;
        world.time = 200;
        world.dynamicWeather = false;
        world.trade.settlements.byPort[portId].level = 4;
        view.setSettlementLevels(
          Object.fromEntries(Object.entries(world.trade.settlements.byPort).map(([k, s]) => [k, s.level])),
        );
        const island = world.map.islands.find((i) => i.id === islandId);
        // Force the pier refresh now, then park the camera over the harbour.
        world.trade.settlements.byPort[portId].level = 4;
        window.__island = island;
        window.__ram = ram;
        view.setZoom(ram ? 0.9 : 1.25);
      },
      [portId, islandId, ram],
    );
    await p.waitForTimeout(400);
    await p.evaluate(() => {
      const { world, view } = window.fwt;
      const island = window.__island;
      const solid = world.piers.filter((q) => q.islandId === island.id);
      const target = window.__ram ? solid.find((q) => q.boat) : solid[0];
      const mx = (target.x0 + target.x1) / 2,
        my = (target.y0 + target.y1) / 2;
      if (window.__ram) {
        // Beam on into the moored hull, so the crash toast shows.
        const heading = Math.atan2(target.x1 - target.x0, target.y1 - target.y0) + Math.PI / 2;
        // Come from the seaward side of the hull.
        const away = Math.sin(heading) * (mx - island.x) + Math.cos(heading) * (my - island.y);
        const hd = away > 0 ? heading + Math.PI : heading;
        world.boat.x = mx - Math.sin(hd) * 9;
        world.boat.y = my - Math.cos(hd) * 9;
        world.boat.heading = hd;
        world.boat.speedKn = 8;
        world.boat.sailStep = 2;
      } else {
        // Hold beside the main pier, sails down, so the harbour fills the view.
        const out = Math.atan2(target.x1 - island.x, target.y1 - island.y);
        const side = out + Math.PI / 2;
        world.boat.x = target.x1 + Math.sin(side) * 12 + Math.sin(out) * 6;
        world.boat.y = target.y1 + Math.cos(side) * 12 + Math.cos(out) * 6;
        world.boat.heading = out;
        world.boat.speedKn = 0;
        window.fwt.input.setSail(0);
      }
      // A fresh hit, not more of the grinding that came before the move.
      world.boat.sinceBump = 10;
      world.trade.dockedAt = null;
      view.target.set(world.boat.x, 0, -world.boat.y);
    });
    // Headless frames are slow: the ram lands within a second or two, before the harbour opens.
    if (ram) {
      // Ramming next to the town also brings her alongside and opens the harbour (repair bar):
      // close it to show the hit and its toast at sea.
      await p.waitForTimeout(400);
      await p.click('#tp-undock').catch(() => {});
      await p.waitForTimeout(150);
    } else {
      await p.evaluate(() => window.fwt.view.setZoom(window.__island.radius < 20 ? 0.8 : 1.25));
      // Let the discovery toast fade; port signs would hide the harbour.
      await p.addStyleTag({ content: '.port-marker { display: none !important; }' });
      await p.waitForTimeout(4500);
      // Sails down this close in brings her alongside: close the harbour again.
      await p.click('#tp-undock', { timeout: 500 }).catch(() => {});
      await p.waitForTimeout(150);
    }
    if (overlay)
      await p.evaluate(() => {
        const { world, view } = window.fwt;
        const cam = view.camera;
        cam.updateMatrixWorld();
        const v = cam.matrixWorldInverse.elements,
          pr = cam.projectionMatrix.elements;
        const mul = (m, x, y, z, w) => [
          m[0] * x + m[4] * y + m[8] * z + m[12] * w,
          m[1] * x + m[5] * y + m[9] * z + m[13] * w,
          m[2] * x + m[6] * y + m[10] * z + m[14] * w,
          m[3] * x + m[7] * y + m[11] * z + m[15] * w,
        ];
        const project = (x, y) => {
          const e = mul(v, x, 0.6, -y, 1);
          const c = mul(pr, ...e);
          return [((c[0] / c[3] + 1) / 2) * innerWidth, ((1 - c[1] / c[3]) / 2) * innerHeight];
        };
        const canvas = document.createElement('canvas');
        canvas.width = innerWidth;
        canvas.height = innerHeight;
        Object.assign(canvas.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 9999 });
        document.body.appendChild(canvas);
        const g = canvas.getContext('2d');
        for (const q of world.piers) {
          const hw = q.halfWidth ?? 0.45 * 2.2;
          const dx = q.x1 - q.x0,
            dy = q.y1 - q.y0,
            len = Math.hypot(dx, dy) || 1;
          const ux = dx / len,
            uy = dy / len;
          const pts = [];
          for (let i = 0; i <= 12; i++) {
            const a = Math.PI / 2 + (i / 12) * Math.PI;
            pts.push([q.x0 + (Math.cos(a) * ux - Math.sin(a) * uy) * hw, q.y0 + (Math.sin(a) * ux + Math.cos(a) * uy) * hw]);
          }
          for (let i = 0; i <= 12; i++) {
            const a = -Math.PI / 2 + (i / 12) * Math.PI;
            pts.push([q.x1 + (Math.cos(a) * ux - Math.sin(a) * uy) * hw, q.y1 + (Math.sin(a) * ux + Math.cos(a) * uy) * hw]);
          }
          g.beginPath();
          pts.forEach(([x, y], i) => {
            const [sx, sy] = project(x, y);
            if (i) g.lineTo(sx, sy);
            else g.moveTo(sx, sy);
          });
          g.closePath();
          g.fillStyle = q.boat ? 'rgba(230,60,40,0.35)' : 'rgba(255,200,0,0.30)';
          g.strokeStyle = q.boat ? '#e63c28' : '#ffb000';
          g.lineWidth = 2;
          g.fill();
          g.stroke();
        }
      });
    await p.screenshot({ path: OUT + name + '.png' });
    await p.close();
  }
  await b.close();
})();
