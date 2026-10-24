/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, __dirname */
// The south sea layout schema (ADR 0151): a labelled plan drawn from the real data
// (src/data/seas/south.json, the island files and today's ring from docs/reviews/phase-4-map).
// Routes are schematic. Run: node docs/reviews/south-sea/src/make-schema.cjs (needs playwright).
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const DATA = path.join(ROOT, 'src', 'data');
const sea = JSON.parse(fs.readFileSync(path.join(DATA, 'seas', 'south.json'), 'utf8'));
const ring = require(path.join(ROOT, 'docs', 'reviews', 'phase-4-map', 'src', 'ring.json'));
const design = (id) => JSON.parse(fs.readFileSync(path.join(DATA, 'islands', `${id}.json`), 'utf8'));
const SEA = 985;

// World (x east, y north) to SVG (y down).
const pt = ([x, y]) => `${x.toFixed(1)},${(-y).toFixed(1)}`;
const poly = (pts, cls) => `<polygon points="${pts.map(pt).join(' ')}" class="${cls}"/>`;
const line = (pts, cls) => `<polyline points="${pts.map(pt).join(' ')}" class="${cls}"/>`;
const text = ([x, y], s, cls = 'name', dy = 0) =>
  `<text x="${x}" y="${-y + dy}" class="${cls}">${s}</text>`;

/** An island file's coasts in world units (islandPoint in src/sim/islandLayout.ts). */
function coasts(island) {
  const d = design(island.look.design);
  let bearing = island.look.harbourBearing;
  if (bearing === undefined) {
    const wp = sea.course.find((w) => w.label === island.name);
    bearing = Math.atan2(wp.x - island.x, wp.y - island.y);
  }
  const a = Math.PI - bearing;
  return d.coasts.map((c) =>
    c.map(([x, z]) => [
      island.x + island.radius * (Math.cos(a) * x + Math.sin(a) * z),
      island.y + island.radius * (Math.sin(a) * x - Math.cos(a) * z),
    ]),
  );
}

let s = '';
s += `<circle cx="0" cy="0" r="${SEA}" class="sea"/>`;
s += `<circle cx="0" cy="0" r="440" class="ringedge"/>`;
// Wind zones under everything.
const zoneCls = { 'trade-belt': 'trades', doldrums: 'calm', sheltered: 'shelter' };
for (const z of sea.windZones) s += poly(z.outline, `zone ${zoneCls[z.kind]}`);
// Today's ring, faded.
for (const t of ring.terrain) s += poly(t.outline, t.kind === 'reef' ? 'reef old' : 'land old');
for (const i of ring.islands) for (const c of i.coasts) s += poly(c, 'land old');
// The south sea.
for (const t of sea.terrain)
  s += poly(t.outline, { reef: 'reef', sandbank: 'bank', island: 'land', shallows: 'shallows' }[t.kind]);
for (const i of sea.islands) for (const c of coasts(i)) s += poly(c, 'land');
for (const m of sea.marks)
  if (m.type === 'light') s += `<circle cx="${m.x}" cy="${-m.y}" r="7" class="light"/>`;
  else s += `<circle cx="${m.x}" cy="${-m.y}" r="4" class="${m.type}"/>`;

// Schematic routes.
s += line([[125, -318], [150, -420], [152, -500], [150, -600], [105, -690], [60, -735], [-20, -735], [-100, -700]], 'route');
s += line([[-100, -700], [0, -735], [110, -745], [335, -742], [470, -735]], 'route short');
s += line([[110, -745], [210, -640], [300, -540], [360, -560], [400, -660], [470, -730]], 'route long');

// Labels.
const L = [
  [[150, -330], 'Watchman Key (ring)', 'small'],
  [[230, -500], "The Keeper's Passage", 'name'],
  [[230, -500], 'the gateway, buoyed and lit', 'note', 16],
  [[-380, -470], 'Coral Line', 'name'],
  [[-380, -470], 'broken reef barrier', 'note', 16],
  [[-75, -735], 'Sunreach Sound', 'zonelabel'],
  [[-75, -735], 'sheltered, wind along E–W', 'note', 16],
  [[-100, -545], 'SUNREACH', 'port'],
  [[-100, -545], 'main port · keeper Juno Reyes · spiced tea', 'note', 16],
  [[150, -600], 'The Glass', 'zonelabel'],
  [[150, -600], 'doldrums', 'note', 16],
  [[560, -650], 'PALM KEY', 'port'],
  [[560, -650], 'outpost site · gathers spice once founded', 'note', 16],
  [[300, -880], 'Palm Key Narrows', 'name'],
  [[300, -880], 'shallows: draft 1.2 or less', 'note', 16],
  [[0, -930], 'The Trades', 'zonelabel'],
  [[0, -930], 'steady trade wind from ENE', 'note', 16],
  [[-470, -700], 'Lone Palm', 'name'],
  [[-520, -330], 'Sugar Bar', 'name', 75],
  [[560, -280], 'Wreck Reef', 'name'],
  [[-200, -40], "TODAY'S WINDWARD RING (unchanged)", 'ringlabel'],
];
for (const [p, t, c, dy] of L) s += text(p, t, c, dy ?? 0);

const legend = `
<g transform="translate(10 700)" class="legend">
  <rect width="370" height="300" rx="10"/>
  <text x="16" y="30" class="lt">South sea · Sunreach (ADR 0151)</text>
  <rect x="16" y="48" width="22" height="14" class="land"/><text x="48" y="60">island (palms, hills)</text>
  <rect x="16" y="74" width="22" height="14" class="reef"/><text x="48" y="86">reef (solid)</text>
  <rect x="16" y="100" width="22" height="14" class="bank"/><text x="48" y="112">sandbank (solid, soft)</text>
  <rect x="16" y="126" width="22" height="14" class="shallows"/><text x="48" y="138">shallows: shallow keels cross, deep ships refused</text>
  <rect x="16" y="152" width="22" height="14" class="zone shelter"/><text x="48" y="164">sheltered wind zone (lagoon)</text>
  <rect x="16" y="178" width="22" height="14" class="zone calm"/><text x="48" y="190">doldrums</text>
  <rect x="16" y="204" width="22" height="14" class="zone trades"/><text x="48" y="216">trade-wind belt</text>
  <line x1="16" y1="236" x2="38" y2="236" class="route"/><text x="48" y="240">way in from the ring</text>
  <line x1="16" y1="258" x2="38" y2="258" class="route short"/><text x="48" y="262">shortcut, shallow ships</text>
  <line x1="16" y1="280" x2="38" y2="280" class="route long"/><text x="48" y="284">long way, every ship</text>
</g>`;

const css = `
  svg { background: #1d6b78; font-family: system-ui, sans-serif; }
  .sea { fill: #2aa7b8; } .ringedge { fill: none; stroke: #ffffff55; stroke-dasharray: 6 6; stroke-width: 2; }
  .land { fill: #7cc04f; stroke: #f2d9a0; stroke-width: 3; } .land.old { fill: #7cc04f88; stroke: #f2d9a066; }
  .reef { fill: #e86a5299; stroke: #e86a52; stroke-width: 1.5; stroke-dasharray: 4 3; } .reef.old { opacity: .45; }
  .bank { fill: #f7e3adcc; } .shallows { fill: #c9f2e3; stroke: #3fb3a3; stroke-width: 2; stroke-dasharray: 3 3; }
  .zone { stroke-width: 2; } .shelter { fill: #ffffff22; stroke: #ffffffaa; stroke-dasharray: 5 4; }
  .calm { fill: #e8f7ff55; stroke: #e8f7ffcc; stroke-dasharray: 2 4; } .trades { fill: #f6d36b33; stroke: #f6d36b; stroke-dasharray: 8 5; }
  .light { fill: #ffd76a; stroke: #7a5a10; } .buoy-red { fill: #e0463a; } .buoy-green { fill: #2f9a4a; }
  .route { fill: none; stroke: #fff; stroke-width: 3; stroke-dasharray: 10 6; }
  .route.short { stroke: #6fe3c6; } .route.long { stroke: #ffb35c; }
  text { fill: #fff; paint-order: stroke; stroke: #0d3a44; stroke-width: 4px; stroke-linejoin: round; text-anchor: middle; }
  .name { font: 600 20px system-ui; } .small { font: 500 16px system-ui; fill: #e6f4f6; }
  .note { font: italic 15px system-ui; fill: #e6f4f6; } .port { font: 800 26px system-ui; fill: #ffe39a; }
  .zonelabel { font: 700 19px system-ui; fill: #fff7d6; } .ringlabel { font: 700 22px system-ui; fill: #ffffffcc; }
  .legend rect:first-child { fill: #102f3ae8; stroke: #f2cf7e; stroke-width: 2; }
  .legend text { text-anchor: start; font: 14px system-ui; stroke-width: 0; fill: #eef; }
  .legend .lt { font: 700 17px system-ui; fill: #ffe39a; }
`;
// The south half of the sea, plus a slice of the ring for context.
const view = { x: -820, y: 120, w: 1640, h: 900 };
const html = `<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="1640" height="1020" viewBox="${view.x} ${view.y - 120} ${view.w} ${view.h + 120}"><style>${css}</style>${s}<g transform="translate(${view.x} ${view.y - 120})">${legend}</g></svg></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1640, height: 1020 } });
  await p.setContent(html);
  await p.screenshot({ path: path.join(__dirname, '..', 'schema.png') });
  await browser.close();
  console.log('wrote schema.png');
})();
