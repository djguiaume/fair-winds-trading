// Top-down mockups for the Phase 1 map rework (docs/maps/rework/README.md).
// Usage: node docs/maps/rework/src/mockups.mjs  -> writes layout-*.svg next to this folder.
// Pure SVG, no dependencies; world units are game units (x east, y north), wind from 30°.
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1600;
const H = 1200;
const S = 1.22; // px per unit
const CX = 590;
const CY = 610;
const BOUNDS = 440;
const WIND_FROM = 30;

// Sea colours from style A, island colours from B2 (src/render/models/highlandIslands.ts).
const C = {
  outside: '#123c47',
  deep: '#1d6f7a',
  water: '#2a8f9a',
  waterLight: '#3aa7ae',
  shallow: '#58c2c0',
  glow: '#7fe3e0',
  foam: '#e6fbff',
  sand: '#f2d9a0',
  sandDark: '#dcc085',
  rock: '#c2ad8c',
  rock2: '#d6c4a4',
  rockShade: '#a8916f',
  grass: '#7cc04f',
  grassDark: '#6aab41',
  leaves: ['#3f8f45', '#4aa04f', '#38833f'],
  walls: '#f4ede0',
  roofs: ['#c8603e', '#3f74a8'],
  dock: '#9b6b3d',
  coral: '#e08a6a',
  ink: '#10343c',
  paper: '#f6efe0',
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const px = (x) => CX + x * S;
const py = (y) => CY - y * S;
const f = (n) => n.toFixed(1);

/** Wobbly closed outline around a centre: a sum of low sines keeps it island-like. */
function blob(x, y, r, seed, { sx = 1, sy = 1, rot = 0, n = 40, rough = 0.16 } = {}) {
  const R = rng(seed);
  const waves = [2, 3, 5, 7].map((k) => ({ k, a: (R() * rough) / Math.sqrt(k), p: R() * 6.28 }));
  const c = Math.cos((rot * Math.PI) / 180);
  const s = Math.sin((rot * Math.PI) / 180);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    let k = 1;
    for (const w of waves) k += w.a * Math.sin(w.k * t + w.p);
    const lx = Math.cos(t) * r * sx * k;
    const ly = Math.sin(t) * r * sy * k;
    pts.push([x + lx * c - ly * s, y + lx * s + ly * c]);
  }
  return pts;
}

const path = (pts, dy = 0) =>
  'M' + pts.map(([x, y]) => `${f(px(x))},${f(py(y) + dy)}`).join('L') + 'Z';

/** Shrink an outline toward its centre (for cliff and grass tiers). */
function inset(pts, k, cx, cy) {
  return pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

function centroid(pts) {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
}

/** A landmass is several overlapping blobs drawn tier by tier, so ridges read as one island. */
function landmass(parts, seed) {
  return parts.map((p, i) => blob(p[0], p[1], p[2], seed * 31 + i, p[3] || {}));
}

function sailTime(dx, dy) {
  // Steady-state estimate with the real sloop polar (src/sim/ship.ts), 14 kn wind.
  const polar = [
    [45, 0.42],
    [55, 0.68],
    [70, 0.88],
    [95, 1],
    [125, 0.93],
    [155, 0.8],
    [180, 0.7],
  ];
  const v = (a) => {
    if (a < 45) return 0;
    for (let i = 1; i < polar.length; i++) {
      const [a1, f1] = polar[i];
      const [a0, f0] = polar[i - 1];
      if (a <= a1) return (f0 + ((f1 - f0) * (a - a0)) / (a1 - a0)) * 14 * 0.62 * 1.6;
    }
    return 0;
  };
  const brg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  let twa = Math.abs(((brg - WIND_FROM + 540) % 360) - 180);
  let best = 0;
  for (let a = 45; a <= 180; a++) best = Math.max(best, v(a) * Math.cos(((a - twa) * Math.PI) / 180));
  const d = Math.hypot(dx, dy);
  return { d, t: d / best, upwind: twa < 50 };
}

function render(layout) {
  const R = rng(layout.seed);
  const L = [];
  const defs = [];
  defs.push(`
    <radialGradient id="sea" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${C.water}"/><stop offset="85%" stop-color="${C.water}"/>
      <stop offset="100%" stop-color="${C.deep}"/></radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="softer" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
    <clipPath id="disc"><circle cx="${CX}" cy="${CY}" r="${BOUNDS * S}"/></clipPath>
    <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,0L10,5L0,10Z" fill="${C.paper}"/></marker>`);

  L.push(`<rect width="${W}" height="${H}" fill="${C.outside}"/>`);
  L.push(`<g clip-path="url(#disc)">`);
  L.push(`<circle cx="${CX}" cy="${CY}" r="${BOUNDS * S}" fill="url(#sea)"/>`);
  // Deep channels (darker) and open-sea texture.
  for (const ch of layout.deep || []) {
    L.push(`<path d="${path(ch)}" fill="${C.deep}" opacity="0.75" filter="url(#softer)"/>`);
  }
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI * 2;
    const r = Math.sqrt(R()) * BOUNDS;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    L.push(
      `<path d="M${f(px(x))},${f(py(y))}q8,-4 16,0t16,0" stroke="${C.waterLight}" stroke-width="2.2" fill="none" opacity="0.55" stroke-linecap="round"/>`,
    );
  }

  const lands = layout.lands.map((l) => ({ ...l, parts: landmass(l.parts, l.seed) }));

  // Shallows: a wide soft glow then a tighter bright rim, under every coast and reef.
  for (const l of lands) for (const p of l.parts) {
    const [cx, cy] = centroid(p);
    L.push(`<path d="${path(inset(p, 1.45, cx, cy))}" fill="${C.shallow}" opacity="0.55" filter="url(#softer)"/>`);
  }
  for (const reef of layout.reefs) {
    const p = blob(reef.x, reef.y, reef.r, reef.seed, reef.shape);
    L.push(`<path d="${path(p)}" fill="${C.shallow}" opacity="0.85" filter="url(#soft)"/>`);
    L.push(`<path d="${path(inset(p, 0.8, reef.x, reef.y))}" fill="${C.glow}" opacity="0.7" filter="url(#soft)"/>`);
  }
  for (const l of lands) for (const p of l.parts) {
    const [cx, cy] = centroid(p);
    L.push(`<path d="${path(inset(p, 1.16, cx, cy))}" fill="${C.glow}" opacity="0.9" filter="url(#soft)"/>`);
  }

  // Reef rocks and coral heads with foam: solid to the hull in the game (sim collision).
  for (const reef of layout.reefs) {
    const RR = rng(reef.seed + 7);
    const count = Math.round(reef.r * (reef.density ?? 0.5));
    for (let i = 0; i < count; i++) {
      const a = RR() * Math.PI * 2;
      const rr = Math.sqrt(RR()) * reef.r * 0.8;
      const sx = reef.shape?.sx ?? 1;
      const sy = reef.shape?.sy ?? 1;
      const rot = ((reef.shape?.rot ?? 0) * Math.PI) / 180;
      const lx = Math.cos(a) * rr * sx;
      const ly = Math.sin(a) * rr * sy;
      const x = reef.x + lx * Math.cos(rot) - ly * Math.sin(rot);
      const y = reef.y + lx * Math.sin(rot) + ly * Math.cos(rot);
      const size = 2 + RR() * 3.5;
      const rock = blob(x, y, size, reef.seed * 100 + i, { n: 7, rough: 0.35 });
      L.push(`<path d="${path(rock)}" fill="${C.foam}" opacity="0.8" transform="scale(1)" stroke="${C.foam}" stroke-width="3" stroke-opacity="0.5"/>`);
      L.push(`<path d="${path(rock)}" fill="${RR() < 0.35 ? C.coral : C.rockShade}"/>`);
    }
  }

  // Foam ring at the waterline.
  for (const l of lands) for (const p of l.parts) {
    L.push(`<path d="${path(p)}" fill="none" stroke="${C.foam}" stroke-width="5" opacity="0.85"/>`);
  }
  // Beach, then the sandstone cliff tier with a shaded south face, then grass.
  for (const l of lands) for (const p of l.parts) L.push(`<path d="${path(p)}" fill="${C.sand}"/>`);
  for (const l of lands) for (const p of l.parts) {
    if (l.flat) continue;
    const [cx, cy] = centroid(p);
    L.push(`<path d="${path(inset(p, 0.8, cx, cy), 7)}" fill="${C.rockShade}"/>`);
  }
  for (const l of lands) for (const p of l.parts) {
    if (l.flat) continue;
    const [cx, cy] = centroid(p);
    L.push(`<path d="${path(inset(p, 0.8, cx, cy))}" fill="${C.rock}"/>`);
    L.push(`<path d="${path(inset(p, 0.72, cx, cy), 2)}" fill="${C.rock2}"/>`);
  }
  for (const l of lands) for (const p of l.parts) {
    if (l.flat) continue;
    const [cx, cy] = centroid(p);
    L.push(`<path d="${path(inset(p, 0.62, cx, cy), -2)}" fill="${l.locked ? '#9fbf7f' : C.grass}"/>`);
  }

  // Props: trees everywhere, towns and a pier on ports.
  for (const l of lands) {
    const RR = rng(l.seed + 99);
    if (l.flat) {
      for (let i = 0; i < 4; i++) {
        const p = l.parts[i % l.parts.length];
        const [cx, cy] = centroid(p);
        L.push(`<rect x="${f(px(cx + (RR() - 0.5) * 8))}" y="${f(py(cy + (RR() - 0.5) * 6))}" width="9" height="2.4" fill="${C.dock}" transform="rotate(${f(RR() * 180)} ${f(px(cx))} ${f(py(cy))})"/>`);
      }
      continue;
    }
    for (const p of l.parts) {
      const [cx, cy] = centroid(p);
      const g = inset(p, 0.5, cx, cy);
      const trees = l.trees ?? 6;
      for (let i = 0; i < trees; i++) {
        const q = g[Math.floor(RR() * g.length)];
        const t = RR();
        const x = cx + (q[0] - cx) * t;
        const y = cy + (q[1] - cy) * t;
        L.push(`<circle cx="${f(px(x) + 1.5)}" cy="${f(py(y) + 2.5)}" r="5" fill="#2f6b34" opacity="0.35"/>`);
        L.push(`<circle cx="${f(px(x))}" cy="${f(py(y))}" r="${f(4 + RR() * 2)}" fill="${C.leaves[i % 3]}"/>`);
      }
    }
    if (l.port) {
      const [cx, cy] = centroid(l.parts[0]);
      const dir = (l.port.pierDeg * Math.PI) / 180;
      const r0 = l.parts[0].reduce((m, q) => Math.max(m, Math.hypot(q[0] - cx, q[1] - cy)), 0);
      const ex = cx + Math.sin(dir) * r0 * 0.9;
      const ey = cy + Math.cos(dir) * r0 * 0.9;
      const tx = cx + Math.sin(dir) * (r0 + 16);
      const ty = cy + Math.cos(dir) * (r0 + 16);
      L.push(`<line x1="${f(px(ex))}" y1="${f(py(ey))}" x2="${f(px(tx))}" y2="${f(py(ty))}" stroke="${C.dock}" stroke-width="7" stroke-linecap="square"/>`);
      for (let i = 0; i < l.port.houses; i++) {
        const a = RR() * Math.PI * 2;
        const rr = RR() * r0 * 0.35;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        const rot = Math.floor(RR() * 4) * 22;
        L.push(`<g transform="rotate(${rot} ${f(px(x))} ${f(py(y))})"><rect x="${f(px(x) - 6)}" y="${f(py(y) - 4)}" width="12" height="9" fill="${C.walls}" stroke="#00000022"/>` +
          `<rect x="${f(px(x) - 7)}" y="${f(py(y) - 6)}" width="14" height="6" fill="${C.roofs[i % 2]}"/></g>`);
      }
      // Production hint.
      L.push(`<text x="${f(px(cx))}" y="${f(py(cy) + 5)}" font-size="20" text-anchor="middle">${l.port.icon}</text>`);
    }
    if (l.landmark) {
      const [cx, cy] = centroid(l.parts[0]);
      L.push(`<text x="${f(px(cx))}" y="${f(py(cy) + 5)}" font-size="${l.locked ? 18 : 15}" text-anchor="middle">${l.landmark}</text>`);
    }
  }
  L.push(`</g>`);
  L.push(`<circle cx="${CX}" cy="${CY}" r="${BOUNDS * S}" fill="none" stroke="${C.foam}" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="3 9"/>`);

  // Sample routes: dashed line, zigzag when the leg is upwind.
  const portAt = Object.fromEntries(
    lands.filter((l) => l.port).map((l) => [l.id, l.port.anchor]),
  );
  const routeLabels = [];
  for (const r of layout.routes) {
    const pts = r.via.map((id) => (typeof id === 'string' ? portAt[id] : id));
    const d = 'M' + pts.map(([x, y]) => `${f(px(x))},${f(py(y))}`).join('L');
    L.push(`<path d="${d}" fill="none" stroke="${C.ink}" stroke-opacity="0.35" stroke-width="6" stroke-linejoin="round"/>`);
    L.push(`<path d="${d}" fill="none" stroke="${r.color}" stroke-width="3" stroke-dasharray="10 7" stroke-linejoin="round" marker-end="url(#arr)"/>`);
    let t = 0;
    let dist = 0;
    for (let i = 1; i < pts.length; i++) {
      const e = sailTime(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      t += e.t;
      dist += e.d;
    }
    routeLabels.push({ ...r, t, dist });
    const m = pts[r.labelAt ?? 1];
    L.push(`<g><rect x="${f(px(m[0]) + 8)}" y="${f(py(m[1]) - 12)}" width="${r.tag.length * 8 + 16}" height="22" rx="11" fill="${r.color}"/>` +
      `<text x="${f(px(m[0]) + 16)}" y="${f(py(m[1]) + 4)}" font-size="13" font-weight="700" fill="${C.ink}">${r.tag}</text></g>`);
  }

  // Labels on top of everything.
  for (const l of lands) {
    if (!l.name) continue;
    const [cx, cy] = centroid(l.parts[0]);
    const r0 = l.parts[0].reduce((m, q) => Math.max(m, Math.hypot(q[0] - cx, q[1] - cy)), 0);
    const y = py(cy - r0) + 26 + (l.labelDy ?? 0);
    const x = px(cx) + (l.labelDx ?? 0);
    const text = l.name;
    const sub = l.sub ?? '';
    const w = Math.max(text.length * 9.2, sub.length * 6.6) + 22;
    const h = sub ? 38 : 24;
    const bg = l.port ? C.paper : l.locked ? '#2c5560' : '#1f4d57';
    const fg = l.port ? C.ink : C.paper;
    L.push(`<g><rect x="${f(x - w / 2)}" y="${f(y - 15)}" width="${f(w)}" height="${h}" rx="7" fill="${bg}" opacity="0.94" stroke="${l.locked ? C.paper : 'none'}" stroke-dasharray="4 3" stroke-opacity="0.6"/>` +
      `<text x="${f(x)}" y="${f(y + 2)}" text-anchor="middle" font-size="${l.port ? 15 : 13}" font-weight="${l.port ? 800 : 600}" fill="${fg}">${text}</text>` +
      (sub ? `<text x="${f(x)}" y="${f(y + 17)}" text-anchor="middle" font-size="11.5" fill="${fg}" opacity="0.85">${sub}</text>` : '') + `</g>`);
  }
  for (const n of layout.notes) {
    L.push(`<text x="${f(px(n.x))}" y="${f(py(n.y))}" text-anchor="middle" font-size="12.5" font-weight="700" letter-spacing="1.5" fill="${C.foam}" opacity="0.92" font-style="italic">${n.text}</text>`);
  }

  // Wind rose (top left of the map).
  const wx = 120;
  const wy = 130;
  const wa = ((WIND_FROM + 180) * Math.PI) / 180;
  L.push(`<g><circle cx="${wx}" cy="${wy}" r="62" fill="${C.ink}" opacity="0.75"/>` +
    `<text x="${wx}" y="${wy - 44}" text-anchor="middle" font-size="13" font-weight="800" fill="${C.paper}">N</text>` +
    `<line x1="${f(wx - Math.sin(wa) * 40)}" y1="${f(wy + Math.cos(wa) * 40)}" x2="${f(wx + Math.sin(wa) * 34)}" y2="${f(wy - Math.cos(wa) * 34)}" stroke="${C.glow}" stroke-width="6" marker-end="url(#arr)"/>` +
    `<text x="${wx}" y="${wy + 84}" text-anchor="middle" font-size="13" font-weight="700" fill="${C.paper}">Wind from NNE · 14 kn</text></g>`);

  // Side panel.
  const X = 1170;
  const P = [];
  P.push(`<rect x="${X - 20}" y="0" width="${W - X + 20}" height="${H}" fill="#0e2f38"/>`);
  P.push(`<text x="${X}" y="62" font-size="15" font-weight="700" fill="${C.glow}" letter-spacing="2">MAP REWORK · MOCKUP ${layout.letter}</text>`);
  P.push(`<text x="${X}" y="100" font-size="31" font-weight="800" fill="${C.paper}">${layout.title}</text>`);
  let y = 140;
  for (const line of layout.pitch) {
    P.push(`<text x="${X}" y="${y}" font-size="15" fill="${C.paper}" opacity="0.88">${line}</text>`);
    y += 22;
  }
  y += 22;
  P.push(`<text x="${X}" y="${y}" font-size="13" font-weight="700" fill="${C.glow}" letter-spacing="1.5">SAMPLE TRADE LEGS (SLOOP, STEADY WIND)</text>`);
  y += 28;
  for (const r of routeLabels) {
    P.push(`<rect x="${X}" y="${y - 14}" width="16" height="16" rx="4" fill="${r.color}"/>`);
    P.push(`<text x="${X + 26}" y="${y}" font-size="15" font-weight="700" fill="${C.paper}">${r.tag} · ${r.label}</text>`);
    P.push(`<text x="${X + 26}" y="${y + 19}" font-size="13" fill="${C.paper}" opacity="0.75">${Math.round(r.dist)} units · ≈ ${Math.round(r.t)} s${r.note ? ' · ' + r.note : ''}</text>`);
    y += 50;
  }
  y += 10;
  P.push(`<text x="${X}" y="${y}" font-size="13" font-weight="700" fill="${C.glow}" letter-spacing="1.5">WHAT CHANGES</text>`);
  y += 26;
  for (const line of layout.changes) {
    P.push(`<text x="${X}" y="${y}" font-size="14" fill="${C.paper}" opacity="0.88">• ${line}</text>`);
    y += 22;
  }
  y = H - 150;
  P.push(`<text x="${X}" y="${y}" font-size="13" font-weight="700" fill="${C.glow}" letter-spacing="1.5">KEY</text>`);
  y += 24;
  const key = [
    [C.paper, 'Trading port (pier, town, what it makes)'],
    ['#2c5560', 'Locked island: future port, unlocked later'],
    [C.coral, 'Reef: rocks and coral, solid to the hull'],
    [C.glow, 'Shallows glow · darker blue = deep channel'],
  ];
  for (const [c, t] of key) {
    P.push(`<rect x="${X}" y="${y - 12}" width="16" height="14" rx="3" fill="${c}"/><text x="${X + 26}" y="${y}" font-size="13.5" fill="${C.paper}" opacity="0.85">${t}</text>`);
    y += 24;
  }
  P.push(`<text x="${X}" y="${H - 22}" font-size="11.5" fill="${C.paper}" opacity="0.5">Static mockup, not game geometry. Times use the real sloop polar.</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Nunito, 'Trebuchet MS', 'DejaVu Sans', sans-serif"><defs>${defs.join('')}</defs>${L.join('\n')}${P.join('\n')}</svg>`;
}

// Port islands are now the biggest, busiest landmarks (radius 26-32); scenery is smaller.
const port = (id, name, sub, x, y, r, seed, pierDeg, icon, anchorOff = 50) => {
  const a = (pierDeg * Math.PI) / 180;
  return {
    id,
    name,
    sub,
    seed,
    trees: 7,
    parts: [[x, y, r, { sx: 1.1, sy: 0.95, rot: seed % 40 }]],
    port: { pierDeg, houses: 7, icon, anchor: [x + Math.sin(a) * anchorOff, y + Math.cos(a) * anchorOff] },
  };
};

const A = {
  letter: 'A',
  seed: 11,
  title: 'Windward Ring',
  pitch: [
    'Ports sit around the rim, one on each side of the',
    'wind. The middle is a field of ridges and reefs:',
    'thread it for a short, tricky crossing, or sail',
    'round the outside in open water.',
  ],
  changes: [
    'Ports pushed out to radius ~300; legs ~25 s to 1.5 min',
    'Ports are the biggest islands; scenery is smaller',
    'Ridges have B2 cliffs and beaches, not flat slabs',
    'Reef fields with shallows glow make lanes readable',
    'Outer islands become locked future ports',
    'Open water kept on the east rim for fast ships',
  ],
  lands: [
    port('calda', 'Port Calda', 'timber · wants fish, stone', 170, 270, 30, 101, 210, '🪵'),
    port('westholm', 'Westholm', 'grain · wants stone, fish', -310, 50, 28, 102, 110, '🌾'),
    port('saltmere', 'Saltmere', 'fish · wants timber, grain', 285, -140, 28, 103, 280, '🐟'),
    port('stonehaven', 'Stonehaven', 'stone · wants grain, timber', -160, -300, 27, 104, 40, '🪨'),
    {
      id: 'spine',
      name: 'Greyback Ridge',
      seed: 201,
      trees: 3,
      parts: [
        [-150, 175, 26, { sx: 1.5, sy: 0.8, rot: -35 }],
        [-105, 145, 24, { sx: 1.4, sy: 0.75, rot: -35 }],
        [-62, 117, 20, { sx: 1.3, sy: 0.8, rot: -35 }],
      ],
      landmark: '🏛️',
      labelDy: -4,
    },
    {
      id: 'hook',
      name: 'Gull Hook',
      seed: 202,
      trees: 3,
      parts: [
        [10, -20, 26, { sx: 1.5, sy: 0.85, rot: -30 }],
        [62, -48, 22, { sx: 1.3, sy: 0.8, rot: -30 }],
        [102, -78, 16, { sx: 1.2, sy: 0.8, rot: -15 }],
      ],
      landmark: '🔥',
    },
    {
      id: 'skerry',
      name: 'Skerry',
      seed: 203,
      trees: 2,
      parts: [[-60, -150, 13]],
    },
    {
      id: 'bell',
      seed: 204,
      trees: 2,
      parts: [[60, 140, 10]],
    },
    {
      id: 'abbey',
      name: 'Abbey Head',
      sub: 'locked · future port',
      locked: true,
      seed: 301,
      trees: 3,
      parts: [[-275, 300, 22]],
      landmark: '🔒',
    },
    {
      id: 'watch',
      name: 'Watchman Key',
      sub: 'locked · future port',
      locked: true,
      seed: 302,
      trees: 3,
      parts: [[150, -360, 20]],
      landmark: '🔒',
    },
    {
      id: 'lantern',
      name: 'Lantern Rock',
      seed: 303,
      trees: 1,
      parts: [[370, 170, 11]],
      landmark: '🗼',
    },
  ],
  reefs: [
    { x: -30, y: 60, r: 38, seed: 401, shape: { sx: 1.5, sy: 0.6, rot: -30 }, density: 0.45 },
    { x: 150, y: 40, r: 40, seed: 402, shape: { sx: 1.4, sy: 0.6, rot: -40 }, density: 0.5 },
    { x: -150, y: -90, r: 34, seed: 403, shape: { sx: 1.5, sy: 0.6, rot: -20 }, density: 0.5 },
    { x: 60, y: -210, r: 30, seed: 404, shape: { sx: 1.4, sy: 0.7, rot: 10 }, density: 0.5 },
    { x: -235, y: 175, r: 22, seed: 405, shape: { sx: 1.2, sy: 0.7, rot: 40 }, density: 0.5 },
  ],
  deep: [blob(-60, 40, 60, 501, { sx: 3.2, sy: 0.5, rot: -32 })],
  notes: [
    { x: 330, y: 40, text: 'OPEN WATER' },
    { x: -80, y: 30, text: 'THE NARROWS' },
  ],
  routes: [
    { tag: 'Timber run', label: 'Calda → Saltmere', via: ['calda', [230, 90], 'saltmere'], color: '#f2c14e', note: 'downwind, outside the reefs', labelAt: 1 },
    { tag: 'Stone haul', label: 'Stonehaven → Calda', via: ['stonehaven', [-110, -160], [-80, 20], [0, 75], 'calda'], color: '#ff9b71', note: 'upwind through the Narrows', labelAt: 2 },
    { tag: 'Grain', label: 'Westholm → Stonehaven', via: ['westholm', [-280, -120], 'stonehaven'], color: '#b5e48c', note: 'reach', labelAt: 1 },
  ],
};

const B = {
  letter: 'B',
  seed: 23,
  title: 'The Sound',
  pitch: [
    'One big highland island lies across the wind and',
    'splits the sea in two. Two ports on the windward',
    'side, two on the lee side. Go round either cape or',
    'take Needle Sound, a narrow reef strait through it.',
  ],
  changes: [
    'A single strong landmark the player learns fast',
    'Every north–south delivery is a route choice',
    'Ports are the biggest islands after Greatholm',
    'Reefs guard both capes and the Sound',
    'Outer islands become locked future ports',
    'Open water kept north-east and south-west',
  ],
  lands: [
    port('calda', 'Port Calda', 'timber · wants fish, stone', 60, 275, 30, 111, 200, '🪵'),
    port('westholm', 'Westholm', 'grain · wants stone, fish', -300, 150, 28, 112, 150, '🌾'),
    port('saltmere', 'Saltmere', 'fish · wants timber, grain', 300, -90, 28, 113, 330, '🐟'),
    port('stonehaven', 'Stonehaven', 'stone · wants grain, timber', -70, -290, 27, 114, 20, '🪨'),
    {
      id: 'greatholm-w',
      name: 'Greatholm',
      seed: 211,
      trees: 9,
      labelDx: -40,
      labelDy: -75,
      parts: [
        [-155, 50, 44, { sx: 1.25, sy: 0.85, rot: -28 }],
        [-90, 25, 46, { sx: 1.3, sy: 0.9, rot: -28 }],
        [-30, -5, 40, { sx: 1.1, sy: 0.85, rot: -28 }],
      ],
      landmark: '🏛️',
    },
    {
      id: 'greatholm-e',
      seed: 212,
      trees: 8,
      parts: [
        [65, -55, 38, { sx: 1.2, sy: 0.85, rot: -28 }],
        [120, -85, 36, { sx: 1.25, sy: 0.8, rot: -28 }],
        [170, -115, 24, { sx: 1.2, sy: 0.75, rot: -20 }],
      ],
      landmark: '🔥',
    },
    { id: 'cape-rock', seed: 213, trees: 1, parts: [[-235, 85, 10]] },
    { id: 'tern', name: 'Tern Cay', seed: 214, trees: 2, parts: [[200, 110, 13]] },
    { id: 'oyster', seed: 215, trees: 2, parts: [[-200, -170, 12]] },
    {
      id: 'abbey',
      name: 'Abbey Head',
      sub: 'locked · future port',
      locked: true,
      seed: 311,
      trees: 3,
      parts: [[-150, 360, 21]],
      landmark: '🔒',
    },
    {
      id: 'wreck',
      name: 'Wrecker’s Rest',
      sub: 'locked · future port',
      locked: true,
      seed: 312,
      trees: 3,
      parts: [[250, -320, 21]],
      landmark: '🔒',
    },
  ],
  reefs: [
    { x: 18, y: -30, r: 22, seed: 411, shape: { sx: 0.8, sy: 1.6, rot: -28 }, density: 0.6 },
    { x: -250, y: 105, r: 32, seed: 412, shape: { sx: 1.4, sy: 0.7, rot: 60 }, density: 0.45 },
    { x: 225, y: -150, r: 32, seed: 413, shape: { sx: 1.4, sy: 0.7, rot: 60 }, density: 0.45 },
    { x: 150, y: 175, r: 26, seed: 414, shape: { sx: 1.3, sy: 0.7, rot: -10 }, density: 0.45 },
    { x: -150, y: -230, r: 26, seed: 415, shape: { sx: 1.3, sy: 0.7, rot: 15 }, density: 0.45 },
  ],
  deep: [
    blob(-20, 160, 60, 511, { sx: 3.5, sy: 0.6, rot: -28 }),
    blob(30, -190, 60, 512, { sx: 3.5, sy: 0.6, rot: -28 }),
  ],
  notes: [
    { x: 20, y: 35, text: 'NEEDLE SOUND' },
    { x: 260, y: 300, text: 'OPEN WATER' },
    { x: -330, y: -230, text: 'OPEN WATER' },
    { x: -290, y: 40, text: 'WEST CAPE' },
    { x: 280, y: -190, text: 'EAST CAPE' },
  ],
  routes: [
    { tag: 'Timber run', label: 'Calda → Stonehaven', via: ['calda', [55, 90], [10, -70], 'stonehaven'], color: '#f2c14e', note: 'downwind through the Sound', labelAt: 1 },
    { tag: 'Stone haul', label: 'Stonehaven → Westholm', via: ['stonehaven', [-280, -60], 'westholm'], color: '#ff9b71', note: 'close reach round West Cape', labelAt: 1 },
    { tag: 'Fish', label: 'Saltmere → Calda', via: ['saltmere', [250, 80], 'calda'], color: '#8ecae6', note: 'close-hauled past Tern Cay', labelAt: 1 },
  ],
};

for (const layout of [A, B]) {
  const file = join(OUT, `layout-${layout.letter.toLowerCase()}.svg`);
  writeFileSync(file, render(layout));
  process.stdout.write(`wrote ${file}\n`);
}
