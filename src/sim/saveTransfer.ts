import { strFromU8, strToU8, unzlibSync, zlibSync } from 'fflate';
import type { MapDef } from './map';
import { SAVE_KEY, SAVE_VERSION, type SaveData, type SaveStorage, validateSave } from './save';
import { packSave, unpackSave } from './saveCode';
import type { World } from './world';

/**
 * Moving a voyage between devices without a server (decision 0066).
 *
 * - Main way: a save code, the save packed as whole numbers (FW2, decision 0118), squeezed with
 *   zlib and written in URL-safe base64, shown as a QR code. Older FW1 codes (named JSON) still
 *   read. The QR holds a link to the game (`…/#voyage=CODE`), so the other device can scan
 *   it with the game's own scanner or with its ordinary camera app.
 * - Second way: the same save as a readable `.json` file.
 *
 * Everything coming in goes through `validateSave`, and zlib's checksum catches a mangled code.
 * Pure: no DOM, so the tests run it as is.
 */
export const CODE_PREFIX = 'FW2';
/** The first codes (decision 0066): the save's JSON, squeezed. Read, no longer written. */
export const JSON_CODE_PREFIX = 'FW1';
const PREFIXES = [CODE_PREFIX, JSON_CODE_PREFIX];
export const LINK_KEY = 'voyage';
const FILE_GAME = 'fair-winds-trading';

/** Why an incoming voyage was refused, for a clear message. */
export type TransferProblem = 'unreadable' | 'newer' | 'otherMap' | 'otherVersion' | 'damaged';

export type TransferResult = { ok: true; save: SaveData } | { ok: false; problem: TransferProblem };

/** Round fractional numbers (market stocks, time, position) to 2 decimals: half the code size. */
function compact(v: unknown): unknown {
  if (typeof v === 'number') return Number.isInteger(v) ? v : Math.round(v * 100) / 100;
  if (Array.isArray(v)) return v.map(compact);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = compact(x);
    return out;
  }
  return v;
}

export function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Goods a hold or market has none of can go: a missing good reads back as 0. */
function withoutZeros(amounts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(amounts).filter(([, n]) => n !== 0));
}

/** The save code: whole numbers in the map's and data files' order (FW2, decision 0118). */
export function encodeSaveCode(save: SaveData, map: MapDef): string {
  return CODE_PREFIX + toBase64Url(zlibSync(packSave(save, map), { level: 9 }));
}

/** An FW1 code (decision 0066), as the game wrote them before 0118. Kept for the tests. */
export function encodeJsonSaveCode(save: SaveData): string {
  const markets: Record<string, Record<string, number>> = {};
  for (const [id, stock] of Object.entries(save.markets)) markets[id] = withoutZeros(stock);
  const json = JSON.stringify(compact({ ...save, cargo: withoutZeros(save.cargo), markets }));
  return JSON_CODE_PREFIX + toBase64Url(zlibSync(strToU8(json), { level: 9 }));
}

/** The link a QR code carries: the game's own address with the code after `#voyage=`. */
export function transferLink(gameUrl: string, code: string): string {
  return `${gameUrl.split('#')[0]}#${LINK_KEY}=${code}`;
}

/** The code inside a link, a pasted code (spaces and line breaks allowed), or null. */
export function extractCode(text: string): string | null {
  const flat = text.replace(/\s+/g, '');
  const at = flat.indexOf(`#${LINK_KEY}=`);
  const code = at >= 0 ? flat.slice(at + LINK_KEY.length + 2) : flat;
  return PREFIXES.some((p) => code.startsWith(p)) && /^[A-Za-z0-9_-]+$/.test(code) ? code : null;
}

function check(raw: unknown, world: World): TransferResult {
  if (!raw || typeof raw !== 'object') return { ok: false, problem: 'unreadable' };
  const { version, map } = raw as { version?: unknown; map?: unknown };
  if (typeof version !== 'number') return { ok: false, problem: 'unreadable' };
  if (version > SAVE_VERSION) return { ok: false, problem: 'newer' };
  if (
    version === SAVE_VERSION &&
    map !== world.map.name &&
    !world.map.compatibleSaveMaps?.includes(map as string)
  )
    return { ok: false, problem: 'otherMap' };
  const save = validateSave(raw, world);
  return save ? { ok: true, save } : { ok: false, problem: 'damaged' };
}

/**
 * Read a scanned or pasted code (or link) into a checked save. `earlier` are maps the world's map
 * grew from under the same name (decision 0189: the Windward Ring inside the grown sea): an FW2
 * code written there has shorter lists, so it reads with that map's lists and is then checked
 * against the world's map, which still has every port, island and quest it names.
 */
export function readSaveCode(
  text: string,
  world: World,
  earlier: readonly MapDef[] = [],
): TransferResult {
  const code = extractCode(text);
  if (!code) return { ok: false, problem: 'unreadable' };
  let raw: unknown;
  try {
    const bytes = unzlibSync(fromBase64Url(code.slice(CODE_PREFIX.length)));
    if (code.startsWith(JSON_CODE_PREFIX)) raw = JSON.parse(strFromU8(bytes));
    else {
      let read = unpackSave(bytes, world.map, SAVE_VERSION);
      for (const map of earlier.filter((m) => m.name === world.map.name && m !== world.map)) {
        if (read.ok || read.problem !== 'otherVersion') break;
        read = unpackSave(bytes, map, SAVE_VERSION);
      }
      if (!read.ok) return read;
      raw = read.raw;
    }
  } catch {
    // Bad base64, a failed checksum (a cut or mistyped code), not JSON or too few numbers.
    return { ok: false, problem: 'unreadable' };
  }
  return check(raw, world);
}

/** The `.json` file: a small labelled wrapper around the save, readable in any text editor. */
export function saveFileText(save: SaveData, exportedAt: Date): string {
  return JSON.stringify(
    { game: FILE_GAME, exportedAt: exportedAt.toISOString(), save: compact(save) },
    null,
    1,
  );
}

export function saveFileName(exportedAt: Date): string {
  return `fair-winds-voyage-${exportedAt.toISOString().slice(0, 10)}.json`;
}

/** Read a save file. Takes the wrapper above, or a bare save as stored in the browser. */
export function readSaveFile(text: string, world: World): TransferResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'unreadable' };
  }
  if (raw && typeof raw === 'object' && 'save' in raw) {
    if ((raw as { game?: unknown }).game !== FILE_GAME) return { ok: false, problem: 'unreadable' };
    raw = (raw as { save: unknown }).save;
  }
  return check(raw, world);
}

/** The few facts a captain recognises a voyage by, for the "replace?" question. */
export interface VoyageSummary {
  gold: number;
  ship: string;
  fleet: number;
  minutes: number;
  cargo: number;
}

export function summarize(save: SaveData): VoyageSummary {
  return {
    gold: Math.floor(save.gold),
    ship: save.activeShip,
    fleet: Object.keys(save.ships).length,
    minutes: Math.round(save.time / 60),
    cargo: Object.values(save.cargo).reduce((a, b) => a + b, 0),
  };
}

/** Store an incoming voyage as this device's save; the game reloads into it. */
export function storeSave(storage: SaveStorage, save: SaveData): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
