// Island-by-island look review sheets (issue #277): for each island one JPG with the new look at
// High and at Low from the same pose, and the coast chart (the file's coast against the smoothed
// one) under them. The art director and Guillaume review these.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SEAS } from '../../src/data/grownMap';
import { islandHeightfield } from '../../src/sim/heightfield';
import { PHASE1_SOURCE } from '../../src/data/maps';
import type { IslandDef, MapDef } from '../../src/sim/map';
import { type Overlay, renderChart, writePng } from './chart';
import { coastOverlay } from './coastOverlay';
import { loadSea } from './seas';

type Args = Record<string, string | boolean | undefined> & { _: string[] };

const ROOT = resolve(import.meta.dirname, '../..');
const QUALITIES = ['high', 'low'];
/** Sheet width in pixels: the review's size limit for a picture. */
const SHEET = 1280;

/** The ids of the islands of one sea; the ring is the original map's. */
function seaIslandIds(group: string): string[] {
  if (group === 'ring') return PHASE1_SOURCE.islands.map((i) => i.id);
  const sea = SEAS.find((s) => s.id === group);
  if (!sea) throw new Error(`no sea "${group}" (ring, ${SEAS.map((s) => s.id).join(', ')})`);
  return (sea.islands ?? []).map((i) => i.id);
}

/** Far enough to see the whole island and its approaches; bigger islands need more distance. */
const zoomFor = (island: IslandDef) => Math.max(1.4, island.radius / 14);

function shotList(islands: IslandDef[], args: Args) {
  return islands.flatMap((island) =>
    QUALITIES.map((quality) => ({
      look: `v2,${island.x},${island.y}`,
      zoom: Number(args.zoom ?? zoomFor(island)),
      quality,
      night: !!args.night,
      name: `${island.id}-${quality}${args.night ? '-night' : ''}`,
    })),
  );
}

async function composeSheets(islands: IslandDef[], dir: string, night: boolean) {
  const { chromium } = await import('playwright');
  const browser = await chromium
    .launch()
    .catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
  const files: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: SHEET, height: 900 } });
    for (const island of islands) {
      const img = (file: string, title: string) =>
        `<figure><figcaption>${title}</figcaption><img src="file://${file}"></figure>`;
      const shot = (q: string) =>
        join(dir, `${island.id}-${q}${night ? '-night' : ''}-desktop.png`);
      const html = join(dir, `${island.id}.html`);
      writeFileSync(
        html,
        `<style>body{margin:0;background:#0d2a3a;color:#fff;font:600 14px Barlow,sans-serif}
        .row{display:flex}figure{margin:0;flex:1}img{width:100%;display:block}
        figcaption{padding:4px 8px}</style>
        <div class="row">${img(shot('high'), `${island.id}: High`)}${img(shot('low'), 'Low')}</div>
        <div class="row">${img(join(dir, `${island.id}-coast.png`), 'coast: white = sailed (island file), yellow dashed = drawn ground, red = apart')}</div>`,
      );
      await page.goto(`file://${html}`);
      const out = join(dir, `${island.id}${night ? '-night' : ''}.jpg`);
      await page.screenshot({ path: out, type: 'jpeg', quality: 82, fullPage: true });
      files.push(out);
    }
  } finally {
    await browser.close();
  }
  return files;
}

/** Both coasts of the whole sea, worked out once per run (decision 0237). */
let coasts: Overlay | undefined;
const coastLines = (map: MapDef) => (coasts ??= coastOverlay(map, 'high').overlay);

/** The coast chart of one island: wide and short, like the shots above it. */
async function writeCoastChart(island: IslandDef, dir: string) {
  const { map, prepared } = loadSea('phase4');
  // The island's whole field, in the sheet's wide shape.
  const field = islandHeightfield(island);
  const wide = Math.max((field.w * field.cell) / 2, (field.h * field.cell * 1.6) / 2);
  const cx = field.x0 + (field.w * field.cell) / 2,
    cy = field.y0 + (field.h * field.cell) / 2;
  const view: [number, number, number, number] = [
    cx - wide,
    cy - wide / 1.6,
    cx + wide,
    cy + wide / 1.6,
  ];
  const chart = renderChart({
    map,
    prepared,
    view,
    legend: false,
    width: SHEET,
    layers: { names: true },
    overlay: coastLines(prepared),
  });
  const base = join(dir, `${island.id}-coast`);
  writeFileSync(`${base}.svg`, chart.svg);
  await writePng(`${base}.svg`, `${base}.png`, chart.width, chart.height, chart.scale);
}

/** The islands as the game plays them (the prepared map: harbour bearing set). */
const islandsById = (ids: string[]): IslandDef[] => {
  const known = new Map(loadSea('phase4').prepared.islands.map((i) => [i.id, i]));
  return ids.map((id) => {
    const island = known.get(id);
    if (!island) throw new Error(`no island "${id}"`);
    return island;
  });
};

export async function run(args: Args): Promise<number> {
  if (args.help || (!args._.length && !args.sea)) {
    console.log(`npm run review -- --sea ring|south|north|west|east | <island id>[,<id>…]   review sheets
  --sea name       every island of that sea (ring: the Windward Ring)
  --zoom z         camera distance for every island (default from the island's size)
  --night          at night
  --no-shots       redo the coast charts and sheets from the shots already in --out
  --out dir        where the sheets go (default output/review)
Each sheet: High and Low at the same pose, and the coast chart (the island file's coast against
the new look's smoothed coast). One JPG per island, ${SHEET} px wide.`);
    return 0;
  }
  const islands = islandsById(
    args._.length ? args._[0]!.split(',') : seaIslandIds(String(args.sea)),
  );
  const dir = resolve(String(args.out ?? 'output/review'));
  mkdirSync(dir, { recursive: true });

  if (!args['no-shots']) {
    const list = join(dir, 'shots.json');
    writeFileSync(list, JSON.stringify(shotList(islands, args)));
    execFileSync('node', ['tools/fw/fw.mjs', 'shots', '--list', list, '--out', dir], {
      cwd: ROOT,
      stdio: 'inherit',
    });
  }
  for (const island of islands) await writeCoastChart(island, dir);
  const files = await composeSheets(islands, dir, !!args.night);
  console.log(files.map((f) => `wrote ${f}`).join('\n'));
  return 0;
}
