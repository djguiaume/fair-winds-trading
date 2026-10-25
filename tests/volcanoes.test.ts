import { describe, expect, it } from 'vitest';
import { PHASE1_SOURCE } from '../src/data/maps';
import { grownMap } from '../src/data/grownMap';
import { hasVolcano } from '../src/data/islands';
import { TUNING } from '../src/data/tuning';
import { buildIslands } from '../src/render/models';
import { Volcanoes, eruptionStrength } from '../src/render/volcanoes';
import { QUESTS, type QuestDef, QuestBook, checkQuests } from '../src/sim/quests';
import { SLOOP } from '../src/sim/ship';
import { createWorld } from '../src/sim/world';
import * as THREE from 'three';

// Decision 0178: volcano smoke, eruptions near the boat, and a quest's story eruption.
const MAP = grownMap(PHASE1_SOURCE);
const E = TUNING.weather.volcano.eruptions;

const quest = (reward: unknown): QuestDef =>
  ({
    id: 'test-erupt',
    name: 'Test: the mountain answers',
    start: { is: 'gold', atLeast: 0 },
    text: 'quest.test-erupt',
    steps: [{ id: 'rich', goal: { is: 'gold', atLeast: 1 } }],
    reward,
  }) as unknown as QuestDef;

describe('volcano smoke and eruptions (0178)', () => {
  it('finds The Smoulder’s crater in the islands it builds', () => {
    const smoulder = MAP.islands.find((i) => i.id === 'the-smoulder')!;
    expect(hasVolcano(smoulder)).toBe(true);
    const islands = buildIslands(MAP, { shadows: false });
    const crater = islands.craters.find((c) => c.island === 'the-smoulder')!;
    expect(crater).toBeDefined();
    // On the island, high up its cone, a flank that falls away.
    expect(Math.hypot(crater.x - smoulder.x, crater.z + smoulder.y)).toBeLessThan(smoulder.radius);
    expect(crater.y).toBeGreaterThan(20);
    expect(crater.slope).toBeGreaterThan(0.5);
    islands.dispose();
  });

  it('checks a reward’s eruptions and plays them when the quest is done', () => {
    expect(checkQuests([quest({ erupt: ['the-smoulder'] })], MAP)).toEqual([]);
    const bad = checkQuests([quest({ erupt: ['atlantis', 'emberhold-x', 'westholm'] })], MAP);
    expect(bad.join()).toContain('no island "atlantis"');
    expect(checkQuests([quest({ erupt: 'the-smoulder' })], MAP).join()).toContain(
      'needs a list of islands',
    );
    const notVolcano = MAP.islands.find((i) => !hasVolcano(i))!;
    expect(checkQuests([quest({ erupt: [notVolcano.id] })], MAP).join()).toContain(
      'has no volcano',
    );
    // The shipped story eruption: Bram's arc ends with it.
    const glass = QUESTS.find((q) => q.id === 'emberhold-glass')!;
    expect(glass.reward?.erupt).toEqual(['the-smoulder']);

    const world = createWorld(MAP, SLOOP);
    world.trade.captain.gold = 0;
    const book = new QuestBook(world, [quest({ erupt: ['the-smoulder'] })]);
    const seen: unknown[] = [];
    book.onEvent = (e) => seen.push(e);
    book.update(1);
    world.trade.captain.gold = 5;
    for (let i = 0; i < 5; i++) book.update(1);
    expect(seen).toContainEqual({ type: 'erupt', quest: 'test-erupt', island: 'the-smoulder' });
    // A quest test that skips past it does not erupt.
    const skipped: unknown[] = [];
    const test = new QuestBook(createWorld(MAP, SLOOP), [quest({ erupt: ['the-smoulder'] })]);
    test.onEvent = (e) => skipped.push(e);
    test.testStart('test-erupt', 'rich');
    expect(skipped.some((e) => (e as { type: string }).type === 'erupt')).toBe(false);
  });

  it('builds, holds and dies down', () => {
    expect(eruptionStrength({ elapsed: 0, hold: 10 })).toBe(0);
    expect(eruptionStrength({ elapsed: E.rampSec / 2, hold: 10 })).toBeCloseTo(0.5);
    expect(eruptionStrength({ elapsed: E.rampSec + 5, hold: 10 })).toBe(1);
    expect(eruptionStrength({ elapsed: E.rampSec + 10 + E.fadeSec / 2, hold: 10 })).toBeCloseTo(
      0.5,
    );
    expect(eruptionStrength({ elapsed: E.rampSec + 10 + E.fadeSec + 0.1, hold: 10 })).toBeNull();
  });

  const crater = { island: 'v', x: 0, y: 60, z: 0, r: 6, slope: 1.6 };
  const frame = (x: number, eruptions = true) => ({
    target: new THREE.Vector3(x, 0, 0),
    cameraY: 500,
    night: 0,
    eruptions,
    out: new Set<string>(),
    windX: 1,
    windZ: 0,
    windUnits: 4,
  });
  const run = (v: Volcanoes, sec: number, f: ReturnType<typeof frame>) => {
    let glow = 0;
    for (let t = 0; t < sec; t += 0.25) glow = Math.max(glow, v.update(0.25, f));
    return glow;
  };

  it('smokes always, erupts near the boat only with the switch on', () => {
    const v = new Volcanoes([crater]);
    // In sight, the plume is up at once; no eruption with the switch off.
    expect(run(v, E.firstSec + 30, frame(100, false))).toBe(0);
    const puffs = v.root.children[0] as THREE.InstancedMesh;
    expect(puffs.count).toBeGreaterThan(5);
    // Switch on and near: the first eruption after `firstSec`.
    expect(run(v, E.firstSec - 1, frame(100))).toBe(0);
    expect(run(v, 2 + E.rampSec, frame(100))).toBeGreaterThan(0.9);
    expect(v.erupting()).toEqual(['v']);
    // Far off: nothing drawn, no eruption.
    const far = new Volcanoes([crater]);
    expect(run(far, 600, frame(TUNING.weather.volcano.sightUnits + 10))).toBe(0);
    expect((far.root.children[0] as THREE.InstancedMesh).count).toBe(0);
    v.dispose();
    far.dispose();
    // A small vent only smokes.
    const vent = new Volcanoes([{ ...crater, r: E.minCrater - 1 }]);
    expect(run(vent, E.firstSec + E.everySec[1]! + 30, frame(100))).toBe(0);
    expect((vent.root.children[0] as THREE.InstancedMesh).count).toBeGreaterThan(0);
    vent.dispose();
  });

  it('keeps the smoke out of the camera', () => {
    const v = new Volcanoes([crater]);
    run(v, 20, { ...frame(50), cameraY: crater.y + 6 });
    const puffs = v.root.children[0] as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3(),
      q = new THREE.Quaternion(),
      s = new THREE.Vector3();
    for (let i = 0; i < puffs.count; i++) {
      puffs.getMatrixAt(i, m);
      m.decompose(p, q, s);
      s.x = Math.hypot(m.elements[0]!, m.elements[1]!, m.elements[2]!);
      if (s.x > 1e-3)
        expect(p.y + s.x).toBeLessThanOrEqual(
          crater.y + 6 - TUNING.weather.volcano.smoke.cameraGap + 0.01,
        );
    }
    v.dispose();
  });

  it('plays a story eruption whatever the switch says, once in sight', () => {
    const v = new Volcanoes([crater]);
    expect(v.erupt('nowhere')).toBe(false);
    expect(v.erupt('v')).toBe(true);
    const away = TUNING.weather.volcano.sightUnits + 50;
    run(v, 30, frame(away, false));
    expect(v.erupting()).toEqual([]);
    expect(run(v, E.rampSec + 1, frame(50, false))).toBeGreaterThan(0.9);
    // Lava bombs fly, in bursts.
    const bombs = v.root.children[1] as THREE.InstancedMesh;
    let most = 0;
    for (let t = 0; t < 10; t += 0.25) {
      v.update(0.25, frame(50, false));
      most = Math.max(most, bombs.count);
    }
    expect(most).toBeGreaterThanOrEqual(E.bombBurst[0]!);
    // It holds longer than an everyday one, then dies down.
    run(v, E.storyHoldSec + E.fadeSec + 1, frame(50, false));
    expect(v.erupting()).toEqual([]);
    // One that waits too long is dropped.
    v.erupt('v');
    run(v, E.storyWaitSec + 5, frame(away, false));
    expect(run(v, 10, frame(50, false))).toBe(0);
    v.dispose();
  });
});
