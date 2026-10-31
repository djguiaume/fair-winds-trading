import { readFileSync, readdirSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_MAP } from '../src/data/maps';
import { oceanControls, setOceanControls } from '../src/data/oceanControls';
import { TUNING } from '../src/data/tuning';
import { applyChanges } from '../src/data/tuningEdits';
import { OCEAN_SIZE } from '../src/render/ocean';
import { QUALITY, QUALITY_LEVELS } from '../src/render/quality';
import { SeaMotion } from '../src/render/seaMotion';
import { SeaWaves, gerstnerUniforms, wavesForced } from '../src/render/seaWaves';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';
import { loadSettings } from '../src/ui/settings';

/** A sea at the start of the voyage, a stormy hour in. */
function seaAt(time: number) {
  const world = createWorld(GAME_MAP, SLOOP);
  world.time = time;
  return { world, sea: new SeaWaves(() => world, '') };
}

const POINTS = [
  [0, 0],
  [37, -120],
  [-260, 45],
] as const;

const heights = (sea: SeaWaves) => POINTS.map(([x, z]) => sea.heightAt(x, z));

describe('the Waves switch (decision 0250)', () => {
  it('?waves holds it for tests and reviews; otherwise the Settings decide', () => {
    expect(wavesForced('')).toBeNull();
    expect(wavesForced('?waves=v1')).toBe(false);
    expect(wavesForced('?waves=v2')).toBe(true);
    expect(wavesForced('?waves=storm')).toBe(true);
    const { world } = seaAt(0);
    const free = new SeaWaves(() => world, '');
    expect(free.setOn(false)).toBe(true);
    expect(free.gerstner).toBe(false);
    expect(free.setOn(false)).toBe(false);
    const held = new SeaWaves(() => world, '?waves=v1');
    held.setOn(true);
    expect(held.gerstner).toBe(false);
  });

  it('is off by default on Ultra-low and Low only', () => {
    const on = QUALITY_LEVELS.filter((level) => QUALITY[level].waves);
    expect(on).toEqual(['medium', 'high', 'ultra']);
  });
});

describe('the wave field everything floats on (issue #286)', () => {
  it('is the same on every quality level: drawing never changes it', () => {
    const { sea } = seaAt(3600);
    const before = heights(sea);
    const amp = [...sea.field.amp];
    for (const level of QUALITY_LEVELS) {
      const cell = OCEAN_SIZE / QUALITY[level].oceanSegments;
      sea.writeUniforms(gerstnerUniforms(), cell, QUALITY[level].fancyWater);
    }
    expect([...sea.field.amp]).toEqual(amp);
    expect(heights(sea)).toEqual(before);
  });

  it('is the same at any frame rate: a pure function of the world time', () => {
    const end = 3600;
    const direct = seaAt(end);
    const expected = heights(direct.sea);
    for (const fps of [20, 30, 60, 144]) {
      const { world, sea } = seaAt(end - 2);
      for (let t = end - 2; t < end; t += 1 / fps) {
        world.time = t;
        heights(sea);
      }
      world.time = end;
      expect(heights(sea)).toEqual(expected);
    }
  });
});

describe('sailing never reads the ocean switches', () => {
  it('no simulation file imports the waves, the motion or the Settings', () => {
    const files = readdirSync('src/sim').filter((f) => f.endsWith('.ts'));
    for (const file of files) {
      const text = readFileSync(`src/sim/${file}`, 'utf8');
      expect(text, file).not.toMatch(/from '\.\.\/(render|ui)\/|waves\.motion/);
    }
  });
});

describe('gentle motion and the riding camera', () => {
  it('the camera stays put until the player turns the bob on, then eases with the sea', () => {
    const motion = new SeaMotion();
    for (let i = 0; i < 60; i++) expect(motion.cameraRise(1 / 60, 2)).toBe(0);
    motion.cameraBob = true;
    let rise = 0;
    for (let i = 0; i < 600; i++) rise = motion.cameraRise(1 / 60, 2);
    expect(rise).toBeCloseTo(2 * TUNING.waves.motion.cameraBob, 2);
  });
});

describe('Settings', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stored = (value: object | null) =>
    vi.stubGlobal('localStorage', {
      getItem: () => (value ? JSON.stringify(value) : null),
      setItem: () => {},
    });
  const reduced = (on: boolean) => vi.stubGlobal('matchMedia', () => ({ matches: on }));

  it('Waves follows the level until the player picks', () => {
    stored(null);
    expect(loadSettings().waves).toBeNull();
    stored({ waves: 'yes' });
    expect(loadSettings().waves).toBeNull();
    stored({ waves: false });
    expect(loadSettings().waves).toBe(false);
  });

  it('gentle motion follows the device until the player picks; the camera bob starts off', () => {
    reduced(true);
    stored(null);
    expect(loadSettings().gentleMotion).toBe(true);
    expect(loadSettings().cameraBob).toBe(false);
    stored({ gentleMotion: false });
    expect(loadSettings().gentleMotion).toBe(false);
    reduced(false);
    stored(null);
    expect(loadSettings().gentleMotion).toBe(false);
  });
});

describe('npm run sea -- waves (the ?tune panel edits)', () => {
  afterEach(() => applyChanges({}));

  it('lists every control by what it changes', () => {
    const rows = oceanControls();
    const effect = (path: string) => rows.find((r) => r.path === path)?.effect;
    expect(effect('waves.bands.swell.max')).toBe('sea');
    expect(effect('waves.look.shading')).toBe('drawing');
    expect(effect('waves.motion.gentle')).toBe('comfort');
    expect(effect('graphics.quality.low.waves')).toBe('level');
    expect(effect('waves.previews.storm.speedKn')).toBe('review');
    expect(rows.some((r) => r.path.startsWith('graphics.quality.low.shadows'))).toBe(false);
  });

  it('sets values inside their slider and writes the files the panel exports', () => {
    const files = setOceanControls([
      'waves.motion.gentle=0.333',
      'graphics.quality.low.waves=true',
    ]);
    expect(TUNING.waves.motion.gentle).toBe(0.35);
    expect(TUNING.graphics.quality.low.waves).toBe(true);
    expect(files.map((f) => f.path).sort()).toEqual([
      'src/data/tuning/graphics.json',
      'src/data/tuning/waves.json',
    ]);
    expect(() => setOceanControls(['economy.startGold=5'])).toThrow(/not an ocean control/);
    expect(() => setOceanControls(['waves.motion.gentle=yes'])).toThrow(/does not fit/);
  });
});
