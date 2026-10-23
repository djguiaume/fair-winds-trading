// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { formatJson } from '../src/data/jsonFormat';
import { PHASE1_MAP } from '../src/data/maps';
import { SHIPPED_TUNING, TUNING, resetTuning } from '../src/data/tuning';
import { TUNING_GROUPS, TUNING_META, metaPath } from '../src/data/tuning-meta';
import {
  TUNE_KEY,
  applyChanges,
  changedFiles,
  currentChanges,
  decodeTuneCode,
  encodeTuneCode,
  loadTuneChanges,
  saveTuneChanges,
  setTuneValue,
  snapToMeta,
  tuneLeaves,
  tuneLink,
} from '../src/data/tuningEdits';
import { SLOOP } from '../src/sim/ship';
import { DEFAULT_WEATHER, weatherSlot } from '../src/sim/wind';
import { createWorld } from '../src/sim/world';
import { TunePanel } from '../src/tune/tunePanel';

/*
 * The `?tune` panel (decision 0114): edit sets, live edits, exported files, share codes, and the
 * panel itself built from the meta file. The balance simulation it runs is covered by
 * economy-balance and difficulty-balance, which use the same code.
 */

afterEach(() => {
  applyChanges({});
  resetTuning();
  document.body.replaceChildren();
  localStorage.clear();
});

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

describe('exported files', () => {
  it('are written exactly as the repository formats them', () => {
    for (const dir of ['tuning', 'ships']) {
      const root = `src/data/${dir}/`;
      for (const f of readdirSync(root).filter((f) => f.endsWith('.json'))) {
        const text = readFileSync(root + f, 'utf8');
        expect(formatJson(JSON.parse(text)), f).toBe(text);
      }
    }
  });

  it('change only the edited lines of a ship file, sailing and unlock alike', () => {
    setTuneValue(['ships', 'cutter', 'speedRatio'], 0.69);
    setTuneValue(['ships', 'cutter', 'price'], 1200);
    const files = changedFiles();
    expect(files.map((f) => f.path)).toEqual(['src/data/ships/cutter.json']);
    const before = readFileSync('src/data/ships/cutter.json', 'utf8').split('\n');
    const after = files[0]!.text.split('\n');
    expect(after).toHaveLength(before.length);
    const diff = after.filter((line, i) => line !== before[i]);
    expect(diff).toEqual(['    "price": 1200,', '    "speedRatio": 0.69,']);
  });

  it('rebuild a whole tuning file from the live values', () => {
    setTuneValue(['economy', 'market', 'elasticity'], 0.5);
    setTuneValue(['upgrades', 'effects', 'sailsSpeed'], [1, 1.2, 1.3]);
    const files = changedFiles();
    expect(files.map((f) => f.path)).toEqual([
      'src/data/tuning/upgrades.json',
      'src/data/tuning/economy.json',
    ]);
    expect(JSON.parse(files[1]!.text)).toEqual(TUNING.economy);
    expect(JSON.parse(files[0]!.text).effects.sailsSpeed).toEqual([1, 1.2, 1.3]);
  });
});

describe('edit sets', () => {
  it('change live values in place, arrays too', () => {
    const polar = TUNING.ships.cutter!.polar;
    const next = polar.map(([a, f]) => [a, Math.min(1, f + 0.05)]);
    expect(setTuneValue(['ships', 'cutter', 'polar'], next)).toBe(true);
    expect(TUNING.ships.cutter!.polar).toBe(polar);
    expect(polar).toEqual(next);
    expect(SHIPPED_TUNING.ships.cutter!.polar).not.toEqual(next);
  });

  it('refuse unknown paths and values of another shape', () => {
    expect(setTuneValue(['ships', 'cutter', 'nope'], 1)).toBe(false);
    expect(setTuneValue(['ships', 'cutter', 'speedRatio'], '1')).toBe(false);
    expect(setTuneValue(['ships', 'cutter', 'speedRatio'], NaN)).toBe(false);
    expect(setTuneValue(['ships', 'cutter', 'upgradePrices'], [1])).toBe(false);
    expect(setTuneValue(['ships', 'cutter'], {})).toBe(false);
    expect(currentChanges()).toEqual({});
  });

  it('list only what differs and apply back onto the shipped values', () => {
    setTuneValue(['ships', 'cutter', 'speedRatio'], 0.69);
    setTuneValue(['difficulty', 'levels', 'fair', 'steadyWind'], false);
    const changes = currentChanges();
    expect(changes).toEqual({
      'ships.cutter.speedRatio': 0.69,
      'difficulty.levels.fair.steadyWind': false,
    });
    resetTuning();
    expect(applyChanges({ ...changes, 'ships.galleon.price': 5 })).toEqual({
      applied: 2,
      skipped: ['ships.galleon.price'],
    });
    expect(currentChanges()).toEqual(changes);
    expect(applyChanges({}).applied).toBe(0);
    expect(TUNING).toEqual(SHIPPED_TUNING);
  });

  it('are kept in the browser and dropped when empty', () => {
    const storage = memory();
    saveTuneChanges(storage, { 'ships.cutter.price': 1200 });
    expect(loadTuneChanges(storage)).toEqual({ 'ships.cutter.price': 1200 });
    saveTuneChanges(storage, {});
    expect(storage.getItem(TUNE_KEY)).toBeNull();
    storage.setItem(TUNE_KEY, 'not json');
    expect(loadTuneChanges(storage)).toEqual({});
  });

  it('travel in a share link', () => {
    const changes = { 'ships.cutter.price': 1200, 'upgrades.effects.sailsSpeed': [1, 1.2, 1.3] };
    const link = tuneLink('https://example.org/game/?debug#voyage=FW1x', changes);
    expect(link.startsWith('https://example.org/game/?tune#tune=FT1')).toBe(true);
    expect(decodeTuneCode(link)).toEqual(changes);
    expect(decodeTuneCode(encodeTuneCode(changes))).toEqual(changes);
    expect(decodeTuneCode('FT1garbage')).toBeNull();
    expect(decodeTuneCode('https://example.org/#voyage=FW1abc')).toBeNull();
  });

  it('snap typed numbers into range and onto the step, as the tuning tests require', () => {
    const meta = { min: 0.2, max: 1.5, step: 0.005 };
    expect(snapToMeta(meta, 0.6912)).toBe(0.69);
    expect(snapToMeta(meta, 9)).toBe(1.5);
    expect(snapToMeta(meta, 0)).toBe(0.2);
    expect(snapToMeta({ min: 0, max: 50000, step: 50 }, 1234)).toBe(1250);
  });

  it('reach the weather at once: its caches are dropped on an edit', () => {
    const before = weatherSlot(DEFAULT_WEATHER, 3, 40);
    setTuneValue(['weather', 'default', 'stepDeg'], TUNING.weather.default.stepDeg * 2);
    expect(weatherSlot(DEFAULT_WEATHER, 3, 40)).not.toEqual(before);
    applyChanges({});
    expect(weatherSlot(DEFAULT_WEATHER, 3, 40)).toEqual(before);
  });
});

describe('the panel', () => {
  const open = () =>
    new TunePanel({
      world: createWorld(PHASE1_MAP, SLOOP),
      storage: memory(),
      gameUrl: () => 'https://example.org/game/',
      newVoyage: () => {},
    });
  const tab = (group: string) =>
    document.querySelector<HTMLButtonElement>(`.tune-tab[data-group="${group}"]`)!.click();

  it('has a tab per tuning file and a slider for every number it shows', () => {
    open();
    for (const group of Object.keys(TUNING_GROUPS)) {
      tab(group);
      const rows = document.querySelectorAll('.tune-row');
      expect(rows.length, group).toBeGreaterThan(0);
      for (const row of rows) expect(row.querySelector('.tune-range, .tune-check')).not.toBeNull();
    }
  });

  it('shows every value of the picked item', () => {
    open();
    tab('ships');
    const leaves = tuneLeaves(TUNING.ships.sloop, ['ships', 'sloop']);
    let expected = 0;
    for (const { path, value } of leaves) {
      const meta = TUNING_META[metaPath(path)];
      if (meta?.kind === 'number') expected += Array.isArray(value) ? value.length : 1;
      if (meta?.kind === 'toggle') expected++;
    }
    expect(document.querySelectorAll('.tune-row')).toHaveLength(expected);
    expect(document.querySelectorAll('.tune-polar .tune-hit')).toHaveLength(
      TUNING.ships.sloop!.polar.length,
    );
  });

  it('applies a slider live, outlines the row and resets it', () => {
    open();
    tab('ships');
    const row = [...document.querySelectorAll<HTMLElement>('.tune-row')].find((r) =>
      r.textContent!.startsWith('Speed ratio'),
    )!;
    const range = row.querySelector<HTMLInputElement>('.tune-range')!;
    range.value = '0.7';
    range.dispatchEvent(new Event('input'));
    expect(TUNING.ships.sloop!.speedRatio).toBe(0.7);
    expect(row.classList.contains('tune-changed')).toBe(true);
    expect(document.querySelector('.tune-count')!.textContent).toBe('1 change');
    row.querySelector<HTMLButtonElement>('.tune-reset')!.click();
    expect(TUNING.ships.sloop!.speedRatio).toBe(SHIPPED_TUNING.ships.sloop!.speedRatio);
    expect(row.classList.contains('tune-changed')).toBe(false);
  });

  it('sails the picked ship', () => {
    const panel = open();
    expect(panel).toBeDefined();
    const select = document.querySelector<HTMLSelectElement>('.tune-select')!;
    select.value = 'fluyt';
    select.dispatchEvent(new Event('change'));
    document.querySelector<HTMLButtonElement>('.tune-sail')!.click();
    const world = (panel as unknown as { host: { world: ReturnType<typeof createWorld> } }).host
      .world;
    expect(world.trade.captain.activeShip).toBe('fluyt');
    expect(world.ship.id).toBe('fluyt');
  });
});
