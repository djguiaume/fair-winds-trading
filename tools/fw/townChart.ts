// `npm run island -- audit --chart <dir>` (issue #513): one plan per town island, the ground
// shaded by slope, the houses, lanes, piers and fields, and every town finding marked, as JPGs
// for the audit (docs/reviews/v1.9/towns/). The town checks' own plan and slope reader draw it.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ISLAND_DESIGNS } from '../../src/data/islands';
import { islandCheckKit } from '../../src/render/models/islandCheckKit';
import type { IslandIssue } from '../../src/sim/islandChecks';
import { checkTown } from '../../src/sim/townChecks';
import {
  type TownPlan,
  groundAt,
  lasting,
  slopeAt,
  townPlan,
  waterAt,
} from '../../src/sim/townPlan';
import { TOWN_RULES } from '../../src/sim/townRules';
import { defaultSeas, islandPlacements } from './check';

const SIZE = 960;
/** Ground cells across the island. */
const CELLS = 90;

const svgPoints = (pts: readonly (readonly number[])[]) =>
  pts.map(([x, z]) => `${x!.toFixed(3)},${z!.toFixed(3)}`).join(' ');

/** Land shaded by slope: flat pale green, the houses' warn limit tan, the fail limit brown. */
function groundCells(plan: TownPlan, x0: number, z0: number, span: number) {
  const step = span / CELLS;
  const [warn, fail] = plan.style.slope;
  const out: string[] = [];
  for (let i = 0; i < CELLS; i++)
    for (let j = 0; j < CELLS; j++) {
      const x = x0 + (i + 0.5) * step,
        z = z0 + (j + 0.5) * step;
      if (waterAt(plan, x, z).depth < 0) continue;
      const { deg } = slopeAt(plan, x, z, step);
      const fill = plan.style.avoid.includes(groundAt(plan, x, z))
        ? '#b5523b'
        : deg > fail
          ? '#7a5a3a'
          : deg > warn
            ? '#c9a66b'
            : '#a9c98a';
      out.push(
        `<rect x="${(x - step / 2).toFixed(3)}" y="${(z - step / 2).toFixed(3)}" width="${(step * 1.02).toFixed(3)}" height="${(step * 1.02).toFixed(3)}" fill="${fill}"/>`,
      );
    }
  return out.join('');
}

/** A ruled plan to design from: a line and its file coordinate every 0.2, each prop's index. */
function gridMarks(plan: TownPlan, x0: number, z0: number, span: number): string {
  const STEP = 0.2;
  const font = span / 90;
  const out: string[] = [];
  const label = (x: number, z: number, text: string, fill = '#fff') =>
    `<text x="${x}" y="${z}" font-size="${font}" fill="${fill}" stroke="#000" stroke-width="${font / 10}" paint-order="stroke">${text}</text>`;
  for (let k = Math.ceil(x0 / STEP); k * STEP < x0 + span; k++) {
    const v = k * STEP;
    out.push(
      `<line x1="${v}" y1="${z0}" x2="${v}" y2="${z0 + span}" stroke="#000" stroke-opacity="0.35" stroke-width="${span / 900}"/>`,
      label(v, z0 + font, v.toFixed(1)),
    );
  }
  for (let k = Math.ceil(z0 / STEP); k * STEP < z0 + span; k++) {
    const v = k * STEP;
    out.push(
      `<line x1="${x0}" y1="${v}" x2="${x0 + span}" y2="${v}" stroke="#000" stroke-opacity="0.35" stroke-width="${span / 900}"/>`,
      label(x0, v, v.toFixed(1)),
    );
  }
  for (const river of plan.design.rivers ?? [])
    out.push(
      `<polyline points="${svgPoints(river.points)}" fill="none" stroke="#3aa0d8" stroke-width="${span / 250}"/>`,
    );
  plan.design.props.forEach((p, i) => {
    if (plan.kit.types[p.type]?.building) out.push(label(p.x, p.z, String(i), '#ffe45c'));
  });
  return out.join('');
}

function townSvg(plan: TownPlan, issues: IslandIssue[], title: string, grid = false): string {
  const { design, kit, W } = plan;
  const xs = design.coasts.flat().map((p) => p[0]!),
    zs = design.coasts.flat().map((p) => p[1]!);
  const span =
    Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) * 1.12;
  const x0 = (Math.max(...xs) + Math.min(...xs)) / 2 - span / 2,
    z0 = (Math.max(...zs) + Math.min(...zs)) / 2 - span / 2;
  const line = span / 400;
  const parts: string[] = [];
  parts.push(`<rect x="${x0}" y="${z0}" width="${span}" height="${span}" fill="#2f6f8f"/>`);
  for (const c of design.coasts) parts.push(`<polygon points="${svgPoints(c)}" fill="#e8d9a8"/>`);
  parts.push(groundCells(plan, x0, z0, span));
  for (const trees of [kit.trees?.() ?? []])
    for (const [x, z] of trees)
      parts.push(
        `<circle cx="${x.toFixed(3)}" cy="${z.toFixed(3)}" r="${(W * 0.15).toFixed(3)}" fill="#2f5d34"/>`,
      );
  for (const lane of plan.lanes)
    parts.push(
      `<polyline points="${svgPoints(lane)}" fill="none" stroke="#8a6a4a" stroke-width="${line * 3}" stroke-linecap="round"/>`,
    );
  for (const [a, b] of plan.piers)
    parts.push(
      `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#555" stroke-width="${line * 5}"/>`,
    );
  design.props.forEach((p) => {
    if (!lasting(p)) return;
    if (TOWN_RULES.types.fields.includes(p.type))
      parts.push(
        `<circle cx="${p.x}" cy="${p.z}" r="${(p.fit ?? kit.fit(p)).toFixed(3)}" fill="#e6cf5a" fill-opacity="0.7"/>`,
      );
    else if (kit.types[p.type]?.building && !kit.types[p.type]?.home && kit.footprint)
      parts.push(
        `<polygon points="${svgPoints(kit.footprint(p))}" fill="#9a9a9a" stroke="#333" stroke-width="${line}"/>`,
      );
  });
  for (const h of plan.houses)
    parts.push(
      `<polygon points="${svgPoints(h.hull)}" fill="#fff" stroke="#222" stroke-width="${line}"/>`,
      `<line x1="${h.at[0] - h.front[0] * h.fit}" y1="${h.at[1] - h.front[1] * h.fit}" x2="${h.at[0] + h.front[0] * h.fit}" y2="${h.at[1] + h.front[1] * h.fit}" stroke="#222" stroke-width="${line}"/>`,
    );
  if (plan.harbour)
    parts.push(
      `<circle cx="${plan.harbour[0]}" cy="${plan.harbour[1]}" r="${W * 0.4}" fill="none" stroke="#fff" stroke-width="${line * 2}"/>`,
    );
  const font = span / 70;
  for (const i of issues) {
    if (!i.at) continue;
    const colour = i.grade === 'fail' ? '#e0302a' : '#f29a1d';
    parts.push(
      `<circle cx="${i.at[0]}" cy="${i.at[1]}" r="${W * 0.3}" fill="none" stroke="${colour}" stroke-width="${line * 2.5}"/>`,
      `<text x="${i.at[0] + W * 0.35}" y="${i.at[1]}" font-size="${font}" fill="${colour}" stroke="#000" stroke-width="${font / 12}" paint-order="stroke">${i.check.slice(5)}</text>`,
    );
  }
  if (grid) parts.push(gridMarks(plan, x0, z0, span));
  const fails = issues.filter((i) => i.grade === 'fail').length;
  const head = `${title}: ${plan.houses.length} houses, ${fails} fail (red), ${issues.length - fails} warn (orange). Harbour toward the bottom (white ring: arrival pier root). Ground by slope: green under ${plan.style.slope[0]}°, tan to ${plan.style.slope[1]}°, brown steeper, red: forbidden ground.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="${x0} ${z0} ${span} ${span}">${parts.join('')}</svg>
<p>${head}</p>`;
}

/** Writes `<id>-<as>.jpg` (before, after…) per town island into `dir`; the files written.
 * `grid` rules the plan with file coordinates and prop indexes, to design a layout from. */
export async function writeTownCharts(
  dir: string,
  only?: string,
  as = 'before',
  grid = false,
): Promise<string[]> {
  const places = islandPlacements(defaultSeas());
  mkdirSync(dir, { recursive: true });
  const { chromium } = await import('playwright');
  const browser = await chromium
    .launch()
    .catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }));
  const files: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
    for (const design of Object.values(ISLAND_DESIGNS)) {
      const place = places.get(design.id);
      if (!place || (only && design.id !== only)) continue;
      const kit = islandCheckKit(design, place.R, place.harbour);
      const plan = townPlan(design, kit, TOWN_RULES, []);
      if (!plan) continue;
      await page.setContent(
        `<style>body{margin:0;background:#0d2a3a;color:#fff;font:14px sans-serif}svg{display:block}p{margin:6px 10px}</style>${townSvg(plan, checkTown(design, kit), design.name, grid)}`,
      );
      const out = join(dir, `${design.id}-${as}.jpg`);
      await page.screenshot({ path: out, type: 'jpeg', quality: 80, fullPage: true });
      files.push(out);
    }
  } finally {
    await browser.close();
  }
  return files;
}
