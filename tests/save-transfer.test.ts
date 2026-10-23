import { readFileSync } from 'node:fs';
import { zlibSync } from 'fflate';
import jsQR from 'jsqr';
import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import type { MapDef } from '../src/sim/map';
import type { QuestDef } from '../src/sim/quests';
import {
  SAVE_KEY,
  type SaveData,
  type SaveStorage,
  loadGame,
  serializeWorld,
} from '../src/sim/save';
import { packSave, unpackSave } from '../src/sim/saveCode';
import {
  encodeSaveCode,
  encodeJsonSaveCode,
  extractCode,
  readSaveCode,
  readSaveFile,
  saveFileName,
  saveFileText,
  storeSave,
  summarize,
  toBase64Url,
  transferLink,
} from '../src/sim/saveTransfer';
import { SLOOP } from '../src/sim/ship';
import { type World, createWorld, stepWorld } from '../src/sim/world';
import { qrSvg } from '../src/ui/qr';
import pier from './fixtures/quests/test-pier.json';
import sailing from './fixtures/quests/test-sailing.json';

const GAME = 'https://djguiaume.github.io/fair-winds-trading/';

class MemoryStorage implements SaveStorage {
  private data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

/** A voyage some way in: sailed a while, a second ship, gold and cargo, upgrades. */
function playedWorld(): World {
  const w = createWorld(PHASE1_MAP, SLOOP);
  for (let i = 0; i < 3000; i++)
    stepWorld(w, { steer: i % 400 < 200 ? 0.3 : -0.3, sailStep: 3 }, 0.1);
  const c = w.trade.captain;
  c.gold = 4321.5;
  c.ships.cutter = { sails: 2, hold: 3, hull: 1 };
  c.cargo.fish = 12;
  c.cargo.planks = 5;
  return w;
}

/** Decode a QR the way a camera would: rasterise the modules and run a real decoder on them. */
function scan(text: string): string | null {
  const qr = encode(text, { ecc: 'M', border: 4 });
  const px = 4;
  const n = qr.size * px;
  const rgba = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const v = qr.data[Math.floor(y / px)]![Math.floor(x / px)] ? 0 : 255;
      rgba.set([v, v, v, 255], (y * n + x) * 4);
    }
  return jsQR(rgba, n, n)?.data ?? null;
}

/** The code for a voyage on the test map. */
const codeOf = (save: SaveData) => encodeSaveCode(save, PHASE1_MAP);

/** A code made by the game before decision 0118 (FW1, named JSON). */
const OLD_CODE = readFileSync(
  new URL('./fixtures/fw1-voyage-code.txt', import.meta.url),
  'utf8',
).trim();

/** Links longer than this start to break in some apps (Guillaume, 2026-10-23). */
const LINK_BUDGET = 1000;

/** The 5x map (decision 0118): about 30 ports, each a copy of a played port with its own numbers. */
function biggerSea(save: SaveData, copies: number): { map: MapDef; save: SaveData } {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const map: MapDef = structuredClone(PHASE1_MAP);
  const big: SaveData = structuredClone(save);
  for (let n = 2; n <= copies; n++)
    for (const port of PHASE1_MAP.ports) {
      const id = `${port.id}-${n}`;
      map.ports.push({ ...port, id });
      big.markets[id] = Object.fromEntries(
        Object.entries(save.markets[port.id]!).map(([g, v]) => [g, v * (0.6 + rnd() * 0.8)]),
      ) as SaveData['cargo'];
      const order = save.contracts!.byPort[port.id]!;
      big.contracts!.byPort[id] = { ...order, portId: id, qty: 2 + Math.floor(rnd() * 8) };
      big.contracts!.byPort[id]!.reward = 50 + Math.floor(rnd() * 300);
      big.settlements!.byPort[id] = {
        level: 1 + Math.floor(rnd() * 4),
        growth: rnd() * 40,
        sinceSupply: rnd() * 600,
        rare: Math.floor(rnd() * 5),
      };
      big.progress!.discovered.push(id);
      big.progress!.standing[id] = Math.floor(rnd() * 8);
    }
  return { map, save: big };
}

describe('save transfer (decisions 0066, 0118)', () => {
  it('moves a voyage through a code and back, unchanged where it matters', () => {
    const from = playedWorld();
    const code = codeOf(serializeWorld(from));
    expect(code.startsWith('FW2')).toBe(true);
    const to = createWorld(PHASE1_MAP, SLOOP);
    const read = readSaveCode(code, to);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    // Whole numbers: the game shows no decimals, so the hidden half gold piece rounds.
    expect(read.save.gold).toBe(4322);
    expect(read.save.ships.cutter).toEqual({ sails: 2, hold: 3, hull: 1 });
    expect(read.save.cargo.planks).toBe(5);
    expect(read.save.boat.x).toBeCloseTo(from.boat.x, 1);
    expect(read.save.boat.y).toBeCloseTo(from.boat.y, 1);
    expect(Math.abs(read.save.boat.heading - (from.boat.heading % (2 * Math.PI)))).toBeLessThan(
      0.001,
    );
    expect(read.save.boat.sailStep).toBe(from.boat.sailStep);
    expect(Math.abs(read.save.time - from.time)).toBeLessThanOrEqual(0.5);
    for (const [id, order] of Object.entries(from.trade.contracts.byPort)) {
      const got = read.save.contracts!.byPort[id]!;
      expect({ ...got, readyIn: 0, reward: 0 }).toEqual({ ...order, readyIn: 0, reward: 0 });
      expect(Math.abs(got.readyIn - order.readyIn)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(got.reward - order.reward)).toBeLessThanOrEqual(0.5);
    }
    for (const [id, m] of Object.entries(from.trade.markets))
      for (const [g, n] of Object.entries(m.stock))
        expect(Math.abs(read.save.markets[id]![g as 'fish'] - n)).toBeLessThanOrEqual(0.5);
    for (const [id, town] of Object.entries(from.trade.settlements.byPort)) {
      expect(read.save.settlements!.byPort[id]!.level).toBe(town.level);
      expect(
        Math.abs(read.save.settlements!.byPort[id]!.sinceSupply - town.sinceSupply),
      ).toBeLessThanOrEqual(0.5);
    }
    expect(read.save.progress).toEqual(from.trade.progress);
    expect(read.save.difficulty).toBe(from.trade.difficulty);

    // Stored on the new device, the game resumes it like any save.
    const storage = new MemoryStorage();
    expect(storeSave(storage, read.save)).toBe(true);
    const resumed = createWorld(PHASE1_MAP, SLOOP);
    expect(loadGame(storage, resumed)).toBe(true);
    expect(resumed.trade.captain.gold).toBe(4322);
  });

  it('still reads the FW1 codes made before 0118', () => {
    const read = readSaveCode(OLD_CODE, createWorld(PHASE1_MAP, SLOOP));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.save.gold).toBe(4321.5);
    expect(read.save.ships.cutter).toEqual({ sails: 2, hold: 3, hull: 1 });
    expect(extractCode(transferLink(GAME, OLD_CODE))).toBe(OLD_CODE);
    const fresh = encodeJsonSaveCode(serializeWorld(playedWorld()));
    expect(readSaveCode(fresh, createWorld(PHASE1_MAP, SLOOP)).ok).toBe(true);
  });

  it('fits in a QR code that a phone can read off a screen', () => {
    const code = codeOf(serializeWorld(playedWorld()));
    const link = transferLink(`${GAME}?debug#old`, code);
    expect(link.startsWith(`${GAME}?debug#voyage=FW2`)).toBe(true);
    const { version } = qrSvg(link, 'M');
    console.log(`link ${link.length} chars, QR version ${version}`);
    // Today's sea: a small, easy QR code (FW1 was about version 23).
    expect(link.length).toBeLessThanOrEqual(400);
    expect(version).toBeLessThanOrEqual(14);
    expect(scan(link)).toBe(link);
  });

  it('keeps the link under 1,000 characters on a 5x sea of 30 ports', () => {
    const { map, save } = biggerSea(serializeWorld(playedWorld()), 5);
    expect(map.ports.length).toBe(30);
    const code = encodeSaveCode(save, map);
    const link = transferLink(GAME, code);
    const { version } = qrSvg(link, 'M');
    console.log(`5x sea: link ${link.length} chars, QR version ${version}`);
    expect(link.length).toBeLessThanOrEqual(LINK_BUDGET);
    // Version 25 is 117 modules: about 2.5 px each in a 300 px square. Keep under it.
    expect(version).toBeLessThanOrEqual(25);
    expect(scan(link)).toBe(link);
    const read = unpackSave(new Uint8Array(packSave(save, map)), map, save.version);
    expect(read.ok).toBe(true);
    if (read.ok) expect(Object.keys(read.raw.markets)).toHaveLength(30);
  });

  it('stays under 1,000 characters on the 5x sea with four arcs under way and a home island (0125, 0126)', () => {
    const { map, save } = biggerSea(serializeWorld(playedWorld()), 5);
    // Four arcs and a prologue, as test files: two done, one on a timed run, one carrying cargo.
    const arcs = ['prologue', 'calda', 'westholm', 'stonehaven', 'watchman'].map((id, i) => ({
      ...structuredClone(i % 2 ? pier : sailing),
      id,
    })) as unknown as QuestDef[];
    save.quests = {
      byId: {
        prologue: { step: 'done', counts: [], chose: {} },
        calda: { step: 'done', counts: [], chose: { build: 'workshop' } },
        westholm: { step: 'trial', counts: [1, 14250, 1], chose: {} },
        stonehaven: { step: 'timber', counts: [7], chose: {} },
        watchman: { step: 'stones', counts: [1, 1], chose: {} },
      },
      tracked: 'westholm',
    };
    // And the home island with two buildings and a spot waiting (decision 0126).
    save.home = {
      owned: true,
      offered: ['spot-3'],
      built: { 'spot-1': 'workshop', 'spot-2': 'bakehouse', 'spot-5': 'warehouse' },
    };
    const link = transferLink(
      GAME,
      `FW2${toBase64Url(zlibSync(packSave(save, map, arcs), { level: 9 }))}`,
    );
    const plain = transferLink(
      GAME,
      encodeSaveCode({ ...save, quests: { byId: {} }, home: undefined }, map),
    );
    console.log(
      `5x sea with quests and home: link ${link.length} chars (+${link.length - plain.length})`,
    );
    expect(link.length).toBeLessThanOrEqual(LINK_BUDGET);
    const read = unpackSave(packSave(save, map, arcs), map, save.version, arcs);
    expect(read.ok && read.raw.quests).toEqual(save.quests);
    expect(read.ok && read.raw.home).toEqual(save.home);
  });

  it('reads a code from a link, or pasted with spaces and line breaks', () => {
    const code = codeOf(serializeWorld(playedWorld()));
    expect(extractCode(transferLink(GAME, code))).toBe(code);
    expect(extractCode(`  ${code.slice(0, 40)}\n${code.slice(40)} `)).toBe(code);
    expect(extractCode('hello')).toBeNull();
    expect(extractCode('https://example.com/#voyage=')).toBeNull();
  });

  it('refuses cut, mistyped and foreign codes', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const save = serializeWorld(playedWorld());
    const code = codeOf(save);
    expect(readSaveCode(code.slice(0, -12), world)).toEqual({ ok: false, problem: 'unreadable' });
    const i = Math.floor(code.length / 2);
    const typo = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    expect(readSaveCode(typo, world).ok).toBe(false);
    expect(readSaveCode('FW1notacode', world)).toEqual({ ok: false, problem: 'unreadable' });
    expect(readSaveCode('FW2notacode', world)).toEqual({ ok: false, problem: 'unreadable' });
    // A sound checksum around too few or too many numbers.
    const packed = packSave(save, PHASE1_MAP);
    for (const bytes of [packed.slice(0, -3), Uint8Array.from([...packed, 0])])
      expect(readSaveCode(`FW2${toBase64Url(zlibSync(bytes))}`, world)).toEqual({
        ok: false,
        problem: 'unreadable',
      });
  });

  it('says when a voyage is from a newer game or another map', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const save = serializeWorld(playedWorld());
    expect(readSaveCode(codeOf({ ...save, version: 99 }), world)).toEqual({
      ok: false,
      problem: 'newer',
    });
    expect(readSaveCode(encodeJsonSaveCode({ ...save, map: 'Elsewhere' }), world)).toEqual({
      ok: false,
      problem: 'otherMap',
    });
    // Sailing a ship the captain does not own.
    expect(readSaveCode(codeOf({ ...save, activeShip: 'clipper' }), world)).toEqual({
      ok: false,
      problem: 'damaged',
    });
  });

  it('refuses a code from a game whose ports or goods lists differ', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const save = serializeWorld(playedWorld());
    const moved: MapDef = { ...PHASE1_MAP, ports: [...PHASE1_MAP.ports].reverse() };
    expect(readSaveCode(encodeSaveCode(save, moved), world)).toEqual({
      ok: false,
      problem: 'otherVersion',
    });
    const renamed: MapDef = { ...PHASE1_MAP, name: 'Elsewhere' };
    expect(readSaveCode(encodeSaveCode(save, renamed), world)).toEqual({
      ok: false,
      problem: 'otherVersion',
    });
  });

  it('exports a readable file and imports it, or a bare save', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const save = serializeWorld(playedWorld());
    const when = new Date('2026-10-22T14:00:00Z');
    expect(saveFileName(when)).toBe('fair-winds-voyage-2026-10-22.json');
    const text = saveFileText(save, when);
    expect(JSON.parse(text).game).toBe('fair-winds-trading');
    expect(readSaveFile(text, world).ok).toBe(true);
    expect(readSaveFile(JSON.stringify(save), world).ok).toBe(true);
    expect(readSaveFile('{"game":"other","save":{}}', world)).toEqual({
      ok: false,
      problem: 'unreadable',
    });
    expect(readSaveFile('not json', world)).toEqual({ ok: false, problem: 'unreadable' });
    expect(readSaveFile(text.slice(0, text.length / 2), world).ok).toBe(false);
  });

  it('summarises a voyage for the replace question', () => {
    const s = summarize(serializeWorld(playedWorld()));
    expect(s).toMatchObject({ gold: 4321, ship: 'sloop', fleet: 2, minutes: 5, cargo: 17 });
  });

  it('stores under the normal save key', () => {
    const storage = new MemoryStorage();
    storeSave(storage, serializeWorld(playedWorld()));
    expect(storage.getItem(SAVE_KEY)).toContain('"version":1');
  });
});
