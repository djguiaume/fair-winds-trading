import { afterEach, describe, expect, it } from 'vitest';
import { composeTune } from '../src/audio/composer';
import { PHASE1_MAP } from '../src/data/maps';
import { resetTuning } from '../src/data/tuning';
import { setLanguage, t } from '../src/i18n';
import { DEFAULT_WEATHER } from '../src/sim/wind';
import { DIFFICULTIES, easier, isDifficulty, knobs, weatherFor } from '../src/sim/difficulty';
import { GOODS as ALL_GOODS, type GoodId, isFar } from '../src/sim/goods';

// The far goods (decision 0146) came after this check and trade nowhere on the ring: the random
// player picks from the goods it picked from before.
const GOODS = ALL_GOODS.filter((g) => !isFar(g));
import { createRng } from '../src/sim/rng';
import { SLOOP } from '../src/sim/ship';
import { pointOf, type Screen } from '../src/sim/questLibrary';
import { QUESTS, QuestBook, readQuests } from '../src/sim/quests';
import { createWorld } from '../src/sim/world';
import { lessonFor } from '../src/ui/questView';

const TUTORIAL = 'first-voyage';

/*
 * Decision 0113 moved the town levels, the difficulty list, the tutorial steps and the music theme
 * to data files. These hashes were taken from the code before the move: the same seeds must still
 * give the same tunes, the same random tutorial sessions the same lessons, and every level the
 * same knobs and weather. When one of them changes on purpose (a new tune, a new lesson), update
 * its hash in the same pull request and say why.
 *
 * Retaken on purpose by decision 0127: the tutorial became the prologue rescue (new lessons at sea
 * before the chart, Rook taken home to Saltmere), so the random sessions now walk new lessons.
 * Retaken again by decision 0139: coming alongside the wreck counts from 20 units instead of 16 and
 * not while grinding on the reef, and the sails lesson's text changed (raise, then steer).
 * Retaken by decision 0151: the tutorial is an ordinary quest, so the random player now moves the
 * voyage (course, dock, cargo, chart open, helm) and the quest book watches it; the session also
 * saves and loads the lesson with the voyage.
 * Retaken by decision 0159: Rook's island lesson names Skerry and where it lies.
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

/** The knobs a level had before 0113 (the file now also holds its name and card look). */
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

describe('plays the same after moving levels, tutorial and music to data (decision 0113)', () => {
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
    // Updated once for decision 0115: storms' `areaRadius` became `areaShare` and `perRadius`.
    expect(hash(JSON.stringify(out))).toBe('69017f9c');
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
    expect(hash(lines.join('\n'))).toBe('b4584ee2');
  });
});

/** A random player poking at the tutorial: every move it reacts to, in random order. */
function tutorialSession(seed: number): string[] {
  const rng = createRng(1000 + seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;
  const world = createWorld(PHASE1_MAP, SLOOP);
  const harbours = Object.fromEntries(
    PHASE1_MAP.ports.map((p) => {
      const i = PHASE1_MAP.islands.find((i) => i.id === p.islandId)!;
      return [p.id, { x: i.x + i.radius + 5, y: i.y }];
    }),
  );
  const ports = PHASE1_MAP.ports.map((p) => p.id);
  let screen: Screen = 'sea';
  const bookFor = () => new QuestBook(world, QUESTS, { nightOk: () => true, screen: () => screen });
  let quests = bookFor();
  const wreck = pointOf(PHASE1_MAP, 'wreck');
  const out: string[] = [];
  const snap = (what: string) => {
    const p = quests.progress(TUTORIAL);
    out.push(
      JSON.stringify([
        what,
        p?.step ?? null,
        p?.vars ?? null,
        lessonFor(quests, harbours),
        world.destination?.portId ?? null,
        quests.holdsStorms,
        quests.tracked ?? null,
      ]),
    );
  };
  // The ports the lesson is about, so a random player often does the right thing.
  const lessonPorts = () =>
    [
      ...Object.values(quests.progress(TUTORIAL)?.vars ?? {}),
      lessonFor(quests, harbours)?.port,
    ].filter((p): p is string => !!p && ports.includes(p));
  const cargoGood = (): GoodId | null =>
    GOODS.find((g) => world.trade.captain.cargo[g] > 0) ?? null;
  for (let i = 0; i < 220; i++) {
    const r = rng();
    let what: string;
    if (r < 0.015 || (r < 0.08 && !quests.isRunning(TUTORIAL))) {
      quests.ask(TUTORIAL);
      what = 'start';
    } else if (r < 0.018) {
      quests.drop(TUTORIAL);
      what = 'skip';
    } else if (r < 0.07) {
      // Saved and loaded: the lesson is part of the voyage.
      world.trade.quests = readQuests(JSON.parse(JSON.stringify(world.trade.quests)), world.map);
      quests = bookFor();
      quests.check();
      what = 'reload';
    } else if (r < 0.12) {
      screen = screen === 'chart' ? 'sea' : 'chart';
      quests.check();
      what = `screen ${screen}`;
    } else if (r < 0.24) {
      if (rng() < 0.2) world.destination = null;
      else {
        const id = rng() < 0.05 ? 'nowhere' : pick([...ports, ...lessonPorts()]);
        world.destination = { portId: id, label: id, x: 0, y: 0 };
      }
      quests.check();
      what = `pick ${world.destination?.portId ?? '-'}`;
    } else if (r < 0.32) {
      quests.choose(TUTORIAL, 'continue');
      what = 'continue';
    } else if (r < 0.44) {
      world.trade.dockedAt =
        rng() < 0.3 ? null : pick([...ports, ...lessonPorts(), ...lessonPorts()]);
      quests.check();
      what = `dock ${world.trade.dockedAt}`;
    } else if (r < 0.62) {
      world.boat.speedKn = rng() * 3;
      // The prologue (decision 0127): often somewhere near the wreck.
      const nearWreck = wreck !== null && rng() < 0.4;
      if (nearWreck) {
        world.boat.x = wreck.x + rng() * 40;
        world.boat.y = wreck.y;
        world.boat.speedKn = rng() * 2.5;
      }
      const controls = { steer: rng() * 2 - 1, sailStep: Math.floor(rng() * 4) };
      const seconds = rng() * (nearWreck ? 4 : 0.5);
      for (let t = 0; t < seconds; t += 1 / 30) quests.update(1 / 30, controls);
      what = `sail ${controls.sailStep}`;
    } else if (r < 0.76) {
      const good = pick(GOODS);
      world.trade.captain.cargo[good] += 1 + Math.floor(rng() * 3);
      quests.check();
      what = `buy ${good}`;
    } else if (r < 0.9) {
      const good = rng() < 0.7 ? (cargoGood() ?? pick(GOODS)) : pick(GOODS);
      world.trade.captain.cargo[good] =
        rng() < 0.6 ? 0 : Math.max(0, world.trade.captain.cargo[good] - 1);
      quests.check();
      what = `sell ${good}`;
    } else {
      quests.check(rng());
      what = 'check';
    }
    snap(what);
  }
  return out;
}
