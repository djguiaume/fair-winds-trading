import { DIFFICULTIES } from './difficulty';
import { GOODS } from './goods';
import { BUILDING_IDS, homeSpots } from './home';
import type { MapDef } from './map';
import type { SaveData } from './save';
import { SHIP_IDS } from './ship';
import { UPGRADE_TRACKS } from './upgrades';

/**
 * The compact save code, FW2 (decision 0118): the save as a short run of whole
 * numbers instead of named JSON, so the link stays under 1,000 characters on a 5x map.
 *
 * - Ports, goods, ships, upgrade tracks and difficulty levels are written in the order of the
 *   map and data files, without their names. A fingerprint of those lists comes first, so a code
 *   from a game whose lists differ is refused instead of misread.
 * - Every number is a whole number (the game shows no decimals): stocks, gold, growth and timers
 *   are rounded, the position is in decimetres and the heading in tenths of a degree.
 * - Numbers are written as varints (7 bits per byte), so small ones take a single byte.
 *
 * Pure bytes in and out: zlib and base64 are done by saveTransfer.ts.
 */

const TAU = 2 * Math.PI;

/** Every id list the layout depends on, in order. */
function layoutIds(map: MapDef): string[] {
  return [
    map.name,
    ...map.ports.map((p) => p.id),
    ...GOODS,
    ...SHIP_IDS,
    ...UPGRADE_TRACKS,
    ...DIFFICULTIES,
  ];
}

/** 16-bit FNV-1a of the layout lists: different lists give a different fingerprint. */
export function layoutFingerprint(map: MapDef): number {
  return fingerprint(layoutIds(map));
}

/**
 * The home island's section (decision 0124) comes last, with its own layout number and a
 * fingerprint of the spots and buildings, so codes made before it still read and a code whose
 * spots or buildings differ is refused rather than misread.
 */
const HOME_SECTION = 1;
export function homeFingerprint(map: MapDef): number {
  return fingerprint([...homeSpots(map).map((s) => `${s.id}:${s.pair ?? ''}`), ...BUILDING_IDS]);
}

function fingerprint(ids: string[]): number {
  let h = 0x811c9dc5;
  for (const ch of ids.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h ^ (h >>> 16)) & 0xffff;
}

class Writer {
  readonly bytes: number[] = [];

  /** A whole number ≥ 0, rounded. */
  uint(n: number) {
    let v = Math.max(0, Math.round(n));
    while (v >= 128) {
      this.bytes.push((v % 128) | 128);
      v = Math.floor(v / 128);
    }
    this.bytes.push(v);
  }

  /** A whole number that may be negative (zigzag: 0, -1, 1, -2 … → 0, 1, 2, 3 …). */
  int(n: number) {
    const v = Math.round(n);
    this.uint(v < 0 ? -2 * v - 1 : 2 * v);
  }

  /** Yes/no flags, eight to a byte. */
  flags(list: boolean[]) {
    for (let i = 0; i < list.length; i += 8) {
      let b = 0;
      for (let k = 0; k < 8 && i + k < list.length; k++) if (list[i + k]) b |= 1 << k;
      this.bytes.push(b);
    }
  }
}

class Reader {
  private at = 0;
  constructor(private readonly bytes: Uint8Array) {}

  uint(): number {
    let v = 0;
    let scale = 1;
    for (;;) {
      if (this.at >= this.bytes.length) throw new Error('code too short');
      const b = this.bytes[this.at++]!;
      v += (b & 127) * scale;
      if (b < 128) return v;
      scale *= 128;
      if (scale > 2 ** 49) throw new Error('number too long');
    }
  }

  int(): number {
    const v = this.uint();
    return v % 2 ? -(v + 1) / 2 : v / 2;
  }

  flags(count: number): boolean[] {
    const out: boolean[] = [];
    for (let i = 0; i < count; i += 8) {
      if (this.at >= this.bytes.length) throw new Error('code too short');
      const b = this.bytes[this.at++]!;
      for (let k = 0; k < 8 && i + k < count; k++) out.push((b & (1 << k)) !== 0);
    }
    return out;
  }

  get done(): boolean {
    return this.at === this.bytes.length;
  }
}

/** A list index written as index + 1, so 0 can mean "none". */
function indexOrNone(list: readonly string[], id: string | null | undefined): number {
  return id == null ? 0 : list.indexOf(id) + 1;
}

export function packSave(save: SaveData, map: MapDef): Uint8Array {
  const ports = map.ports.map((p) => p.id);
  const w = new Writer();
  w.uint(save.version);
  w.uint(layoutFingerprint(map));

  w.uint(save.time);
  w.uint(Math.min(save.economyPending ?? 0, save.time));
  w.int(save.windOffsetDeg);
  w.int(save.boat.x * 10);
  w.int(save.boat.y * 10);
  w.uint(Math.round((((save.boat.heading % TAU) + TAU) % TAU) * (1800 / Math.PI)) % 3600);
  w.uint(save.boat.sailStep === undefined ? 0 : save.boat.sailStep + 1);

  w.uint(save.gold);
  w.uint(SHIP_IDS.indexOf(save.activeShip));
  w.flags(SHIP_IDS.map((id) => save.ships[id] !== undefined));
  for (const id of SHIP_IDS) {
    const levels = save.ships[id];
    if (!levels) continue;
    for (const t of UPGRADE_TRACKS) w.uint(levels[t]);
    w.uint(save.hullDamage?.[id] ?? 0);
  }
  for (const g of GOODS) w.uint(save.cargo[g] ?? 0);
  w.uint(indexOrNone(ports, save.dockedAt));

  w.flags(ports.map((id) => save.markets[id] !== undefined));
  for (const id of ports) {
    const stock = save.markets[id];
    if (stock) for (const g of GOODS) w.uint(stock[g] ?? 0);
  }

  const contracts = save.contracts;
  for (const id of ports) {
    const c = contracts?.byPort[id];
    // Good + 1 (0 = no order) and the help flag share one number.
    w.uint(c ? (GOODS.indexOf(c.good) + 1) * 2 + (c.help ? 1 : 0) : 0);
    if (!c) continue;
    w.uint(c.qty);
    w.uint(c.reward);
    w.uint(c.readyIn);
  }
  w.uint(contracts?.completed ?? 0);
  w.uint(contracts?.helpIn ?? 0);

  const discovered = save.progress?.discovered ?? [];
  w.flags(ports.map((id) => discovered.includes(id)));
  for (const id of ports) w.uint(save.progress?.standing[id] ?? 0);

  const towns = save.settlements;
  w.uint(towns?.pendingSupply ? 1 : 0);
  w.flags(ports.map((id) => towns?.byPort[id] !== undefined));
  for (const id of ports) {
    const s = towns?.byPort[id];
    if (!s) continue;
    w.uint(s.level);
    w.uint(s.growth);
    w.uint(s.sinceSupply);
    w.uint(s.rare);
    w.uint(s.advancedBeforeSupply ?? 0);
  }

  w.uint(indexOrNone(DIFFICULTIES, save.difficulty));
  w.uint(indexOrNone(DIFFICULTIES, save.easiestDifficulty));

  const home = save.home;
  if (home?.owned) {
    const spots = homeSpots(map);
    w.uint(HOME_SECTION);
    w.uint(homeFingerprint(map));
    w.flags(spots.map((s) => home.offered.includes(s.id)));
    for (const s of spots) w.uint(indexOrNone(BUILDING_IDS, home.built[s.id]));
  }
  return Uint8Array.from(w.bytes);
}

/** Why a packed code could not be read back. */
export type UnpackProblem = 'newer' | 'otherVersion' | 'unreadable';

/**
 * Bytes back into a save shaped like the JSON one, for `validateSave` to check. Throws on a cut or
 * overlong code.
 */
export function unpackSave(
  bytes: Uint8Array,
  map: MapDef,
  saveVersion: number,
): { ok: true; raw: SaveData } | { ok: false; problem: UnpackProblem } {
  const ports = map.ports.map((p) => p.id);
  const r = new Reader(bytes);
  const version = r.uint();
  if (version > saveVersion) return { ok: false, problem: 'newer' };
  if (r.uint() !== layoutFingerprint(map)) return { ok: false, problem: 'otherVersion' };
  const pick = (list: readonly string[], n: number) => (n > 0 ? list[n - 1] : undefined);

  const time = r.uint();
  const economyPending = r.uint();
  const windOffsetDeg = r.int();
  const x = r.int() / 10;
  const y = r.int() / 10;
  const heading = (r.uint() * Math.PI) / 1800;
  const sail = r.uint();

  const gold = r.uint();
  const activeShip = SHIP_IDS[r.uint()] ?? '';
  const owned = r.flags(SHIP_IDS.length);
  const ships: SaveData['ships'] = {};
  const hullDamage: Record<string, number> = {};
  SHIP_IDS.forEach((id, k) => {
    if (!owned[k]) return;
    const levels = { sails: 1, hold: 1, hull: 1 };
    for (const t of UPGRADE_TRACKS) levels[t] = r.uint();
    ships[id] = levels;
    const damage = r.uint();
    if (damage) hullDamage[id] = damage;
  });
  const cargo = Object.fromEntries(GOODS.map((g) => [g, r.uint()])) as SaveData['cargo'];
  const dockedAt = pick(ports, r.uint()) ?? null;

  const hasMarket = r.flags(ports.length);
  const markets: SaveData['markets'] = {};
  ports.forEach((id, k) => {
    if (hasMarket[k])
      markets[id] = Object.fromEntries(GOODS.map((g) => [g, r.uint()])) as SaveData['cargo'];
  });

  const byPort: NonNullable<SaveData['contracts']>['byPort'] = {};
  for (const id of ports) {
    const head = r.uint();
    if (!head) continue;
    const good = GOODS[Math.floor(head / 2) - 1];
    const qty = r.uint();
    const reward = r.uint();
    const readyIn = r.uint();
    // An unknown good reads as no order; validateSave would drop it anyway.
    if (good)
      byPort[id] = { portId: id, good, qty, reward, readyIn, ...(head % 2 ? { help: true } : {}) };
  }
  const completed = r.uint();
  const helpIn = r.uint();

  const found = r.flags(ports.length);
  const discovered = ports.filter((_, k) => found[k]);
  const standing: Record<string, number> = {};
  for (const id of ports) {
    const n = r.uint();
    if (n) standing[id] = n;
  }

  const pendingSupply = r.uint() === 1;
  const hasTown = r.flags(ports.length);
  const towns: NonNullable<SaveData['settlements']>['byPort'] = {};
  ports.forEach((id, k) => {
    if (!hasTown[k]) return;
    const level = r.uint();
    const growth = r.uint();
    const sinceSupply = r.uint();
    const rare = r.uint();
    const before = r.uint();
    towns[id] = {
      level,
      growth,
      sinceSupply,
      rare,
      ...(before ? { advancedBeforeSupply: before } : {}),
    };
  });

  const difficulty = pick(DIFFICULTIES, r.uint());
  const easiestDifficulty = pick(DIFFICULTIES, r.uint());

  // Only an island that is the captain's is written; a code without the section has none.
  let home: SaveData['home'];
  if (!r.done) {
    const section = r.uint();
    if (section > HOME_SECTION) return { ok: false, problem: 'newer' };
    if (r.uint() !== homeFingerprint(map)) return { ok: false, problem: 'otherVersion' };
    const spots = homeSpots(map);
    const offered = r.flags(spots.length);
    const built: Record<string, string> = {};
    for (const s of spots) {
      const b = pick(BUILDING_IDS, r.uint());
      if (b) built[s.id] = b;
    }
    home = { owned: true, offered: spots.filter((_, k) => offered[k]).map((s) => s.id), built };
  }
  if (!r.done) return { ok: false, problem: 'unreadable' };

  return {
    ok: true,
    raw: {
      version,
      map: map.name,
      time,
      economyPending,
      windOffsetDeg,
      boat: { x, y, heading, ...(sail ? { sailStep: sail - 1 } : {}) },
      gold,
      activeShip,
      ships,
      cargo,
      hullDamage,
      dockedAt,
      markets,
      contracts: { byPort, completed, ...(helpIn ? { helpIn } : {}) },
      progress: { discovered, standing },
      settlements: { byPort: towns, ...(pendingSupply ? { pendingSupply } : {}) },
      ...(difficulty ? { difficulty } : {}),
      ...(easiestDifficulty ? { easiestDifficulty } : {}),
      ...(home ? { home } : {}),
    },
  };
}
