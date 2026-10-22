import jsQR from 'jsqr';
import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { SAVE_KEY, type SaveStorage, loadGame, serializeWorld } from '../src/sim/save';
import {
  encodeSaveCode,
  extractCode,
  readSaveCode,
  readSaveFile,
  saveFileName,
  saveFileText,
  storeSave,
  summarize,
  transferLink,
} from '../src/sim/saveTransfer';
import { SLOOP } from '../src/sim/ship';
import { type World, createWorld, stepWorld } from '../src/sim/world';
import { qrSvg } from '../src/ui/qr';

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
  const qr = encode(text, { ecc: 'L', border: 4 });
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

describe('save transfer (decision 0066)', () => {
  it('moves a voyage through a code and back, unchanged where it matters', () => {
    const from = playedWorld();
    const code = encodeSaveCode(serializeWorld(from));
    const to = createWorld(PHASE1_MAP, SLOOP);
    const read = readSaveCode(code, to);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.save.gold).toBe(4321.5);
    expect(read.save.ships.cutter).toEqual({ sails: 2, hold: 3, hull: 1 });
    expect(read.save.cargo.planks).toBe(5);
    expect(read.save.boat.x).toBeCloseTo(from.boat.x, 1);
    expect(read.save.contracts).toEqual(from.trade.contracts);
    for (const [id, town] of Object.entries(from.trade.settlements.byPort)) {
      expect(read.save.settlements!.byPort[id]!.level).toBe(town.level);
      expect(read.save.settlements!.byPort[id]!.sinceSupply).toBeCloseTo(town.sinceSupply, 1);
    }

    // Stored on the new device, the game resumes it like any save.
    const storage = new MemoryStorage();
    expect(storeSave(storage, read.save)).toBe(true);
    const resumed = createWorld(PHASE1_MAP, SLOOP);
    expect(loadGame(storage, resumed)).toBe(true);
    expect(resumed.trade.captain.gold).toBe(4321.5);
  });

  it('fits in a QR code that a phone can read off a screen', () => {
    const code = encodeSaveCode(serializeWorld(playedWorld()));
    const link = transferLink(`${GAME}?debug#old`, code);
    expect(link.startsWith(`${GAME}?debug#voyage=FW1`)).toBe(true);
    const { version } = qrSvg(link);
    console.log(`link ${link.length} chars, QR version ${version}`);
    // Version 25 is 117 modules: about 2.5 px each in a 300 px square. Keep well under it.
    expect(version).toBeLessThanOrEqual(25);
    expect(scan(link)).toBe(link);
  });

  it('reads a code from a link, or pasted with spaces and line breaks', () => {
    const code = encodeSaveCode(serializeWorld(playedWorld()));
    expect(extractCode(transferLink(GAME, code))).toBe(code);
    expect(extractCode(`  ${code.slice(0, 40)}\n${code.slice(40)} `)).toBe(code);
    expect(extractCode('hello')).toBeNull();
    expect(extractCode('https://example.com/#voyage=')).toBeNull();
  });

  it('refuses cut, mistyped and foreign codes', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const code = encodeSaveCode(serializeWorld(playedWorld()));
    expect(readSaveCode(code.slice(0, -12), world)).toEqual({ ok: false, problem: 'unreadable' });
    const i = Math.floor(code.length / 2);
    const typo = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    expect(readSaveCode(typo, world).ok).toBe(false);
    expect(readSaveCode('FW1notacode', world)).toEqual({ ok: false, problem: 'unreadable' });
  });

  it('says when a voyage is from a newer game or another map', () => {
    const world = createWorld(PHASE1_MAP, SLOOP);
    const save = serializeWorld(playedWorld());
    expect(readSaveCode(encodeSaveCode({ ...save, version: 99 }), world)).toEqual({
      ok: false,
      problem: 'newer',
    });
    expect(readSaveCode(encodeSaveCode({ ...save, map: 'Elsewhere' }), world)).toEqual({
      ok: false,
      problem: 'otherMap',
    });
    expect(readSaveCode(encodeSaveCode({ ...save, gold: -5 }), world)).toEqual({
      ok: false,
      problem: 'damaged',
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
