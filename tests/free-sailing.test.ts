import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SHIPPED_CATALOGUE as CAT } from '../src/data/cosmetics';
import { memoryStorage } from '../src/data/editedMap';
import { FREE_PRESETS, FREE_RULES } from '../src/data/freeSailing';
import { GAME_MAP } from '../src/data/maps';
import { TUNING } from '../src/data/tuning';
import {
  addPreset,
  freeProblems,
  presetFiles,
  removePreset,
  setPresetField,
  shippedFreeDoc,
} from '../src/editor/freeSailing/doc';
import { isUnlocked } from '../src/sim/cosmeticUnlocks';
import { daylightAt, secondsAtHour } from '../src/sim/daylight';
import {
  everythingUnlocked,
  isFreeSailing,
  presetTime,
  sailedWeather,
  setupFor,
  startFreeSession,
} from '../src/sim/freeSailing';
import { type SaveStorage, SAVE_KEY, clearSave, loadGame, saveGame } from '../src/sim/save';
import { SLOOP } from '../src/sim/ship';
import { setShipLook, shipLook } from '../src/sim/shipLooks';
import { weatherAt } from '../src/sim/wind';
import { createWorld } from '../src/sim/world';

const [first, second] = FREE_PRESETS as [(typeof FREE_PRESETS)[0], (typeof FREE_PRESETS)[0]];
const colour = CAT.items.find((i) => i.slot === 'sail-colour' && i.id !== 'canvas')!.id;

/** The browser's storage as the voyage page sees it, logging every write made to it. */
function browserStub() {
  const items = new Map<string, string>();
  const writes: string[] = [];
  const storage: SaveStorage = {
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => {
      writes.push(`set ${k}`);
      items.set(k, v);
    },
    removeItem: (k) => {
      writes.push(`remove ${k}`);
      items.delete(k);
    },
  };
  return { storage, writes };
}

describe('Free Sailing', () => {
  it('opens only on ?free', () => {
    expect(isFreeSailing('?free')).toBe(true);
    expect(isFreeSailing('?debug&free')).toBe(true);
    expect(isFreeSailing('?map=ring')).toBe(false);
    expect(isFreeSailing('')).toBe(false);
  });

  it('ships presets that pass every check', () => {
    expect(FREE_PRESETS.length).toBeGreaterThanOrEqual(4);
    expect(freeProblems(shippedFreeDoc())).toEqual([]);
  });

  it('reads a clock hour back to the game time of day', () => {
    for (const hour of [7, 9, 14.5, 19, 20, 23, 2, 6])
      expect(daylightAt(secondsAtHour(hour)).hour).toBeCloseTo(hour, 5);
  });

  it('starts at the preset hour and weather, never before the session time', () => {
    const world = createWorld(GAME_MAP, SLOOP);
    const weather = sailedWeather(world)!;
    for (const preset of FREE_PRESETS) {
      const from = 5000;
      const t = presetTime(preset, weather, GAME_MAP.seed, from, FREE_RULES.searchDays)!;
      expect(t).toBeGreaterThanOrEqual(from);
      expect(daylightAt(t).hour).toBeCloseTo(preset.hour, 5);
      expect(weatherAt(weather, GAME_MAP.seed, t).kind).toBe(preset.weather);
    }
  });

  it('keeps to the hour alone when Weather is off in Settings', () => {
    const world = createWorld(GAME_MAP, SLOOP);
    world.dynamicWeather = false;
    const rain = FREE_PRESETS.find((p) => p.weather === 'rain')!;
    const days = FREE_RULES.searchDays;
    expect(presetTime(rain, sailedWeather(world), GAME_MAP.seed, 0, days)).toBeNull();
    startFreeSession(world, rain, setupFor(rain), FREE_RULES);
    expect(daylightAt(world.time).hour).toBeCloseTo(rain.hour, 5);
  });

  it('puts the session at the preset in the chosen ship, with nothing to spend or carry', () => {
    const world = createWorld(GAME_MAP, SLOOP);
    world.trade.captain.gold = 999;
    world.trade.dockedAt = 'saltmere';
    const setup = {
      ...setupFor(first),
      ship: 'indiaman',
      upgrades: { sails: 3, hold: 2, hull: 1 },
    };
    setup.looks.indiaman = { sailColour: colour };
    startFreeSession(world, first, setup, FREE_RULES);
    const { captain } = world.trade;
    expect(captain.activeShip).toBe('indiaman');
    expect(captain.ships).toEqual({ indiaman: { sails: 3, hold: 2, hull: 1 } });
    expect(captain.gold).toBe(0);
    expect(Object.values(captain.cargo).every((n) => n === 0)).toBe(true);
    expect(world.trade.dockedAt).toBeNull();
    expect(shipLook(captain, 'indiaman').sailColour).toBe(colour);
    expect([world.boat.x, world.boat.y]).toEqual([first.place.x, first.place.y]);
    expect(world.ship.id).toBe('indiaman');
  });

  it('a restart never turns the clock back', () => {
    const world = createWorld(GAME_MAP, SLOOP);
    startFreeSession(world, second, setupFor(second), FREE_RULES);
    world.time += 3 * TUNING.weather.daylight.daySeconds;
    const sailed = world.time;
    startFreeSession(world, first, setupFor(first), FREE_RULES);
    expect(world.time).toBeGreaterThanOrEqual(sailed);
  });

  it('opens every cosmetic to try', () => {
    const progress = everythingUnlocked(CAT);
    for (const item of CAT.items) expect(isUnlocked(item, progress)).toBe(true);
  });

  it('a whole session writes nothing to the voyage storage', () => {
    // A voyage under way, saved in the browser.
    const browser = browserStub();
    const voyage = createWorld(GAME_MAP, SLOOP);
    voyage.trade.captain.gold = 4321;
    saveGame(browser.storage, voyage);
    const saved = browser.storage.getItem(SAVE_KEY);
    browser.writes.length = 0;
    // The session page: its own world on memory storage, as main.ts builds it for `?free`.
    const memory = memoryStorage();
    const world = createWorld(GAME_MAP, SLOOP);
    expect(loadGame(memory, world)).toBe(false);
    const setup = setupFor(first);
    startFreeSession(world, first, setup, FREE_RULES);
    saveGame(memory, world);
    expect(
      setShipLook(setup, CAT, setup.ship, { ...shipLook(setup, setup.ship) }, () => true),
    ).toBe(true);
    startFreeSession(world, second, { ...setupFor(second, setup.looks) }, FREE_RULES);
    world.trade.captain.gold = 50;
    saveGame(memory, world);
    clearSave(memory);
    expect(browser.writes).toEqual([]);
    expect(browser.storage.getItem(SAVE_KEY)).toBe(saved);
    // Back on the voyage page: the voyage loads as it was.
    const back = createWorld(GAME_MAP, SLOOP);
    expect(loadGame(browser.storage, back)).toBe(true);
    expect(back.trade.captain.gold).toBe(4321);
  });

  describe('preset edits (editor page and npm run free)', () => {
    it('writes the shipped files back unchanged', () => {
      for (const { path, text } of presetFiles(shippedFreeDoc()))
        expect(text).toBe(readFileSync(`src/data/free-sailing/${path}`, 'utf8'));
    });

    it('sets typed fields, refuses unknown ones and non-numbers', () => {
      const doc = shippedFreeDoc();
      expect(setPresetField(doc, first.id, 'hour', '10.5')).toBeNull();
      expect(doc.presets.find((p) => p.id === first.id)!.hour).toBe(10.5);
      expect(setPresetField(doc, first.id, 'ship.class', 'cutter')).toBeNull();
      expect(setPresetField(doc, first.id, 'place.x', 'east')).toMatch(/number/);
      expect(setPresetField(doc, first.id, 'colour', 'red')).toMatch(/unknown field/);
      expect(setPresetField(doc, 'nowhere', 'hour', '9')).toMatch(/no preset/);
    });

    it('adds a copy, refuses a taken id, removes', () => {
      const doc = shippedFreeDoc();
      const made = addPreset(doc, 'copy', second.id);
      expect(typeof made).toBe('object');
      expect(addPreset(doc, 'copy')).toMatch(/already exists/);
      // A copy starts where its source does: the checks accept it as it is.
      expect(freeProblems(doc)).toEqual([]);
      expect(removePreset(doc, 'copy')).toBe(true);
      expect(removePreset(doc, 'copy')).toBe(false);
    });

    it('catches a start on land, in a harbour or in a missing weather', () => {
      const doc = shippedFreeDoc();
      const island = GAME_MAP.islands[0]!;
      setPresetField(doc, first.id, 'place.x', String(island.x));
      setPresetField(doc, first.id, 'place.y', String(island.y));
      setPresetField(doc, first.id, 'weather', 'fog');
      setPresetField(doc, first.id, 'ship.sails', '4');
      const problems = freeProblems(doc).join('\n');
      expect(problems).toMatch(/land or shallows/);
      expect(problems).toMatch(/weather "fog"/);
      expect(problems).toMatch(/ship.sails must be 1 to 3/);
    });
  });
});
