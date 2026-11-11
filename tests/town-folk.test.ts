// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PHASE1_MAP } from '../src/data/maps';
import { designOf } from '../src/data/islands';
import { PROP_GROUPS } from '../src/data/props';
import { addKind, docField, removeKind, setDocField } from '../src/editor/fieldsDoc';
import {
  FOLK_FILE,
  TOWN_FOLK_DOC,
  folkProblems,
  folkText,
  shippedFolkDoc,
} from '../src/editor/townFolk/doc';
import { GAIT, folkModel } from '../src/render/folkModel';
import { townWalks } from '../src/render/folkWalks';
import { TownFolk } from '../src/render/townFolk';
import { ISLAND_SCALE } from '../src/sim/islandUnits';
import { TOWN_FOLK, alongWalk, makeWalk, splitByKind, townPeople } from '../src/sim/townFolk';

const saltmere = PHASE1_MAP.islands.find((i) => i.id === 'saltmere')!;
const R = saltmere.radius / ISLAND_SCALE;
const walksAt = (level: number) => townWalks(designOf(saltmere)!, R, level, true, TOWN_FOLK.town);

describe('town folk rules (issue #477)', () => {
  it('gives a town more people as it grows, none to an empty island', () => {
    const { town } = TOWN_FOLK;
    expect(townPeople(town, 0)).toBe(0);
    expect(townPeople(town, 1)).toBeLessThan(townPeople(town, 4));
    expect(townPeople(town, 9)).toBe(townPeople(town, 4));
  });

  it('splits a town by kind so the counts add up exactly', () => {
    for (const n of [0, 1, 4, 14, 20]) {
      const counts = splitByKind(TOWN_FOLK.kinds, n);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(n);
    }
    expect(splitByKind({ a: { share: 0.5 }, b: { share: 0.5 } } as never, 3)).toEqual([2, 1]);
  });

  it('walks along a line and back, facing the way it goes', () => {
    const walk = makeWalk('lane', [
      { x: 0, z: 0 },
      { x: 0, z: 1 },
      { x: 1, z: 1 },
    ]);
    expect(walk.length).toBe(2);
    const at = { x: 0, z: 0, y: undefined as number | undefined, heading: 0 };
    alongWalk(walk, 0.5, at);
    expect([at.x, at.z, at.heading]).toEqual([0, 0.5, 0]);
    alongWalk(walk, 1.5, at);
    expect([at.x, at.z]).toEqual([0.5, 1]);
    expect(at.heading).toBeCloseTo(Math.PI / 2);
    const place = makeWalk('edge', [{ x: 2, z: 3, y: 0.55 }], 1);
    alongWalk(place, 5, at);
    expect([at.x, at.z, at.y, at.heading]).toEqual([2, 3, 0.55, 1]);
  });
});

describe('where the people of a town go (issue #477)', () => {
  it('finds lanes, the pier, its edges and the cargo in Saltmere at every level', () => {
    for (const level of [1, 2, 3, 4]) {
      const walks = walksAt(level);
      const where = (w: string) => walks.filter((x) => x.where === w);
      expect(where('lane').length).toBeGreaterThan(0);
      expect(where('pier').length).toBe(level >= 4 ? 3 : level >= 3 ? 2 : 1);
      expect(where('edge').length).toBe(where('pier').length * 3);
      expect(where('cargo').length).toBeGreaterThan(0);
      for (const w of where('pier')) expect(w.points.every((p) => p.y === 0.55)).toBe(true);
      for (const w of where('lane')) expect(w.length).toBeGreaterThanOrEqual(0.15);
    }
    expect(walksAt(1).length).toBeLessThan(walksAt(4).length);
  });

  it('keeps a worker between its cargo and the pier, or on the spot when alone', () => {
    const design = structuredClone(designOf(saltmere)!);
    design.props = design.props.filter((p) => p.type !== 'crates' || p.x > -1);
    const alone = townWalks(design, R, 4, true, { cargo: ['crates'] }).filter(
      (w) => w.where === 'cargo',
    );
    expect(alone.length).toBeGreaterThan(0);
    for (const w of alone) expect(w.length).toBeLessThan(0.9);
    const noHarbour = townWalks(design, R, 4, false, TOWN_FOLK.town);
    expect(noHarbour.some((w) => w.where === 'pier')).toBe(false);
  });
});

describe('the person model and the town folk view (issue #477)', () => {
  it('builds one tagged model within the folk budget', () => {
    const g = folkModel(TOWN_FOLK.town.model);
    expect(g.attributes.position!.count / 3).toBeLessThanOrEqual(PROP_GROUPS.folk!.budget);
    const folk = g.getAttribute('aFolk');
    const tagged = [0, 0, 0, 0];
    for (let i = 0; i < folk.count; i++)
      for (let k = 0; k < 4; k++) tagged[k]! += folk.getComponent(i, k);
    // Coat, rod, load and arms are all there, and the arms are part of the coat.
    expect(tagged.every((n) => n > 0)).toBe(true);
    expect(tagged[0]).toBeGreaterThan(tagged[3]!);
    g.dispose();
  });

  it('draws a town near the boat, none far off, on Ultra-low or switched off', () => {
    const levels = Object.fromEntries(PHASE1_MAP.ports.map((p) => [p.id, 4]));
    const world = {
      map: PHASE1_MAP,
      land: { islands: PHASE1_MAP.islands, out: new Set<string>() },
      boat: { x: saltmere.x - saltmere.radius - 20, y: saltmere.y },
    };
    let quality: 'high' | 'ultralow' = 'high';
    const folk = new TownFolk(world, () => quality, 'v2', levels);
    for (let t = 0; t < 3; t += 0.1) folk.update(0.1, t, 0);
    const shown = folk.mesh.count;
    expect(shown).toBe(townPeople(TOWN_FOLK.town, 4));
    expect(shown).toBeLessThanOrEqual(TOWN_FOLK.town.max);
    const gaits = new Set<number>();
    const walk = folk.mesh.geometry.getAttribute('aWalk');
    for (let i = 0; i < shown; i++) gaits.add(walk.getZ(i));
    expect(gaits.has(GAIT.fish)).toBe(true);
    expect(gaits.has(GAIT.walk) || gaits.has(GAIT.carry)).toBe(true);
    // Fewer at night.
    folk.update(0.1, 4, 1);
    expect(folk.mesh.count).toBeLessThan(shown);
    // Far away they fade out and go.
    world.boat.x = 0;
    world.boat.y = 0;
    for (let t = 0; t < 3; t += 0.1) folk.update(0.1, 10 + t, 0);
    expect(folk.mesh.count).toBe(0);
    world.boat.x = saltmere.x - saltmere.radius - 20;
    world.boat.y = saltmere.y;
    quality = 'ultralow';
    folk.update(0.1, 20, 0);
    expect(folk.root.visible).toBe(false);
    quality = 'high';
    folk.on = false;
    folk.update(0.1, 21, 0);
    expect(folk.root.visible).toBe(false);
    folk.dispose();
  });
});

describe('the town folk file, page and tool (decision 0153)', () => {
  it('ships a file that passes every check and names bad values', () => {
    expect(folkProblems(shippedFolkDoc())).toEqual([]);
    const doc = shippedFolkDoc();
    doc.town.model = 'nothing';
    doc.town.max = 500;
    doc.kinds.walker!.where = 'sky' as never;
    doc.kinds.walker!.share = 0.9;
    const problems = folkProblems(doc).join('\n');
    expect(problems).toMatch(/town.model/);
    expect(problems).toMatch(/town.max/);
    expect(problems).toMatch(/kinds.walker.where/);
    expect(problems).toMatch(/shares add up/);
  });

  it('sets fields, adds and removes a kind, and writes the shipped text', () => {
    const doc = shippedFolkDoc();
    expect(setDocField(doc, 'town.perLevel', '3, 6, 10, 16', 'folk')).toBeNull();
    expect(doc.town.perLevel).toEqual([3, 6, 10, 16]);
    expect(setDocField(doc, 'kinds.walker.speed', 'fast', 'folk')).toMatch(/needs a number/);
    expect(addKind(TOWN_FOLK_DOC, doc, 'child', 'walker')).toBeNull();
    expect(docField(doc, 'kinds.child.where')).toBe('lane');
    expect(removeKind(TOWN_FOLK_DOC, doc, 'child')).toBe(true);
    expect(folkText(shippedFolkDoc())).toBe(readFileSync(FOLK_FILE, 'utf8'));
  });
});
