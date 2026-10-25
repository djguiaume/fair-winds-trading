import type { ChartAreaDef } from './fog';
import type { MapDef } from './map';
import type { MapCheck } from './mapChecks';

/**
 * Sea sectors (decision 0178): each Phase 4 sea owns a slice of the outer ring, given in
 * `seas/grown.json` as compass bearings from the middle of the map (0 = north, 90 = east,
 * clockwise), `[from, to]`. The four biomes get equal quarters centred on the compass points.
 */
export type Sector = [from: number, to: number];
export type Sectors = Record<string, Sector>;

/** What a sea file holds that has a place on the map. */
export type SeaPlaces = { id: string; name?: string } & Partial<
  Pick<MapDef, 'islands' | 'terrain' | 'marks' | 'currents' | 'windZones' | 'course'>
> & { chartAreas?: ChartAreaDef[] };

/** How far past its sector's edge a point may sit before the check complains, in degrees. */
const SLACK = 0.5;

/** Compass bearing of a point from the middle of the map, 0..360 (y north, x east). */
export function bearingOf(x: number, y: number): number {
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

/** Whether a bearing lies in a sector; sectors may wrap past north (315..45). */
export function inSector(bearing: number, [from, to]: Sector, slack = SLACK): boolean {
  const span = (((to - from) % 360) + 360) % 360 || 360;
  const off = (((bearing - from + slack) % 360) + 360) % 360;
  return off <= span + 2 * slack;
}

/** The width of a sector in degrees. */
export function sectorSpan([from, to]: Sector): number {
  return (((to - from) % 360) + 360) % 360 || 360;
}

/** Every placed thing of a sea with the points that must lie in its sector. */
export function seaPlaces(sea: SeaPlaces): { what: string; points: [number, number][] }[] {
  const out: { what: string; points: [number, number][] }[] = [];
  for (const i of sea.islands ?? []) {
    // The island's beach circle, not only its middle: an island never straddles a border.
    const points: [number, number][] = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      points.push([i.x + Math.sin(a) * i.radius, i.y + Math.cos(a) * i.radius]);
    }
    out.push({ what: i.name ?? i.id, points });
  }
  for (const t of sea.terrain ?? []) out.push({ what: t.name ?? t.id, points: t.outline });
  (sea.marks ?? []).forEach((m, k) =>
    out.push({ what: m.name ?? `mark ${k} (${m.type})`, points: [[m.x, m.y]] }),
  );
  for (const c of sea.currents ?? [])
    out.push({
      what: c.name ?? c.id,
      points: [...(c.path ?? []).map(([x, y]) => [x, y] as [number, number]), ...(c.outline ?? [])],
    });
  for (const z of sea.windZones ?? []) out.push({ what: z.name ?? z.id, points: z.outline });
  for (const a of sea.chartAreas ?? []) out.push({ what: `area ${a.name}`, points: a.outline });
  (sea.course ?? []).forEach((w, k) => out.push({ what: `waypoint ${k}`, points: [[w.x, w.y]] }));
  return out;
}

/** The things of a sea that leave its sector, with how far out they reach. */
export function outOfSector(sea: SeaPlaces, sector: Sector): string[] {
  const out: string[] = [];
  for (const p of seaPlaces(sea)) {
    const off = p.points.filter(
      ([x, y]) => Math.hypot(x, y) > 1 && !inSector(bearingOf(x, y), sector),
    );
    if (!off.length) continue;
    const worst = Math.max(
      ...off.map(([x, y]) => {
        const b = bearingOf(x, y);
        const d = (t: number) => Math.min(Math.abs(b - t), 360 - Math.abs(b - t));
        return Math.min(d(sector[0]), d(sector[1]));
      }),
    );
    out.push(`${p.what} (${Math.round(worst)}° out)`);
  }
  return out;
}

/** Sea sector checks: every sea in its own slice, and the slices neither overlap nor miss any. */
export function sectorChecks(seas: readonly SeaPlaces[], sectors: Sectors | undefined): MapCheck[] {
  if (!sectors) return [];
  const out: MapCheck[] = [];
  const missing = seas.filter((s) => !sectors[s.id]).map((s) => s.id);
  const problems: string[] = [];
  for (const sea of seas) {
    const sector = sectors[sea.id];
    if (!sector) continue;
    const off = outOfSector(sea, sector);
    if (off.length)
      problems.push(
        `${sea.name ?? sea.id} leaves ${sector[0]}..${sector[1]}°: ${off.slice(0, 4).join(', ')}${off.length > 4 ? ` and ${off.length - 4} more` : ''}`,
      );
  }
  out.push({
    id: 'sea-sectors',
    ok: !problems.length,
    severity: 'error',
    message: problems.length
      ? problems.join('; ')
      : `every sea in its own sector (${seas.filter((s) => sectors[s.id]).length} seas)`,
  });
  // The slices: no two overlap; a warning while the ring is not yet shared out in full.
  const list = Object.entries(sectors);
  const overlaps: string[] = [];
  for (let a = 0; a < list.length; a++)
    for (let b = a + 1; b < list.length; b++) {
      const [ida, sa] = list[a]!;
      const [idb, sb] = list[b]!;
      const mid = (s: Sector) => (s[0] + sectorSpan(s) / 2) % 360;
      if (
        inSector(mid(sb), sa, -SLACK) ||
        inSector(mid(sa), sb, -SLACK) ||
        inSector(sb[0] + 1, sa, -SLACK) ||
        inSector(sa[0] + 1, sb, -SLACK)
      )
        overlaps.push(`${ida} and ${idb}`);
    }
  const total = list.reduce((sum, [, s]) => sum + sectorSpan(s), 0);
  out.push({
    id: 'sector-layout',
    ok: !overlaps.length && !missing.length,
    severity: overlaps.length ? 'error' : 'warning',
    message: overlaps.length
      ? `sectors overlap: ${overlaps.join(', ')}`
      : missing.length
        ? `no sector in grown.json for ${missing.join(', ')}`
        : `${list.length} sectors, ${Math.round(total)}° of 360°`,
  });
  return out;
}
