import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRng } from '../src/sim/rng';
import {
  SEA_LIFE,
  livesIn,
  nearestWithin,
  porpoise,
  shoreDistance,
  shownCount,
  whalePose,
} from '../src/sim/seaLife';
import { MAX_POD } from '../src/sim/seaLifeChecks';
import {
  LIFE_FILE,
  addBird,
  lifeField,
  lifeProblems,
  lifeText,
  removeBird,
  setLifeField,
  shippedLifeDoc,
} from '../src/editor/seaLife/doc';
import type * as THREE from 'three';
import { SeaBirds } from '../src/render/seaBirds';
import { Dolphins, type SwimScene, Whale } from '../src/render/seaSwimmers';

const scene = (over: Partial<SwimScene> = {}): SwimScene => ({
  dt: 0.1,
  time: 10,
  boat: { x: 0, y: 0, heading: Math.PI / 2, speedKn: 5 },
  seaAt: () => 'ring',
  shoreAt: () => 1000,
  heightAt: () => 0,
  share: 1,
  ...over,
});

describe('sea life swimmers (issue #476)', () => {
  it('surfaces the whale ahead when called, in her waters only', () => {
    const whale = new Whale(SEA_LIFE.whale, createRng(1));
    whale.surfaceNow();
    whale.update(scene());
    expect(whale.root.visible).toBe(true);
    const at = whale.root.children[0]!.position;
    expect(at.x).toBeCloseTo(SEA_LIFE.whale.fromBoat[0], 0);
    const ashore = new Whale(SEA_LIFE.whale, createRng(1));
    ashore.surfaceNow();
    ashore.update(scene({ shoreAt: () => 5 }));
    expect(ashore.root.visible).toBe(false);
  });

  it('brings a pod abeam and draws only the dolphins in the air', () => {
    const pod = new Dolphins(SEA_LIFE.dolphins, createRng(2));
    pod.comeNow();
    let seen = 0;
    for (let t = 0; t < 6; t += 0.1) {
      pod.update(scene({ time: t }));
      seen = Math.max(seen, pod.mesh.count);
    }
    expect(pod.mesh.visible).toBe(true);
    expect(seen).toBeGreaterThan(0);
    expect(seen).toBeLessThanOrEqual(SEA_LIFE.dolphins.pod[1]);
  });
});

describe('sea life rules (issue #476)', () => {
  it('thins every count by quality and night, none on Ultra-low', () => {
    expect(shownCount(14, SEA_LIFE.quality.ultralow!)).toBe(0);
    expect(shownCount(14, SEA_LIFE.quality.low!)).toBe(7);
    expect(shownCount(14, SEA_LIFE.quality.high!)).toBe(14);
    expect(shownCount(14, 1, 1, 0.35)).toBe(5);
    expect(shownCount(14, 1, 0.5, 0)).toBe(7);
  });

  it('keeps each creature to its seas and its distance from shore', () => {
    const { shoals, whale } = SEA_LIFE;
    expect(livesIn(shoals, 'ring', 20)).toBe(true);
    expect(livesIn(shoals, 'ring', 200)).toBe(false);
    expect(livesIn(whale, 'south', 500)).toBe(false);
    expect(shoreDistance([{ x: 0, y: 0, radius: 10 }], 30, 0)).toBe(20);
    expect(
      nearestWithin(
        [
          { x: 50, y: 0 },
          { x: 20, y: 0 },
        ],
        0,
        0,
        40,
      ),
    ).toBe(1);
    expect(nearestWithin([{ x: 50, y: 0 }], 0, 0, 40)).toBe(-1);
  });

  it('leaps a dolphin clear in the middle of its arc and keeps it under between', () => {
    const def = SEA_LIFE.dolphins;
    const pose = { lift: 0, pitch: 0 };
    porpoise((def.jumpSec * def.airShare) / 2, 0, def, pose);
    expect(pose.lift).toBeCloseTo(def.jumpHeight, 5);
    porpoise(def.jumpSec * def.airShare * 0.1, 0, def, pose);
    expect(pose.pitch).toBeGreaterThan(0);
    porpoise(def.jumpSec * 0.9, 0, def, pose);
    expect(pose.lift).toBeLessThan(-2.5);
  });

  it('rises the whale, blows early, and lifts the flukes as she dives', () => {
    const pose = { lift: 0, pitch: 0, spout: 0 };
    expect(whalePose(0, pose).lift).toBeLessThan(-2);
    expect(whalePose(0.18, pose).spout).toBeGreaterThan(0.5);
    expect(whalePose(0.4, pose).spout).toBe(0);
    expect(pose.lift).toBeGreaterThan(-0.2);
    whalePose(0.85, pose);
    // The flukes, 4.75 behind her middle at size 1, are clear of the water mid-dive.
    expect(pose.lift + Math.sin(-pose.pitch) * 4.75).toBeGreaterThan(0.3);
    expect(whalePose(1, pose).lift).toBeLessThan(-4);
  });

  it('has a pod place for the largest pod the checks allow', () => {
    expect(SEA_LIFE.dolphins.pod[1]).toBeLessThanOrEqual(MAX_POD);
    const pod = new Dolphins(SEA_LIFE.dolphins, createRng(3));
    expect(pod.mesh.instanceMatrix.count).toBeGreaterThanOrEqual(MAX_POD);
  });

  it('brings a flock down over its home, thins it on Low and flies it off on Ultra-low', () => {
    const birds = new SeaBirds(SEA_LIFE.birds, createRng(4));
    const harbour = { x: 100, y: 50 };
    const flown = (share: number, home: typeof harbour | null) => {
      for (let t = 0; t < 12; t += 0.1)
        birds.update(0.1, t, share, 0, (kind) => (kind.home === 'harbour' ? home : null));
      return birds.root.children.reduce((n, m) => n + (m as THREE.InstancedMesh).count, 0);
    };
    expect(flown(1, harbour)).toBe(SEA_LIFE.birds.gull!.count);
    expect(birds.distanceTo(['gull'], harbour.x, harbour.y)).toBeLessThan(1);
    expect(flown(SEA_LIFE.quality.low!, harbour)).toBe(shownCount(SEA_LIFE.birds.gull!.count, 0.5));
    expect(flown(SEA_LIFE.quality.ultralow!, harbour)).toBe(0);
    expect(birds.distanceTo(['gull'], harbour.x, harbour.y)).toBe(Infinity);
  });
});

describe('sea life file, page and npm run life (issue #476)', () => {
  it('ships a file that passes its checks, and names a typo', () => {
    expect(lifeProblems(shippedLifeDoc())).toEqual([]);
    const doc = shippedLifeDoc();
    doc.birds.gull!.seas.push('atlantis');
    doc.whale.model = 'life-kraken';
    doc.shoals.color = 'mauve';
    const problems = lifeProblems(doc).join('\n');
    expect(problems).toMatch(/birds.gull.seas: "atlantis" is not a sea/);
    expect(problems).toMatch(/whale.model: "life-kraken" is not a prop recipe/);
    expect(problems).toMatch(/shoals.color: "mauve" is not a palette colour/);
  });

  it('sets numbers, pairs and lists from text and refuses the wrong shape', () => {
    const doc = shippedLifeDoc();
    expect(setLifeField(doc, 'birds.gull.count', '18')).toBeNull();
    expect(doc.birds.gull!.count).toBe(18);
    expect(setLifeField(doc, 'whale.every', '40, 90')).toBeNull();
    expect(doc.whale.every).toEqual([40, 90]);
    expect(setLifeField(doc, 'dolphins.seas', 'ring, south')).toBeNull();
    expect(doc.dolphins.seas).toEqual(['ring', 'south']);
    expect(setLifeField(doc, 'whale.every', '40')).toMatch(/two numbers/);
    expect(setLifeField(doc, 'whale.colour', '1')).toMatch(/unknown field/);
    expect(lifeField(doc, 'whale.every')).toBe('40, 90');
  });

  it('adds a bird kind as a copy and writes the file as Prettier does', () => {
    const doc = shippedLifeDoc();
    expect(addBird(doc, 'puffin', 'tern')).toBeNull();
    expect(doc.birds.puffin).toEqual(doc.birds.tern);
    expect(addBird(doc, 'puffin')).toMatch(/already exists/);
    expect(removeBird(doc, 'puffin')).toBe(true);
    expect(lifeText(doc)).toBe(readFileSync(LIFE_FILE, 'utf8'));
  });
});
