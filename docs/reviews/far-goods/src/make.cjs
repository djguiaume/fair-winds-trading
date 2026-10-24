// Far goods proposal image (docs/reviews/far-goods). Run: node docs/reviews/far-goods/src/make.cjs
// Writes far-goods-routes.svg and, with the pre-installed Playwright, far-goods-routes.png.
const fs = require('fs');
const path = require('path');
const ring = require('../../../../src/data/phase1-map.json');
const out = path.join(__dirname, '..');

const S = 0.62; // px per map unit
const CX = 640, CY = 650;
const P = (x, y) => [CX + x * S, CY - y * S];
const polar = (deg, r) => { const a = (deg * Math.PI) / 180; return [r * Math.sin(a), r * Math.cos(a)]; };

// Placeholder Phase 4 sites, from docs/reviews/phase-4-map/src/make.cjs.
const BIOMES = [
  { id: 'ice', name: 'North · ice', good: 'Cloudberry jam', raw: 'Cloudberries', rawPrice: 25, icon: '❄', color: '#3f8fbf', tint: '#e6f3fb', port: polar(8, 690), outpost: polar(30, 860), wants: 'lamp oil', price: 110, buyers: ['saltmere', 'stonehaven'] },
  { id: 'tropic', name: 'South · tropical', good: 'Spiced tea', raw: 'Spice', rawPrice: 20, icon: '✿', color: '#d0732a', tint: '#e2f7ef', port: polar(176, 680), outpost: polar(141, 900), wants: 'honey', price: 90, buyers: ['calda', 'westholm'] },
  { id: 'fire', name: 'West · fire', good: 'Obsidian mirrors', raw: 'Obsidian', rawPrice: 22, icon: '▲', color: '#b23a2e', tint: '#fbe9df', port: polar(300, 650), outpost: polar(245, 880), wants: 'lamp oil', price: 100, buyers: ['calda', 'saltmere'] },
  { id: 'fog', name: 'East · fog and storm', good: 'Amber beads', raw: 'Amber', rawPrice: 28, icon: '◆', color: '#c58a12', tint: '#eceff2', port: polar(94, 680), outpost: polar(66, 870), wants: 'honey', price: 120, buyers: ['westholm', 'stonehaven'] },
];
const isl = Object.fromEntries(ring.islands.map((i) => [i.id, i]));
const portIsland = Object.fromEntries(ring.ports.map((p) => [p.id, isl[p.islandId]]));
const portName = Object.fromEntries(ring.ports.map((p) => [p.id, p.name]));

let s = '';
const sector = (from, to, fill) => {
  const [x1, y1] = P(...polar(from, 985)), [x2, y2] = P(...polar(to, 985)), [x3, y3] = P(...polar(to, 470)), [x4, y4] = P(...polar(from, 470));
  return `<path d="M${x4},${y4} L${x1},${y1} A${985 * S},${985 * S} 0 0 1 ${x2},${y2} L${x3},${y3} A${470 * S},${470 * S} 0 0 0 ${x4},${y4}Z" fill="${fill}"/>`;
};
s += `<circle cx="${CX}" cy="${CY}" r="${985 * S}" fill="#cfe6ee"/>`;
const sides = { ice: [-45, 45], fog: [45, 135], tropic: [135, 225], fire: [225, 315] };
for (const b of BIOMES) s += sector(...sides[b.id], b.tint);
s += `<circle cx="${CX}" cy="${CY}" r="${470 * S}" fill="#bfe0ea" stroke="#7aa9b8" stroke-dasharray="6 6" stroke-width="2"/>`;
s += `<text x="${CX}" y="${CY - 470 * S + 22}" class="small" text-anchor="middle">Windward Ring (unchanged)</text>`;

// Buyer arrows first, under the islands.
for (const b of BIOMES) {
  for (const buyer of b.buyers) {
    const i = portIsland[buyer];
    const [x1, y1] = P(...b.port), [x2, y2] = P(i.x, i.y);
    const mx = (x1 + x2) / 2 + (y2 - y1) * 0.08, my = (y1 + y2) / 2 - (x2 - x1) * 0.08;
    s += `<path d="M${x1},${y1} Q${mx},${my} ${x2},${y2}" fill="none" stroke="${b.color}" stroke-width="3" opacity=".75" marker-end="url(#arr-${b.id})"/>`;
  }
}
// Outbound: yard rare goods to biome main ports.
const yard = { honey: isl['abbey-head'], 'lamp oil': isl['watchman-key'] };
for (const b of BIOMES) {
  const y = yard[b.wants];
  const [x1, y1] = P(y.x, y.y), [x2, y2] = P(...b.port);
  s += `<path d="M${x1},${y1} L${x2},${y2}" fill="none" stroke="#6b5a3a" stroke-width="2" stroke-dasharray="7 5" opacity=".7" marker-end="url(#arr-out)"/>`;
}
// Raw good: outpost to main port.
for (const b of BIOMES) {
  const [x1, y1] = P(...b.outpost), [x2, y2] = P(...b.port);
  s += `<path d="M${x1},${y1} L${x2},${y2}" fill="none" stroke="${b.color}" stroke-width="5" stroke-dasharray="2 7" stroke-linecap="round" marker-end="url(#arr-${b.id})"/>`;
}
// Ring islands.
for (const i of ring.islands) {
  const [x, y] = P(i.x, i.y);
  s += `<circle cx="${x}" cy="${y}" r="${Math.max(5, i.radius * S)}" fill="#e9dcb2" stroke="#7d6b45" stroke-width="1.5"/>`;
}
for (const p of ring.ports) {
  const i = isl[p.islandId];
  const [x, y] = P(i.x, i.y);
  const yardGood = p.id === 'abbey-head' ? ' (honey)' : p.id === 'watchman-key' ? ' (lamp oil)' : '';
  s += `<text x="${x}" y="${y + 26}" class="lbl" text-anchor="middle">${p.name}${yardGood}</text>`;
}
// Biome sites.
for (const b of BIOMES) {
  const [px, py] = P(...b.port), [ox, oy] = P(...b.outpost);
  s += `<circle cx="${px}" cy="${py}" r="16" fill="#f3ead0" stroke="#5c4a2a" stroke-width="2"/>`;
  s += `<text x="${px}" y="${py + 34}" class="lbl" text-anchor="middle" fill="${b.color}">Main port: crafts ${b.good} ${b.price}</text>`;
  s += `<text x="${px}" y="${py + 50}" class="small" text-anchor="middle">keeper + arc; buys ${b.raw.toLowerCase()}, ${b.wants}</text>`;
  s += `<circle cx="${ox}" cy="${oy}" r="13" fill="#fff" stroke="${b.color}" stroke-width="3"/>`;
  s += `<text x="${ox}" y="${oy + 5}" text-anchor="middle" fill="${b.color}" style="font:700 14px sans-serif">${b.icon}</text>`;
  s += `<text x="${ox}" y="${oy - 20}" class="lbl" text-anchor="middle" fill="${b.color}">Outpost: gathers ${b.raw} ${b.rawPrice}</text>`;
  const [nx, ny] = P(...{ ice: polar(-28, 880), fog: polar(118, 860), tropic: polar(208, 890), fire: polar(292, 840) }[b.id]);
  s += `<text x="${nx}" y="${ny}" class="biome" text-anchor="middle">${b.name.toUpperCase()}</text>`;
}

// Legend panel.
const L = 1290;
let lg = `<rect x="${L - 20}" y="20" width="560" height="1260" fill="#fbf7ec" stroke="#cbbf9f"/>`;
lg += `<text x="${L}" y="64" class="title">Far goods (ADR 0146)</text>`;
lg += `<text x="${L}" y="92" class="small">Second rare set (0065, 0137). Names from the head storyteller; numbers to tune in play.</text>`;
let y = 140;
for (const b of BIOMES) {
  lg += `<text x="${L}" y="${y}" style="font:700 20px sans-serif" fill="${b.color}">${b.icon} ${b.raw} ${b.rawPrice} → ${b.good} ${b.price}</text>`;
  lg += `<text x="${L}" y="${y + 26}" class="lg">Gathered at the outpost, crafted at the main port</text>`;
  lg += `<text x="${L}" y="${y + 50}" class="lg">Bought by port towns ${b.buyers.map((x) => portName[x]).join(' and ')}</text>`;
  y += 96;
}
y += 10;
lg += `<line x1="${L}" y1="${y}" x2="${L + 50}" y2="${y}" stroke="#555" stroke-width="3"/><text x="${L + 62}" y="${y + 6}" class="lg">crafted good, main port to ring port town</text>`;
y += 34;
lg += `<line x1="${L}" y1="${y}" x2="${L + 50}" y2="${y}" stroke="#555" stroke-width="5" stroke-dasharray="2 7" stroke-linecap="round"/><text x="${L + 62}" y="${y + 6}" class="lg">raw good, outpost to main port</text>`;
y += 34;
lg += `<line x1="${L}" y1="${y}" x2="${L + 50}" y2="${y}" stroke="#6b5a3a" stroke-width="2" stroke-dasharray="7 5"/><text x="${L + 62}" y="${y + 6}" class="lg">honey or lamp oil, outbound cargo</text>`;
y += 50;
const rules = [
  'Rules',
  '• Three stops: the outpost gathers, the main port',
  '  crafts, the ring\'s port towns (level 4) buy.',
  '• No island makes the ring\'s goods; no two islands',
  '  make the same good.',
  '• The main port crafts (from town level) only',
  '  from raw goods it receives: no raw, no craft.',
  '• Each main port has a keeper with a 3-step arc.',
  '• Each crafted good: two buyers on the far side.',
  '',
  'Estimate, maxed cutter, 30 units, one leg:',
  '  honey today: +811',
  '  ring to main port, honey or lamp oil: +600 to +670',
  '  outpost to main port, raw: +350 to +500',
  '  main port to ring, crafted: +1,885 to +2,525',
  '',
  'Order the seas open: south, west, north, east.',
];
for (const r of rules) { lg += `<text x="${L}" y="${y}" class="${r === 'Rules' || r.startsWith('Estimate') ? 'lgb' : 'lg'}">${r}</text>`; y += 28; }

const defs = BIOMES.map((b) => `<marker id="arr-${b.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10z" fill="${b.color}"/></marker>`).join('') +
  `<marker id="arr-out" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10z" fill="#6b5a3a"/></marker>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1880" height="1300" viewBox="0 0 1880 1300">
<style>.lbl{font:600 15px sans-serif;fill:#3a2f1c}.small{font:13px sans-serif;fill:#4a4030}.biome{font:700 22px sans-serif;fill:#2c3e4a;letter-spacing:2px;opacity:.75}.title{font:700 30px sans-serif;fill:#2c2416}.lg{font:17px sans-serif;fill:#3a2f1c}.lgb{font:700 18px sans-serif;fill:#2c2416}</style>
<defs>${defs}</defs><rect width="1880" height="1300" fill="#f4efe2"/>${s}${lg}
<text x="${CX}" y="1290" class="small" text-anchor="middle">Layout B from docs/reviews/phase-4-map; north up.</text></svg>`;
fs.writeFileSync(path.join(out, 'far-goods-routes.svg'), svg);
(async () => {
  try {
    const { chromium } = require('playwright');
    const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    const p = await b.newPage({ viewport: { width: 1880, height: 1300 } });
    await p.setContent(`<body style="margin:0">${svg}</body>`);
    await p.screenshot({ path: path.join(out, 'far-goods-routes.png') });
    await b.close();
  } catch (e) { console.log('PNG skipped:', e.message); }
})();
