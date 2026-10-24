// Phase 4 map layout mockups (ADR 0137): today's ring, drawn from the real map and island
// files (ring.json, dumped with islandCoasts), plus four biomes on a 5x-area sea.
// Static images only, nothing here is game data.
// Run: node docs/reviews/phase-4-map/src/make.cjs   (needs playwright)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..');
const ring = JSON.parse(fs.readFileSync(path.join(__dirname, 'ring.json'), 'utf8'));
const SEA = 985;
const RING = 440;

// Seeded random so the drawings repeat.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const polar = (r, deg) => [r * Math.sin((deg * Math.PI) / 180), r * Math.cos((deg * Math.PI) / 180)];
const sx = (p) => `${p[0].toFixed(1)},${(-p[1]).toFixed(1)}`;
function blob(cx, cy, r, seed, n = 14, rough = 0.28, stretch = 1, turn = 0) {
  const R = rng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - rough / 2 + R() * rough;
    let x = Math.cos(a) * r * k * stretch;
    let y = Math.sin(a) * r * k;
    const t = (turn * Math.PI) / 180;
    pts.push([cx + x * Math.cos(t) - y * Math.sin(t), cy + x * Math.sin(t) + y * Math.cos(t)]);
  }
  return pts;
}
const poly = (pts, attrs) => `<polygon points="${pts.map(sx).join(' ')}" ${attrs}/>`;
function label(p, text, cls = 'port', dy = 0) {
  return `<text x="${p[0].toFixed(1)}" y="${(-p[1] + dy).toFixed(1)}" class="${cls}">${text}</text>`;
}
function arrow(from, to, cls) {
  return `<line x1="${from[0]}" y1="${-from[1]}" x2="${to[0]}" y2="${-to[1]}" class="${cls}" marker-end="url(#${cls}-head)"/>`;
}

// Prevailing wind from 30 degrees (map wind.fromDeg): it blows towards 210.
const WIND_TO = 210;

const STYLE = `
.sea{fill:#2ba4b3}.outer{fill:#1d6f7a}.ringline{fill:none;stroke:#e9fbff;stroke-width:3;stroke-dasharray:10 8;opacity:.75}
.island{fill:#7cc35a;stroke:#10303a;stroke-width:2.5}.sand{fill:#f3d88a}
.ice{fill:#eef8ff;stroke:#2c5b72;stroke-width:2.5}.berg{fill:#ffffff;stroke:#7fb3c9;stroke-width:2}
.palm{fill:#8fd35f;stroke:#10303a;stroke-width:2.5}.volc{fill:#5b4a46;stroke:#1d1414;stroke-width:2.5}.lava{fill:#ff6a2a}
.cliff{fill:#8e9c86;stroke:#1f2b2b;stroke-width:3}
.reef{fill:#e48b7d;opacity:.75}.shoal{fill:#f6e4a6;opacity:.65}
.tint-ice{fill:#eaf6ff;opacity:.22}.tint-trop{fill:#53f0d6;opacity:.16}.tint-fire{fill:#ff8a4a;opacity:.16}.tint-fog{fill:#c9d3da;opacity:.28}
.ash{fill:#3b3b3b;opacity:.28}.fogbank{fill:#ffffff;opacity:.42}.calm{fill:#bfe9ee;opacity:.4;stroke:#ffffff;stroke-dasharray:6 6;stroke-width:2}
.port{font:700 46px 'Barlow Condensed',Arial Narrow,Arial,sans-serif;fill:#fff;stroke:#10303a;stroke-width:10;paint-order:stroke;text-anchor:middle}
.ring-port{font:700 34px Arial Narrow,Arial,sans-serif;fill:#fff;stroke:#10303a;stroke-width:8;paint-order:stroke;text-anchor:middle}
.scen{font:italic 30px Arial,sans-serif;fill:#e9fbff;text-anchor:middle;opacity:.9}
.biome{font:800 64px Arial Narrow,Arial,sans-serif;fill:#ffffff;opacity:.85;text-anchor:middle;letter-spacing:3px;stroke:#0b3c46;stroke-width:12;paint-order:stroke}
.note{font:600 32px Arial,sans-serif;fill:#fff;stroke:#0b3c46;stroke-width:8;paint-order:stroke;text-anchor:middle}
.wind{stroke:#ffffff;stroke-width:4;opacity:.75}.current{stroke:#0b4a8f;stroke-width:5;opacity:.85}.warm{stroke:#ff8b3d;stroke-width:5;opacity:.9}
.drift{stroke:#ffffff;stroke-width:3;stroke-dasharray:6 5}
.block{stroke:#d7263d;stroke-width:6;stroke-dasharray:10 6}
.out{fill:#ffd166;stroke:#10303a;stroke-width:3}.anchor{fill:#10303a;stroke:#f3d88a;stroke-width:3}
.storm{fill:none;stroke:#ffffff;stroke-width:5;opacity:.75}
`;

function defs() {
  const head = (id, color) =>
    `<marker id="${id}-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`;
  return `<defs>${head('wind', '#ffffff')}${head('current', '#0b4a8f')}${head('warm', '#ff8b3d')}${head('drift', '#ffffff')}
  <clipPath id="seaclip"><circle cx="0" cy="0" r="${SEA}"/></clipPath></defs>`;
}

function drawRing() {
  let s = '';
  for (const t of ring.terrain) s += poly(t.outline, 'class="reef"');
  const portOf = Object.fromEntries(ring.ports.map((p) => [p.islandId, p.name]));
  for (const i of ring.islands) {
    for (const c of i.coasts) s += poly(c, `class="island"`);
  }
  for (const i of ring.islands) {
    const name = portOf[i.id];
    if (name) s += label([i.x, i.y], name, 'ring-port', -i.r - 8);
    else if (i.id === ring.homeIsland) s += label([i.x, i.y], 'Skerry (home)', 'ring-port', -i.r - 8);
  }
  return s;
}

function sector(a0, a1, cls) {
  const p0 = polar(RING, a0), p1 = polar(SEA + 40, a0), p2 = polar(SEA + 40, a1), p3 = polar(RING, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `<path d="M${sx(p0)} L${sx(p1)} A${SEA + 40},${SEA + 40} 0 ${large} 1 ${sx(p2)} L${sx(p3)} A${RING},${RING} 0 ${large} 0 ${sx(p0)} Z" class="${cls}"/>`;
}

function portIsland(p, r, cls, seed, name, opts = {}) {
  const pts = blob(p[0], p[1], r, seed, 16, 0.3, opts.stretch || 1, opts.turn || 0);
  let s = poly(pts, `class="${cls}"`);
  if (opts.lava) s += `<circle cx="${p[0]}" cy="${-p[1]}" r="${r * 0.28}" class="lava"/>`;
  s += `<circle cx="${p[0] + r * 0.6}" cy="${-p[1] + r * 0.5}" r="20" class="anchor"/>`;
  s += label(p, name, 'port', -r - 22);
  return s;
}
function outpost(p, r, cls, seed, name) {
  let s = poly(blob(p[0], p[1], r, seed, 12, 0.3), `class="${cls}"`);
  s += `<path d="M${p[0]},${-p[1] - r - 44} l0,40 M${p[0]},${-p[1] - r - 44} l26,9 l-26,9" stroke="#10303a" stroke-width="3" fill="#ffd166"/>`;
  s += label(p, name, 'port', r + 52);
  return s;
}
function scenery(p, r, cls, seed, name, stretch = 1, turn = 0) {
  return poly(blob(p[0], p[1], r, seed, 14, 0.35, stretch, turn), `class="${cls}"`) + (name ? label(p, name, 'scen', r + 34) : '');
}

// ---------- the four biomes; `place(deg, r)` lets variant B pull them into groups ----------
function northIce(place) {
  let s = '';
  s += scenery(place(-22, 800), 46, 'ice', 11, 'Ice island (glacier)', 1.6, 20);
  s += portIsland(place(8, 690), 30, 'ice', 12, 'Ice port');
  s += outpost(place(30, 860), 17, 'ice', 13, 'Ice outpost');
  const R = rng(14);
  for (let k = 0; k < 16; k++) {
    const p = place(-38 + R() * 76, 540 + R() * 400);
    s += poly(blob(p[0], p[1], 5 + R() * 7, 100 + k, 6, 0.5), 'class="berg"');
    if (k % 3 === 0) s += arrow(p, [p[0] + polar(34, WIND_TO)[0], p[1] + polar(34, WIND_TO)[1]], 'drift');
  }
  const n = place(-2, 600);
  s += label(place(-8, 935), 'icebergs drift with the wind', 'note');
  return s;
}
function southTropic(place) {
  let s = '';
  s += portIsland(place(176, 680), 30, 'palm', 21, 'Tropical port');
  s += outpost(place(141, 900), 17, 'palm', 22, 'Tropical outpost');
  s += scenery(place(205, 830), 20, 'palm', 23, '');
  const R = rng(24);
  for (let k = 0; k < 9; k++) {
    const p = place(140 + R() * 85, 560 + R() * 380);
    s += poly(blob(p[0], p[1], 14 + R() * 18, 200 + k, 9, 0.6, 1.8, R() * 180), 'class="shoal"');
  }
  // Two reefs with a shallow passage between: deep ships are blocked (0137 point 7).
  const a = place(158, 760), b = place(172, 760);
  s += poly(blob(a[0] - 18, a[1], 34, 31, 10, 0.4, 1.7, 80), 'class="reef"');
  s += poly(blob(b[0] + 18, b[1], 34, 32, 10, 0.4, 1.7, 100), 'class="reef"');
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  s += `<line x1="${m[0] - 22}" y1="${-m[1]}" x2="${m[0] + 22}" y2="${-m[1]}" class="block"/>`;
  s += label([m[0] - 170, m[1]], 'shallow passage: small ships only', 'note', 70);
  // Doldrums near the port, then the trade-wind belt further out.
  const d = place(212, 560);
  s += `<ellipse cx="${d[0]}" cy="${-d[1]}" rx="95" ry="55" class="calm"/>` + label(d, 'doldrums', 'note', 5);
  for (let k = 0; k < 5; k++) {
    const p = place(150 + k * 18, 935);
    s += arrow(p, [p[0] + polar(60, 250)[0], p[1] + polar(60, 250)[1]], 'wind');
  }
  s += label(place(214, 950), 'steady trade-wind belt', 'note', 40);
  return s;
}
function westFire(place) {
  let s = '';
  const v = place(272, 770);
  s += portIsland(v, 36, 'volc', 41, 'Volcano island', { lava: true });
  // Ash drifts downwind of the volcano.
  const ash = [v[0] + polar(110, WIND_TO)[0], v[1] + polar(110, WIND_TO)[1]];
  s += `<ellipse cx="${ash[0]}" cy="${-ash[1]}" rx="120" ry="60" transform="rotate(${WIND_TO - 90} ${ash[0]} ${-ash[1]})" class="ash"/>`;
  s += label(ash, 'ash cloud: short sight', 'note', 60);
  s += portIsland(place(300, 650), 28, 'island', 42, 'Fire port');
  s += outpost(place(245, 880), 16, 'volc', 43, 'Fire outpost');
  s += scenery(place(302, 900), 18, 'volc', 44, 'basalt stacks', 1.4, 30);
  for (let k = 0; k < 4; k++) {
    const p = place(235 + k * 18, 580);
    s += arrow(p, [p[0] + polar(70, 340)[0], p[1] + polar(70, 340)[1]], 'warm');
  }
  s += label(place(262, 545), 'warm current', 'note', 0);
  return s;
}
function eastFog(place) {
  let s = '';
  s += portIsland(place(94, 680), 30, 'cliff', 51, 'Fog port', { stretch: 1.3, turn: 70 });
  s += outpost(place(66, 870), 17, 'cliff', 52, 'Fog outpost');
  s += scenery(place(118, 820), 26, 'cliff', 53, 'cliffs', 2.2, 10);
  for (let k = 0; k < 4; k++) {
    const p = place(70 + k * 15, 560 + (k % 2) * 80);
    s += `<ellipse cx="${p[0]}" cy="${-p[1]}" rx="${80 + k * 10}" ry="38" class="fogbank"/>`;
  }
  s += label(place(68, 520), 'fog banks', 'note', 5);
  for (let k = 0; k < 4; k++) {
    const p = place(58 + k * 16, 770);
    s += arrow(p, [p[0] + polar(80, 160)[0], p[1] + polar(80, 160)[1]], 'current');
  }
  s += label(place(80, 770), 'strong current', 'note', -24);
  const st = place(100, 935);
  s += `<path d="M${st[0] - 30},${-st[1]} a30,30 0 1,1 30,30 a18,18 0 1,1 -18,-18" class="storm"/>`;
  s += label(st, 'storms (expedition later)', 'note', 52);
  return s;
}

function chart(variant, upright = false) {
  const B = variant === 'B';
  // A: biomes fill four quarters. B: each biome is a compact group with open ocean between.
  const place = (deg, r) => {
    if (!B) return polar(r, deg);
    const centre = Math.round(deg / 90) * 90;
    return polar(560 + (r - 540) * 0.8, centre + (deg - centre) * 0.7);
  };
  let s = `<circle r="${SEA + 400}" class="outer"/><circle r="${SEA}" class="sea"/>`;
  s += `<g clip-path="url(#seaclip)">`;
  if (!B) {
    s += sector(-45, 45, 'tint-ice') + sector(45, 135, 'tint-fog') + sector(135, 225, 'tint-trop') + sector(225, 315, 'tint-fire');
  } else {
    const tint = (deg, cls) => {
      const c = polar(740, deg);
      return `<circle cx="${c[0]}" cy="${-c[1]}" r="290" class="${cls}"/>`;
    };
    s += tint(0, 'tint-ice') + tint(90, 'tint-fog') + tint(180, 'tint-trop') + tint(270, 'tint-fire');
    // A broken reef barrier around the ring with one gateway per side.
    for (let k = 0; k < 4; k++) {
      for (const off of [-32, 32]) {
        const deg = k * 90 + 45 + off * 0.55;
        const p = polar(500, deg);
        s += poly(blob(p[0], p[1], 34, 300 + k * 7 + off, 10, 0.4, 2.4, deg), 'class="reef"');
      }
    }
    for (let k = 0; k < 4; k++) s += label(polar(470, k * 90 + 45), 'open sea', 'scen', 0);
  }
  s += `</g>`;
  s += northIce(place) + southTropic(place) + westFire(place) + eastFog(place);
  s += `<circle r="${RING}" class="ringline"/>`;
  s += drawRing();
  s += label([0, RING + 26], "TODAY'S WINDWARD RING (unchanged)", 'note');
  const name = (deg, t) => label(polar(1050, deg), t, 'biome', 22);
  s += name(0, 'NORTH · ICE') + name(180, 'SOUTH · TROPICAL');
  if (upright) {
    s += `<text transform="translate(-1035,0) rotate(-90)" class="biome">WEST · FIRE</text>`;
    s += `<text transform="translate(1035,0) rotate(90)" class="biome">EAST · FOG</text>`;
  } else {
    s += label(polar(1200, 270), 'WEST · FIRE', 'biome', 22);
    s += label(polar(1200, 90), 'EAST · FOG', 'biome', 22);
  }
  return s;
}

function compass(x, y) {
  const w = polar(46, WIND_TO);
  return `<g transform="translate(${x},${y})"><rect x="-70" y="-70" width="140" height="160" rx="14" fill="#0f3d47" stroke="#f3d88a" stroke-width="2"/>
  <circle r="52" fill="#174f5b" stroke="#2ba4b3" stroke-width="3"/><text y="-58" class="note" style="font-size:16px">N</text>
  <line x1="${-w[0]}" y1="${w[1]}" x2="${w[0]}" y2="${-w[1]}" class="wind" marker-end="url(#wind-head)"/>
  <text y="80" class="note" style="font-size:14px">wind from NNE</text></g>`;
}

function legend(x, y, scale = 1) {
  const rows = [
    ['<circle cx="12" cy="0" r="10" class="anchor"/>', 'main port (inhabited)'],
    ['<path d="M12,-12 l0,22 M12,-12 l14,5 l-14,5" stroke="#10303a" stroke-width="3" fill="#ffd166"/>', 'outpost you found'],
    ['<line x1="0" y1="0" x2="26" y2="0" class="block"/>', 'hard block: deep ships'],
    ['<rect x="0" y="-9" width="26" height="18" class="reef"/>', 'reef'],
    ['<rect x="0" y="-9" width="26" height="18" class="shoal"/>', 'shallows'],
    ['<line x1="0" y1="0" x2="22" y2="0" class="current" marker-end="url(#current-head)"/>', 'current'],
    ['<line x1="0" y1="0" x2="22" y2="0" class="wind" marker-end="url(#wind-head)"/>', 'wind zone'],
  ];
  let s = `<g transform="translate(${x},${y}) scale(${scale})"><rect x="-14" y="-28" width="250" height="${rows.length * 32 + 22}" rx="12" fill="#0f3d47" opacity=".92" stroke="#f3d88a" stroke-width="2"/>`;
  rows.forEach(([icon, text], i) => {
    s += `<g transform="translate(0,${i * 32})">${icon}<text x="40" y="5" style="font:600 16px Arial,sans-serif;fill:#fff">${text}</text></g>`;
  });
  return s + '</g>';
}

function page(svg, w, h) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#1d6f7a}${STYLE}</style></head><body>${svg}</body></html>`;
}

function landscape(variant) {
  const W = 1600, H = 1000;
  const view = SEA + 150;
  const title = variant === 'A' ? 'A · Four quarters: biomes fill the sea around the ring' : 'B · Four island groups: open sea and one gateway between the ring and each biome';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs()}
  <g transform="translate(${W / 2 + 120},${H / 2 + 12}) scale(${(H / 2 - 20) / view})">${chart(variant)}</g>
  <text x="24" y="44" style="font:800 26px Arial Narrow,Arial,sans-serif;fill:#fff">${title}</text>
  <text x="24" y="72" style="font:500 16px Arial,sans-serif;fill:#d9f4f7">Phase 4 mockup (ADR 0137). 5x the area: sea radius 985 against 440.</text><text x="24" y="94" style="font:500 16px Arial,sans-serif;fill:#d9f4f7">Names, goods and shapes are placeholders.</text>
  ${legend(40, 140)}${compass(110, 520)}</svg>`;
  return { html: page(svg, W, H), W, H };
}

function portrait() {
  const W = 430, H = 932;
  const view = SEA + 100;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs()}
  <g transform="translate(${W / 2},${H / 2 - 20}) scale(${(W / 2 - 4) / view})">${chart('A', true)}</g>
  <text x="16" y="36" style="font:800 20px Arial Narrow,Arial,sans-serif;fill:#fff">Phase 4 sea, phone portrait (A)</text>
  <text x="16" y="60" style="font:500 13px Arial,sans-serif;fill:#d9f4f7">Whole sea at once: ring names and notes</text>
  <text x="16" y="78" style="font:500 13px Arial,sans-serif;fill:#d9f4f7">would wait for zoom, as on the stress sea.</text>
  ${legend(26, 790, 0.62)}</svg>`;
  return { html: page(svg, W, H), W, H };
}

// What a new captain sees: the ring charted, the rest uncharted until sailed (0137 point 1).
function fogStart() {
  const W = 1600, H = 1000;
  const view = SEA + 150;
  let s = `<circle r="${SEA + 400}" class="outer"/><circle r="${SEA}" class="sea"/>`;
  s += `<g><mask id="fogmask"><rect x="-2000" y="-2000" width="4000" height="4000" fill="white"/><circle r="${RING + 25}" fill="black"/></mask>
  <circle r="${SEA}" fill="#d9cfb4" mask="url(#fogmask)"/>
  <circle r="${SEA}" fill="url(#hatch)" mask="url(#fogmask)" opacity=".5"/></g>`;
  const inked = (p, t, dy) => label(p, t, 'biome', dy).replace('class="biome"', 'class="biome" style="fill:#6b5a3a;stroke:#efe6cf;font-size:44px"');
  for (const [deg, t] of [[0, 'the cold north'], [90, 'the fog coast'], [212, 'the warm south'], [270, 'smoke in the west']]) {
    s += inked(polar(720, deg), 'Uncharted', 0) + inked(polar(720, deg), t, 50);
  }
  // One lifted area: the first gateway, from Ness's charts after the Watchman Key arc.
  s += `<path d="M${sx(polar(RING + 20, 150))} L${sx(polar(800, 160))} L${sx(polar(800, 190))} L${sx(polar(RING + 20, 175))} Z" fill="#2ba4b3" opacity=".7" stroke="#ffffff" stroke-width="4" stroke-dasharray="14 10"/>`;
  s += label(polar(640, 166), "example: Ness's old chart", 'note', 0) + label(polar(640, 166), 'lifts the first area', 'note', 38);
  s += `<circle r="${RING}" class="ringline"/>` + drawRing();
  for (const [deg, t] of [[0, 'NORTH · ICE'], [180, 'SOUTH · TROPICAL']]) s += label(polar(1050, deg), t, 'biome', 22);
  s += label(polar(1200, 270), 'WEST · FIRE', 'biome', 22) + label(polar(1200, 90), 'EAST · FOG', 'biome', 22);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs()}
  <defs><pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="14" stroke="#b8a77f" stroke-width="3"/></pattern></defs>
  <g transform="translate(${W / 2 + 120},${H / 2 + 12}) scale(${(H / 2 - 20) / view})">${s}</g>
  <text x="24" y="44" style="font:800 26px Arial Narrow,Arial,sans-serif;fill:#fff">Fog of war at the start of Phase 4</text>
  <text x="24" y="72" style="font:500 16px Arial,sans-serif;fill:#d9f4f7">The ring is charted; each named area lifts when you sail into it (per area, not per pixel, to keep save links short).</text>
  ${compass(110, 520)}</svg>`;
  return { html: page(svg, W, H), W, H };
}

(async () => {
  // The cloud container's shared Chromium, if the local Playwright has no browser of its own.
  const shared = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(shared) ? { executablePath: shared } : {});
  const shots = [
    ['layout-A-quarters.png', landscape('A')],
    ['layout-B-island-groups.png', landscape('B')],
    ['layout-A-portrait.png', portrait()],
    ['fog-start.png', fogStart()],
  ];
  for (const [file, { html, W, H }] of shots) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: W < 600 ? 2 : 1 });
    await page.setContent(html);
    await page.screenshot({ path: path.join(OUT, file) });
    await page.close();
    console.log('wrote', file);
  }
  await browser.close();
})();
