import { DIFFICULTIES } from './difficulty';
import { GOODS, type GoodId, isFar } from './goods';
import { BUILDING_IDS, buildableIslands, homeSpots } from './home';
import { chartAreaIds, fogIslandIds } from './fog';
import { chartableZoneIds, type MapDef } from './map';
import { slotLayout } from './questLibrary';
import { readRaceRecord, writeRaceRecord } from './raceRecords';
import {
  type QuestDef,
  type QuestState,
  QUEST_DONE,
  hasQuestProgress,
  questFingerprint,
  questsFor,
} from './quests';
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

/**
 * The goods list before the far goods (decision 0146) were added at its end: codes made with it
 * still read, with no far goods in them.
 */
const GOODS_BEFORE_FAR: readonly GoodId[] = GOODS.filter((g) => !isFar(g));

/**
 * The port lists a code may have been written with: the map's, and the map's before its empty
 * islands to found were added (decision 0157), so a code from before a sea had its site still reads.
 */
function portLists(map: MapDef): string[][] {
  const all = map.ports.map((p) => p.id);
  const open = map.ports.filter((p) => !p.site).map((p) => p.id);
  return open.length === all.length ? [all] : [all, open];
}

/** Every id list the layout depends on, in order. */
function layoutIds(
  map: MapDef,
  goods: readonly string[],
  ports: readonly string[] = map.ports.map((p) => p.id),
): string[] {
  return [map.name, ...ports, ...goods, ...SHIP_IDS, ...UPGRADE_TRACKS, ...DIFFICULTIES];
}

/** 16-bit FNV-1a of the layout lists: different lists give a different fingerprint. */
export function layoutFingerprint(
  map: MapDef,
  goods: readonly string[] = GOODS,
  ports?: readonly string[],
): number {
  return fingerprint(layoutIds(map, goods, ports));
}

/**
 * The home islands' section (decisions 0126, 0128) comes last, with its own layout number and a
 * fingerprint of the islands, spots and buildings, so codes made before it still read and a code
 * whose spots or buildings differ is refused rather than misread. Section 1 was the first shape
 * (the home island only), section 2 had no warehouse goods (decision 0136); both still read.
 */
const HOME_SECTION = 3;
const spotIds = (map: MapDef, islandId?: string) =>
  homeSpots(map, islandId).map((s) => `${s.id}:${s.pair ?? ''}`);
export function homeFingerprint(map: MapDef): number {
  return fingerprint([
    ...buildableIslands(map).flatMap((i) => [i.id, ...spotIds(map, i.id)]),
    ...BUILDING_IDS,
  ]);
}
function homeFingerprintV1(map: MapDef): number {
  return fingerprint([...spotIds(map), ...BUILDING_IDS]);
}

/**
 * The charted currents' section (decision 0140), after the home islands' one and only when a
 * current is charted: its number, a fingerprint of the map's current ids, their count and a flag
 * each. A game from before it reads the number as a newer code.
 */
const CHARTED_SECTION = 10;
/**
 * The far workshops' section (decision 0146), after the charted currents and only when a workshop
 * holds crafted goods: its number, how many ports, then per port its index, how many goods and
 * each good's index and units.
 */
const WORKSHOP_SECTION = 11;
/**
 * The charted wind zones' section (decision 0152), after the workshops and only when a named zone
 * is charted: its number, a fingerprint of the map's named zone ids, their count and a flag each.
 */
const ZONES_SECTION = 12;
/**
 * Fog of war's section (decision 0156), after the wind zones and only when something in the fog
 * is charted: its number, a fingerprint of the map's chart areas and fogged islands, then the
 * areas' count and a flag each, and the islands' count and a flag each.
 */
const FOG_SECTION = 13;
/**
 * A load on credit (decision 0200), after fog of war's section and only while she owes one: its
 * number, the order's port and the good (indexes), the units and the gold owed.
 */
const CREDIT_SECTION = 14;
/** No section left to read (sections are numbered from 1). */
const NO_SECTION = -1;
const currentIds = (map: MapDef) => (map.currents ?? []).map((c) => c.id);
const currentsFingerprint = (map: MapDef) => fingerprint(currentIds(map));
const zonesFingerprint = (map: MapDef) => fingerprint(chartableZoneIds(map));
const fogFingerprint = (map: MapDef) =>
  fingerprint([...chartAreaIds(map), '|', ...fogIslandIds(map)]);

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

export function packSave(
  save: SaveData,
  map: MapDef,
  quests: readonly QuestDef[] = questsFor(map),
): Uint8Array {
  const ports = map.ports.map((p) => p.id);
  const w = new Writer();
  w.uint(save.version);
  const withQuests = hasQuestProgress(save.quests);
  // With quest progress, the quests' fingerprint is mixed in (it is never 0), so the reader knows
  // the quest section follows and a code from other quest files is refused.
  w.uint(layoutFingerprint(map) ^ (withQuests ? questFingerprint(quests) : 0));

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
  if (withQuests) packQuests(w, save.quests!, quests, ports);

  // Per island with spots: is it hers; then for each of hers, offered flags and one building
  // number per spot.
  const islands = buildableIslands(map);
  const mine = islands.map((i) => !!save.home?.islands[i.id]?.owned);
  if (mine.some(Boolean)) {
    w.uint(HOME_SECTION);
    w.uint(homeFingerprint(map));
    w.flags(mine);
    for (const island of islands.filter((_, k) => mine[k])) {
      const h = save.home!.islands[island.id]!;
      const spots = homeSpots(map, island.id);
      w.flags(spots.map((s) => h.offered.includes(s.id)));
      for (const s of spots) w.uint(indexOrNone(BUILDING_IDS, h.built[s.id]));
      // Warehouse goods: how many kinds, then each good's index and crates.
      const stored = GOODS.filter((g) => (h.stored?.[g] ?? 0) > 0);
      w.uint(stored.length);
      for (const g of stored) {
        w.uint(GOODS.indexOf(g));
        w.uint(h.stored![g]!);
      }
    }
  }
  const ids = currentIds(map);
  const charted = ids.map((id) => !!save.progress?.charted?.includes(id));
  if (charted.some(Boolean)) {
    w.uint(CHARTED_SECTION);
    w.uint(currentsFingerprint(map));
    w.uint(ids.length);
    w.flags(charted);
  }
  const shops = ports.flatMap((id, k) => {
    const goods = GOODS.filter((g) => (save.workshops?.[id]?.[g] ?? 0) > 0);
    return goods.length ? [{ k, id, goods }] : [];
  });
  if (shops.length) {
    w.uint(WORKSHOP_SECTION);
    w.uint(shops.length);
    for (const { k, id, goods } of shops) {
      w.uint(k);
      w.uint(goods.length);
      for (const g of goods) {
        w.uint(GOODS.indexOf(g));
        w.uint(save.workshops![id]![g]!);
      }
    }
  }
  const zoneIds = chartableZoneIds(map);
  const zones = zoneIds.map((id) => !!save.progress?.zones?.includes(id));
  if (zones.some(Boolean)) {
    w.uint(ZONES_SECTION);
    w.uint(zonesFingerprint(map));
    w.uint(zoneIds.length);
    w.flags(zones);
  }
  const areaIds = chartAreaIds(map);
  const islandIds = fogIslandIds(map);
  const areas = areaIds.map((id) => !!save.progress?.areas?.includes(id));
  const sighted = islandIds.map((id) => !!save.progress?.sighted?.includes(id));
  if (areas.some(Boolean) || sighted.some(Boolean)) {
    w.uint(FOG_SECTION);
    w.uint(fogFingerprint(map));
    w.uint(areaIds.length);
    w.flags(areas);
    w.uint(islandIds.length);
    w.flags(sighted);
  }
  const loan = save.loan;
  if (loan && ports.includes(loan.port)) {
    w.uint(CREDIT_SECTION);
    w.uint(ports.indexOf(loan.port));
    w.uint(GOODS.indexOf(loan.good));
    w.uint(loan.qty);
    w.uint(loan.owed);
  }
  return Uint8Array.from(w.bytes);
}

/**
 * The quest section (decision 0125), written only when a quest has progress, so a code without
 * quests is what it was before: per quest 0 (not started), 1 (done) or 2 + its step, the step's
 * numbers, per choice step the option picked + 1, and per var (decision 0151) its port or good
 * + 1, for a standing order (decision 0214) its rounds and wait, and for a race (0217, 0226) its
 * record (`raceRecords.ts`); then the tracked quest + 1.
 */
function packQuests(
  w: Writer,
  state: QuestState,
  quests: readonly QuestDef[],
  ports: readonly string[],
) {
  for (const quest of quests) {
    const p = state.byId[quest.id];
    if (!p) {
      w.uint(0);
      continue;
    }
    const at = quest.steps.findIndex((s) => s.id === p.step);
    w.uint(p.step === QUEST_DONE || at < 0 ? 1 : at + 2);
    if (at >= 0) for (const n of p.counts) w.uint(n);
    for (const step of quest.steps)
      if (step.choose)
        w.uint(
          indexOrNone(
            step.choose.map((o) => o.id),
            p.chose[step.id],
          ),
        );
    for (const [name, kind] of Object.entries(quest.vars ?? {}))
      w.uint(indexOrNone(kind === 'port' ? ports : GOODS, p.vars?.[name]));
    if (quest.repeat) {
      w.uint(p.rounds ?? 0);
      w.uint(p.wait ?? 0);
    }
    if (quest.race) writeRaceRecord(p, (n) => w.uint(n));
  }
  w.uint(
    indexOrNone(
      quests.map((q) => q.id),
      state.tracked,
    ),
  );
}

function unpackQuests(
  r: Reader,
  quests: readonly QuestDef[],
  ports: readonly string[],
): QuestState {
  const byId: QuestState['byId'] = {};
  for (const quest of quests) {
    const head = r.uint();
    if (!head) continue;
    const step = head === 1 ? undefined : quest.steps[head - 2];
    if (head > 1 && !step) throw new Error('no such step');
    const counts = Array.from({ length: slotLayout(step?.goal).size }, () => r.uint());
    const chose: Record<string, string> = {};
    for (const s of quest.steps) {
      if (!s.choose) continue;
      const option = s.choose[r.uint() - 1];
      if (option) chose[s.id] = option.id;
    }
    const vars: Record<string, string> = {};
    for (const [name, kind] of Object.entries(quest.vars ?? {})) {
      const v = (kind === 'port' ? ports : GOODS)[r.uint() - 1];
      if (v) vars[name] = v;
    }
    const rounds = quest.repeat ? r.uint() : 0;
    const wait = quest.repeat ? r.uint() : 0;
    const record = quest.race ? readRaceRecord(() => r.uint()) : {};
    byId[quest.id] = {
      step: step?.id ?? QUEST_DONE,
      counts,
      chose,
      ...(Object.keys(vars).length ? { vars } : {}),
      ...(rounds ? { rounds } : {}),
      ...(wait ? { wait } : {}),
      ...record,
    };
  }
  const tracked = quests[r.uint() - 1]?.id;
  return { byId, ...(tracked ? { tracked } : {}) };
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
  quests: readonly QuestDef[] = questsFor(map),
): { ok: true; raw: SaveData } | { ok: false; problem: UnpackProblem } {
  const r = new Reader(bytes);
  const version = r.uint();
  if (version > saveVersion) return { ok: false, problem: 'newer' };
  const fingerprint = r.uint();
  // A code from before the far goods (0146), or from before a sea's empty island to found (0157),
  // reads with the goods and ports lists it was written with.
  const layout = portLists(map)
    .flatMap((ports) => [GOODS, GOODS_BEFORE_FAR].map((goods) => ({ goods, ports })))
    .find(
      ({ goods, ports }) =>
        fingerprint === layoutFingerprint(map, goods, ports) ||
        fingerprint === (layoutFingerprint(map, goods, ports) ^ questFingerprint(quests)),
    );
  if (!layout) return { ok: false, problem: 'otherVersion' };
  const { goods, ports } = layout;
  const withQuests = fingerprint !== layoutFingerprint(map, goods, ports);
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
  const cargo = Object.fromEntries(goods.map((g) => [g, r.uint()])) as SaveData['cargo'];
  const dockedAt = pick(ports, r.uint()) ?? null;

  const hasMarket = r.flags(ports.length);
  const markets: SaveData['markets'] = {};
  ports.forEach((id, k) => {
    if (hasMarket[k])
      markets[id] = Object.fromEntries(goods.map((g) => [g, r.uint()])) as SaveData['cargo'];
  });

  const byPort: NonNullable<SaveData['contracts']>['byPort'] = {};
  for (const id of ports) {
    const head = r.uint();
    if (!head) continue;
    const good = goods[Math.floor(head / 2) - 1];
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
  const questState = withQuests ? unpackQuests(r, quests, ports) : undefined;

  // Only islands that are the captain's are written; a code without the section has none.
  let home: SaveData['home'];
  let section = r.done ? NO_SECTION : r.uint();
  if (section >= 1 && section <= HOME_SECTION) {
    const v1 = section === 1;
    if (r.uint() !== (v1 ? homeFingerprintV1(map) : homeFingerprint(map)))
      return { ok: false, problem: 'otherVersion' };
    const islands = v1 ? map.islands.filter((i) => i.id === map.homeIsland) : buildableIslands(map);
    const mine = v1 ? [true] : r.flags(islands.length);
    home = { islands: {} };
    for (const island of islands.filter((_, k) => mine[k])) {
      const spots = homeSpots(map, island.id);
      const offered = r.flags(spots.length);
      const built: Record<string, string> = {};
      for (const s of spots) {
        const b = pick(BUILDING_IDS, r.uint());
        if (b) built[s.id] = b;
      }
      const stored: Partial<Record<(typeof GOODS)[number], number>> = {};
      if (section >= 3)
        for (let n = r.uint(); n > 0; n--) {
          const good = goods[r.uint()];
          const qty = r.uint();
          if (good && qty > 0) stored[good] = qty;
        }
      home.islands[island.id] = {
        owned: true,
        offered: spots.filter((_, k) => offered[k]).map((s) => s.id),
        built,
        ...(Object.keys(stored).length ? { stored } : {}),
      };
    }
    section = r.done ? NO_SECTION : r.uint();
  }
  // Charted currents (decision 0140): a code from a map whose currents changed just forgets them.
  let charted: string[] | undefined;
  if (section === CHARTED_SECTION) {
    const ids = currentIds(map);
    const same = r.uint() === currentsFingerprint(map);
    const n = r.uint();
    const flags = r.flags(n);
    if (same && n === ids.length) charted = ids.filter((_, k) => flags[k]);
    section = r.done ? NO_SECTION : r.uint();
  }
  // Far workshops' crafted goods (decision 0146).
  let workshops: SaveData['workshops'];
  if (section === WORKSHOP_SECTION) {
    workshops = {};
    for (let n = r.uint(); n > 0; n--) {
      const id = ports[r.uint()];
      const crafted: Partial<Record<GoodId, number>> = {};
      for (let m = r.uint(); m > 0; m--) {
        const good = goods[r.uint()];
        const qty = r.uint();
        if (good && qty > 0) crafted[good] = qty;
      }
      if (id) workshops[id] = crafted;
    }
    section = r.done ? NO_SECTION : r.uint();
  }
  // Charted wind zones (decision 0152): like the currents, forgotten if the map's zones changed.
  let zones: string[] | undefined;
  if (section === ZONES_SECTION) {
    const ids = chartableZoneIds(map);
    const same = r.uint() === zonesFingerprint(map);
    const n = r.uint();
    const flags = r.flags(n);
    if (same && n === ids.length) zones = ids.filter((_, k) => flags[k]);
    section = r.done ? NO_SECTION : r.uint();
  }
  // Fog of war (decision 0156): forgotten, like the zones, if the map's areas or islands changed.
  let areas: string[] | undefined;
  let sighted: string[] | undefined;
  if (section === FOG_SECTION) {
    const areaIds = chartAreaIds(map);
    const islandIds = fogIslandIds(map);
    const same = r.uint() === fogFingerprint(map);
    const na = r.uint();
    const areaFlags = r.flags(na);
    const ni = r.uint();
    const islandFlags = r.flags(ni);
    if (same && na === areaIds.length && ni === islandIds.length) {
      areas = areaIds.filter((_, k) => areaFlags[k]);
      sighted = islandIds.filter((_, k) => islandFlags[k]);
    }
    section = r.done ? NO_SECTION : r.uint();
  }
  // A load on credit (decision 0200).
  let loan: SaveData['loan'];
  if (section === CREDIT_SECTION) {
    const port = ports[r.uint()];
    const good = goods[r.uint()];
    const qty = r.uint();
    const owed = r.uint();
    if (port && good) loan = { port, good, qty, owed };
    section = r.done ? NO_SECTION : r.uint();
  }
  if (section > HOME_SECTION) return { ok: false, problem: 'newer' };
  if (section !== NO_SECTION || !r.done) return { ok: false, problem: 'unreadable' };

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
      ...(loan ? { loan } : {}),
      dockedAt,
      markets,
      ...(workshops ? { workshops } : {}),
      contracts: { byPort, completed, ...(helpIn ? { helpIn } : {}) },
      progress: {
        discovered,
        standing,
        ...(charted?.length ? { charted } : {}),
        ...(zones?.length ? { zones } : {}),
        ...(areas?.length ? { areas } : {}),
        ...(sighted?.length ? { sighted } : {}),
      },
      settlements: { byPort: towns, ...(pendingSupply ? { pendingSupply } : {}) },
      ...(difficulty ? { difficulty } : {}),
      ...(easiestDifficulty ? { easiestDifficulty } : {}),
      ...(questState ? { quests: questState } : {}),
      ...(home ? { home } : {}),
    },
  };
}
