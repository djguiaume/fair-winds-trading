import { afterEach, describe, expect, it } from 'vitest';
import { composeTune } from '../src/audio/composer';
import { PHASE1_MAP } from '../src/data/maps';
import { resetTuning } from '../src/data/tuning';
import { setLanguage, t } from '../src/i18n';
import { DEFAULT_WEATHER } from '../src/sim/wind';
import { DIFFICULTIES, easier, isDifficulty, knobs, weatherFor } from '../src/sim/difficulty';
import { GOODS, type GoodId } from '../src/sim/goods';
import { createRng } from '../src/sim/rng';
import { SLOOP } from '../src/sim/ship';
import { Tutorial } from '../src/sim/tutorial';
import { createWorld } from '../src/sim/world';

/*
 * Decision 0111 moved the town levels, the difficulty list, the tutorial steps and the music theme
 * to data files. These hashes were taken from the code before the move: the same seeds must still
 * give the same tunes, the same random tutorial sessions the same lessons, and every level the
 * same knobs and weather. When one of them changes on purpose (a new tune, a new lesson), update
 * its hash in the same pull request and say why.
 */

afterEach(() => {
  resetTuning();
  setLanguage('en');
});

/** FNV-1a over a string, as 8 hex digits. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The knobs a level had before 0111 (the file now also holds its name and card look). */
const KNOBS = [
  'cargoLost',
  'damage',
  'repairCost',
  'spread',
  'orderFactor',
  'startGold',
  'growth',
  'galeWeight',
  'stormEverySec',
  'steadyWind',
] as const;
const knobOnly = (k: object) =>
  Object.fromEntries(KNOBS.map((key) => [key, (k as Record<string, unknown>)[key]]));

describe('plays the same after moving levels, tutorial and music to data (decision 0111)', () => {
  it('composes the same tunes', () => {
    const tunes = Array.from({ length: 200 }, (_, seed) => JSON.stringify(composeTune(seed)));
    expect(hash(tunes.join('\n'))).toBe('8ce0a781');
  });

  it('keeps the difficulty levels, their order, knobs and weather', () => {
    const out: unknown[] = [[...DIFFICULTIES]];
    for (const a of DIFFICULTIES) {
      out.push(a, knobOnly(knobs(a)), isDifficulty(a), t(`level.${a}` as never));
      for (const b of DIFFICULTIES) out.push(easier(a, b));
      for (const steady of [false, true]) out.push(weatherFor(DEFAULT_WEATHER, a, steady));
    }
    out.push(knobOnly(knobs(undefined)), knobOnly(knobs('nope' as never)), isDifficulty('nope'));
    expect(hash(JSON.stringify(out))).toBe('0f2e6bfa');
  });

  it('keeps the town level names', () => {
    const names = () => [1, 2, 3, 4].map((l) => t(`settlement.level.${l}` as never));
    expect(names()).toEqual(['Hamlet', 'Village', 'Town', 'Port town']);
    setLanguage('fr');
    expect(names()).toEqual(['Hameau', 'Village', 'Bourg', 'Ville portuaire']);
  });

  it('runs random tutorial sessions through the same lessons', () => {
    const lines: string[] = [];
    for (let run = 0; run < 300; run++) lines.push(...tutorialSession(run));
    expect(lines.length).toBeGreaterThan(60000);
    expect(hash(lines.join('\n'))).toBe('2dd26af3');
  });
});

/** A random player poking at the tutorial: every call it reacts to, in random order. */
function tutorialSession(seed: number): string[] {
  const rng = createRng(1000 + seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => void values.set(k, v),
    removeItem: (k: string) => void values.delete(k),
  };
  const world = createWorld(PHASE1_MAP, SLOOP);
  const harbours = Object.fromEntries(
    PHASE1_MAP.ports.map((p) => {
      const i = PHASE1_MAP.islands.find((i) => i.id === p.islandId)!;
      return [p.id, { x: i.x + i.radius + 5, y: i.y }];
    }),
  );
  const ports = PHASE1_MAP.ports.map((p) => p.id);
  let tutorial = new Tutorial(world, harbours, storage, rng() < 0.5);
  const out: string[] = [];
  const snap = (what: string) => {
    const l = tutorial.isActive || tutorial.status === 'completed' ? tutorial.lesson : null;
    out.push(
      JSON.stringify([
        what,
        tutorial.status,
        tutorial.step,
        tutorial.origin,
        tutorial.delivery,
        tutorial.good,
        tutorial.pointerPort,
        tutorial.pointerGood,
        tutorial.finishedNotice,
        l,
        world.destination?.portId ?? null,
        world.stormHolds,
      ]),
    );
  };
  // The ports the lesson is about, so a random player often does the right thing.
  const lessonPorts = () =>
    [tutorial.origin, tutorial.delivery, tutorial.pointerPort].filter((p): p is string => !!p);
  const cargoGood = (): GoodId | null =>
    GOODS.find((g) => world.trade.captain.cargo[g] > 0) ?? null;
  for (let i = 0; i < 220; i++) {
    const r = rng();
    let what: string;
    if (r < 0.015 || (r < 0.08 && !tutorial.isActive)) {
      tutorial.start();
      what = 'start';
    } else if (r < 0.018) {
      tutorial.skip();
      what = 'skip';
    } else if (r < 0.07) {
      const resumed = rng() < 0.7;
      tutorial = new Tutorial(world, harbours, storage, resumed);
      tutorial.resume();
      what = `reload ${resumed}`;
    } else if (r < 0.12) {
      tutorial.chartOpened();
      what = 'chart';
    } else if (r < 0.24) {
      if (rng() < 0.2) world.destination = null;
      else {
        const id = rng() < 0.05 ? 'nowhere' : pick([...ports, ...lessonPorts()]);
        world.destination = { portId: id, label: id, x: 0, y: 0 };
      }
      tutorial.destinationSelected();
      what = `pick ${world.destination?.portId ?? '-'}`;
    } else if (r < 0.32) {
      tutorial.continueLesson();
      what = 'continue';
    } else if (r < 0.44) {
      world.trade.dockedAt =
        rng() < 0.3 ? null : pick([...ports, ...lessonPorts(), ...lessonPorts()]);
      tutorial.observe();
      what = `dock ${world.trade.dockedAt}`;
    } else if (r < 0.62) {
      world.boat.speedKn = rng() * 3;
      const controls = { steer: rng() * 2 - 1, sailStep: Math.floor(rng() * 4) };
      tutorial.observe(controls, rng() * 0.5);
      what = `sail ${controls.sailStep}`;
    } else if (r < 0.76) {
      const good = pick(GOODS);
      world.trade.captain.cargo[good] += 1 + Math.floor(rng() * 3);
      const told = rng() < 0.9 ? good : null;
      tutorial.traded('buy', told);
      what = `buy ${told}`;
    } else if (r < 0.9) {
      const good = rng() < 0.7 ? (cargoGood() ?? pick(GOODS)) : pick(GOODS);
      world.trade.captain.cargo[good] =
        rng() < 0.6 ? 0 : Math.max(0, world.trade.captain.cargo[good] - 1);
      const told = rng() < 0.85 ? good : null;
      tutorial.traded('sell', told);
      what = `sell ${told}`;
    } else if (r < 0.95) {
      tutorial.resume();
      what = 'resume';
    } else {
      tutorial.dismissFinished();
      what = 'dismiss';
    }
    snap(what);
  }
  return out;
}
