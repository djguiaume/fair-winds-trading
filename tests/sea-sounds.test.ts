import { describe, expect, it } from 'vitest';
import { AUDIO, EFFECTS, MUSIC, RING, SEA_BEDS, THEMES, audioProblems } from '../src/audio/catalog';
import {
  CallClock,
  calmAt,
  callLevel,
  layerMix,
  seaIdAt,
  type PlaceDistances,
} from '../src/audio/seaBed';
import { SYNTHS } from '../src/audio/sfx';
import { SEA_FILES } from '../src/data/grownMap';
import { createRng } from '../src/sim/rng';
import { checkStepEffects } from '../src/sim/stepEffects';

// Decision 0209: the sounds of the sea, as data.
const here = { windKn: 12, speedKn: 5, luffing: false, rain: 0, docked: false, calm: 1 };
const nowhere: PlaceDistances = {
  island: () => Infinity,
  bergs: Infinity,
  vents: Infinity,
  reefs: Infinity,
  storm: false,
  raining: false,
};

describe('sounds of the sea (decision 0209)', () => {
  it('gives every sea a bed, a theme and calls that exist', () => {
    expect(audioProblems()).toEqual([]);
    for (const sea of [RING, ...Object.keys(SEA_FILES)]) {
      const bed = SEA_BEDS[sea]!;
      expect(bed, sea).toBeDefined();
      const track = MUSIC[bed.music ?? 'sea']!;
      expect('theme' in track && THEMES[track.theme], sea).toBeTruthy();
    }
    expect(MUSIC.regatta).toBeDefined();
    for (const id of ['bell', 'flap', 'thud', 'race-horn', 'gun'])
      expect(EFFECTS[id], id).toBeDefined();
    for (const e of Object.values(EFFECTS))
      if ('synth' in e) expect(SYNTHS[e.synth], e.synth).toBeTypeOf('function');
  });

  it('names the sea a point is in: the ring in the middle, each sector outside', () => {
    expect(seaIdAt(0, 0)).toBe(RING);
    expect(seaIdAt(0, 700)).toBe('north');
    expect(seaIdAt(700, 0)).toBe('east');
    expect(seaIdAt(0, -700)).toBe('south');
    expect(seaIdAt(-700, 0)).toBe('west');
  });

  it('mixes the layers from the wind, her speed, luffing, rain and the dock', () => {
    const bed = SEA_BEDS.north!;
    const calm = layerMix(bed, AUDIO.boat, { ...here, windKn: 4 });
    const gale = layerMix(bed, AUDIO.boat, { ...here, windKn: 25 });
    expect(gale.wind).toBeGreaterThan(calm.wind);
    expect(gale.windTone).toBeGreaterThan(calm.windTone);
    expect(gale.waves).toBeGreaterThan(calm.waves);
    expect(calm.luff).toBe(0);
    expect(layerMix(bed, AUDIO.boat, { ...here, luffing: true }).luff).toBeGreaterThan(0);
    const docked = layerMix(bed, AUDIO.boat, { ...here, luffing: true, docked: true });
    expect(docked.luff).toBe(0);
    expect(docked.wash).toBe(0);
    expect(layerMix(bed, AUDIO.boat, { ...here, rain: 1 }).rain).toBe(AUDIO.boat.rain.level);
  });

  it('plays a call only near its place, louder when closer, and not near an "away" place', () => {
    const near = {
      effect: 'eider',
      every: [5, 10] as [number, number],
      near: { islands: ['rimewick'], range: 100 },
    };
    expect(callLevel(near, nowhere)).toBe(0);
    const close = callLevel(near, { ...nowhere, island: () => 0 });
    const far = callLevel(near, { ...nowhere, island: () => 90 });
    expect(close).toBe(1);
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThan(close);
    const away = {
      effect: 'far-foghorn',
      every: [5, 10] as [number, number],
      away: { islands: ['fogwatch'], range: 100 },
    };
    expect(callLevel(away, nowhere)).toBe(1);
    expect(callLevel(away, { ...nowhere, island: () => 50 })).toBe(0);
    const storm = { effect: 'thunder', every: [5, 10] as [number, number], when: 'storm' as const };
    expect(callLevel(storm, nowhere)).toBe(0);
    expect(callLevel(storm, { ...nowhere, storm: true })).toBe(1);
  });

  it('times calls between their waits, and only while they may sound', () => {
    const bed = {
      ...SEA_BEDS[RING]!,
      calls: [{ effect: 'gull', every: [10, 20] as [number, number] }],
    };
    const clock = new CallClock(createRng(1));
    const times: number[] = [];
    for (let t = 0; t < 600; t += 0.25)
      if (clock.step(0.25, RING, bed, nowhere).length) times.push(t);
    expect(times.length).toBeGreaterThan(600 / 20 - 3);
    expect(times.length).toBeLessThan(600 / 10 + 3);
    for (let i = 1; i < times.length; i++)
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(9.75);
    const shy = { ...bed, calls: [{ ...bed.calls[0]!, near: { bergs: true, range: 50 } }] };
    const quiet = new CallClock(createRng(1));
    for (let t = 0; t < 120; t += 0.25) expect(quiet.step(0.25, RING, shy, nowhere)).toEqual([]);
  });

  it("keeps Sunreach's lagoon calmer than the open south sea", () => {
    const bed = SEA_BEDS.south!;
    const sunreach = SEA_FILES.south!.islands.find((i) => i.id === 'sunreach')!;
    expect(calmAt(bed, [sunreach], sunreach.x, sunreach.y)).toBeLessThan(1);
    expect(calmAt(bed, [sunreach], sunreach.x + sunreach.radius * 3, sunreach.y)).toBe(1);
  });

  it('rings a bell pitched for every port and outposts higher than towns', () => {
    const pitch = AUDIO.events.dock.pitch!;
    expect(pitch.skerry).toBeGreaterThan(pitch['palm-key']!);
    expect(pitch['palm-key']).toBeGreaterThan(pitch.sunreach!);
  });

  it('lets a quest step hold a music track, and checks it', () => {
    expect(checkStepEffects({ music: 'regatta' }, 'step')).toEqual([]);
    expect(checkStepEffects({ music: 'nope' }, 'step')).toEqual([
      'step › music: no track "nope" in audio.json',
    ]);
  });

  it('finds what is wrong in an edited sound list', () => {
    const bad = structuredClone(AUDIO);
    bad.seas.north!.calls!.push({ effect: 'walrus', every: [5, 2] });
    delete (bad.seas as Record<string, unknown>).east;
    bad.effects.gull = { synth: 'gull', pitch: 9 };
    const problems = audioProblems(undefined, bad);
    expect(problems).toContain('sea north call 6: no effect "walrus"');
    expect(problems).toContain('sea north call 6: every [min, max] seconds, min 1 or more');
    expect(problems).toContain('seas: no bed for sea "east"');
    expect(problems).toContain('effect gull: pitch from 0.25 to 4');
  });
});
