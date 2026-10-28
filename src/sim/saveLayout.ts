import { DIFFICULTIES } from './difficulty';
import { GOODS, type GoodId, isFar } from './goods';
import type { MapDef } from './map';
import { SHIP_IDS } from './ship';
import { UPGRADE_TRACKS } from './upgrades';

/** The id lists a save code's numbers index into, in the order they were written (decision 0118). */
export interface CodeLayout {
  goods: readonly GoodId[];
  ports: readonly string[];
  ships: readonly string[];
}

/**
 * The goods list before the far goods (decision 0146) were added at its end: codes made with it
 * still read, with no far goods in them.
 */
const GOODS_BEFORE_FAR: readonly GoodId[] = GOODS.filter((g) => !isFar(g));

/** The ship list before the Terns (decision 0228) were added at its end. */
const SHIPS_BEFORE_TERN: readonly string[] = SHIP_IDS.filter((id) => !id.startsWith('tern'));

/**
 * The port lists a code may have been written with: the map's, and the map's before its empty
 * islands to found were added (decision 0157), so a code from before a sea had its site still reads.
 */
function portLists(map: MapDef): string[][] {
  const all = map.ports.map((p) => p.id);
  const open = map.ports.filter((p) => !p.site).map((p) => p.id);
  return open.length === all.length ? [all] : [all, open];
}

/** Every layout a code may have been written with: the current one first. */
export function readableLayouts(map: MapDef): CodeLayout[] {
  return portLists(map).flatMap((ports) =>
    [GOODS, GOODS_BEFORE_FAR].flatMap((goods) =>
      [SHIP_IDS, SHIPS_BEFORE_TERN].map((ships) => ({ goods, ports, ships })),
    ),
  );
}

/** 16-bit FNV-1a of a list of ids: different lists give a different fingerprint. */
export function fingerprint(ids: string[]): number {
  let h = 0x811c9dc5;
  for (const ch of ids.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h ^ (h >>> 16)) & 0xffff;
}

/** The fingerprint of the layout lists (the current ones unless given). */
export function layoutFingerprint(map: MapDef, layout?: Partial<CodeLayout>): number {
  const { goods = GOODS, ports = map.ports.map((p) => p.id), ships = SHIP_IDS } = layout ?? {};
  return fingerprint([map.name, ...ports, ...goods, ...ships, ...UPGRADE_TRACKS, ...DIFFICULTIES]);
}
