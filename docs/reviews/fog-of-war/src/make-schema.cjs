/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, __dirname */
// The fog areas of the south sea as a labelled schema (ADR 0155): node docs/reviews/fog-of-war/src/make-schema.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const DATA = path.join(__dirname, '../../../../src/data');
const south = JSON.parse(fs.readFileSync(path.join(DATA, 'seas/south.json'), 'utf8'));
const grown = JSON.parse(fs.readFileSync(path.join(DATA, 'seas/grown.json'), 'utf8'));
const ring = JSON.parse(fs.readFileSync(path.join(DATA, 'phase1-map.json'), 'utf8'));
const colours = ['#e8b04a', '#7fc8a9', '#e98b6d', '#9fa8e8'];
const pts = (o) => o.map(([x, y]) => `${x},${-y}`).join(' ');
const mid = (o) => [o.reduce((a, p) => a + p[0], 0) / o.length, -o.reduce((a, p) => a + p[1], 0) / o.length];
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1000 -1000 2000 2000" width="1300" height="1300" style="background:#1d5d68;font-family:sans-serif">`;
svg += `<circle r="${grown.boundsRadius}" fill="#2aa6b4" stroke="#cfe" stroke-width="2"/>`;
svg += `<circle r="${grown.chartedRadius}" fill="#3cc0c8" stroke="#fff" stroke-width="3" stroke-dasharray="14 8"/>`;
svg += `<text x="0" y="-300" fill="#fff" font-size="34" text-anchor="middle" font-weight="700">Windward Ring: charted from the start (r ${grown.chartedRadius})</text>`;
south.chartAreas.forEach((a, k) => {
  svg += `<polygon points="${pts(a.outline)}" fill="${colours[k]}" fill-opacity="0.35" stroke="${colours[k]}" stroke-width="4"/>`;
  const [x, y] = mid(a.outline);
  svg += `<text x="${x}" y="${y}" fill="#fff" font-size="32" font-weight="700" text-anchor="middle" stroke="#123" stroke-width="5" paint-order="stroke">${a.name}</text>`;
  svg += `<text x="${x}" y="${y + 34}" fill="#fff" font-size="22" text-anchor="middle" stroke="#123" stroke-width="4" paint-order="stroke">area "${a.id}"</text>`;
});
for (const t of [...ring.terrain ?? [], ...south.terrain]) svg += `<polygon points="${pts(t.outline)}" fill="${t.kind === 'reef' ? '#a77' : t.kind === 'island' ? '#7c4' : '#dcb'}"/>`;
for (const i of [...ring.islands, ...south.islands]) svg += `<circle cx="${i.x}" cy="${-i.y}" r="${i.radius}" fill="#7c4" stroke="#fd8" stroke-width="2"/>`;
svg += `<text x="0" y="985" fill="#fff" font-size="26" text-anchor="middle">Grey sea outside the ring and the areas (west, north, east) stays fogged until those seas are laid out.</text>`;
svg += `<text x="0" y="-950" fill="#fff" font-size="26" text-anchor="middle">An area is charted at once when she sails into it (or a quest gives it). An island in the fog is charted alone when she passes within 90 units of it.</text>`;
svg += `</svg>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 1300 } });
  await p.setContent(svg);
  await p.screenshot({ path: path.join(__dirname, '..', 'areas-schema.png') });
  await b.close();
})();
