import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SEAS, grownMap } from '../src/data/grownMap';
import { PHASE1_SOURCE, prepareMap } from '../src/data/maps';
import grownFile from '../src/data/seas/grown.json';
import {
  addIsland,
  addMark,
  addPort,
  addShape,
  deleteSelection,
  findIsland,
} from '../src/editor/model';
import {
  GROWN_PATH,
  IN_SEA,
  RING,
  type GrownDef,
  addSea,
  claimNew,
  mergeSeas,
  moveToSea,
  ownerOf,
  seaExports,
  seaPath,
  splitSeas,
} from '../src/editor/seas';
import { quickChecks } from '../src/sim/mapChecks';

/** Every file the sea editor writes, as shipped. */
const shipped = (): Record<string, string> => {
  const files: Record<string, string> = { [seaPath(RING)]: readFileSync(seaPath(RING), 'utf8') };
  for (const f of readdirSync('src/data/seas'))
    files[`src/data/seas/${f}`] = readFileSync(`src/data/seas/${f}`, 'utf8');
  return files;
};
const fresh = () => mergeSeas(PHASE1_SOURCE, SEAS, grownFile as GrownDef);

describe('sea editor (0161)', () => {
  it('lists every sea file in grown.json, and each file is named after its id', () => {
    const files = readdirSync('src/data/seas')
      .filter((f) => f !== 'grown.json')
      .map((f) => f.replace(/\.json$/, ''));
    expect([...grownFile.seas].sort()).toEqual(files.sort());
    for (const sea of SEAS) expect(grownFile.seas).toContain(sea.id);
  });

  it('is the same map the game sails with ?map=phase4', () => {
    const doc = fresh();
    const plain = JSON.parse(
      JSON.stringify(doc, (k, v: unknown) => (k === IN_SEA ? undefined : v)),
    );
    delete plain.seaEditor;
    expect(plain).toEqual(JSON.parse(JSON.stringify(grownMap(PHASE1_SOURCE))));
  });

  it('writes every file back byte for byte when nothing was edited', () => {
    const files = shipped();
    const out = seaExports(fresh(), files);
    expect(out.map((f) => f.path).sort()).toEqual(
      [seaPath(RING), GROWN_PATH, ...SEAS.map((s) => seaPath(s.id))].sort(),
    );
    for (const file of out) {
      expect(file.text, file.path).toBe(files[file.path]);
      expect(file.changed).toBe(false);
    }
  });

  it('survives a stored draft and an undo snapshot (plain JSON)', () => {
    const files = shipped();
    const doc = JSON.parse(JSON.stringify(fresh()));
    for (const file of seaExports(doc, files)) expect(file.changed, file.path).toBe(false);
  });

  it('puts new things in the active sea, and only that file changes', () => {
    const doc = fresh();
    doc.seaEditor.active = 'south';
    const id = addIsland(doc, 300, -800);
    addShape(doc, 'reef', 200, -700);
    addMark(doc, 100, -650, 'cardinal-east');
    claimNew(doc);
    expect(ownerOf(findIsland(doc, id))).toBe('south');
    const { ring, seas } = splitSeas(doc);
    expect(ring).toEqual(PHASE1_SOURCE);
    const south = seas.find((s) => s.id === 'south')!;
    expect(south.islands.at(-1)!.id).toBe(id);
    expect(south.marks!.at(-1)).toEqual({ type: 'cardinal-east', x: 100, y: -650 });
    const changed = seaExports(doc, shipped()).filter((f) => f.changed);
    expect(changed.map((f) => f.path)).toEqual(['src/data/seas/south.json']);
  });

  it('a new port takes its port and waypoint into the island’s sea', () => {
    const doc = fresh();
    doc.seaEditor.active = 'south';
    const id = addIsland(doc, 300, -800);
    claimNew(doc);
    addPort(doc, id);
    claimNew(doc);
    moveToSea(doc, { kind: 'island', id }, RING);
    const { ring, seas } = splitSeas(doc);
    expect(ring.ports.at(-1)!.islandId).toBe(id);
    expect(ring.course.at(-1)!.label).toBe(findIsland(doc, id)!.name);
    expect(seas[0]!.islands.some((i) => i.id === id)).toBe(false);
  });

  it('starts a new sea file and lists it in grown.json', () => {
    const doc = fresh();
    expect(addSea(doc, 'north', 'The Ice')).toBe('north');
    expect(addSea(doc, 'north', 'Again')).toBeNull();
    expect(addSea(doc, 'grown', 'No')).toBeNull();
    expect(addSea(doc, 'Bad id!', 'No')).toBeNull();
    addIsland(doc, 0, 800);
    claimNew(doc);
    const out = seaExports(doc, shipped());
    const north = out.find((f) => f.path === 'src/data/seas/north.json')!;
    expect(north.changed).toBe(true);
    expect(JSON.parse(north.text)).toMatchObject({
      id: 'north',
      name: 'The Ice',
      islands: [{ id: 'island-1', x: 0, y: 800 }],
      terrain: [],
      ports: [],
      course: [],
    });
    expect(JSON.parse(out.find((f) => f.path === GROWN_PATH)!.text).seas).toEqual([
      'south',
      'west',
      'east',
      'north',
    ]);
  });

  it('writes the sea radius to grown.json and keeps the ring’s own', () => {
    const doc = fresh();
    doc.boundsRadius = 1200;
    const { ring, grown } = splitSeas(doc);
    expect(grown.boundsRadius).toBe(1200);
    expect(ring.boundsRadius).toBe(PHASE1_SOURCE.boundsRadius);
    expect(ring.name).toBe(PHASE1_SOURCE.name);
  });

  it('deletes from the file that owned it', () => {
    const doc = fresh();
    const before = doc.marks!.length;
    const at = doc.marks!.findIndex((m) => ownerOf(m) === 'south');
    deleteSelection(doc, { kind: 'mark', index: at });
    expect(doc.marks!.length).toBe(before - 1);
    expect(splitSeas(doc).seas[0]!.marks!.length).toBe(SEAS[0]!.marks!.length - 1);
  });

  it('passes the map checks on the merged map', () => {
    const errors = quickChecks(prepareMap(fresh())).filter((c) => !c.ok && c.severity === 'error');
    expect(errors).toEqual([]);
  });
});

describe('route checks on the grown sea (0161)', () => {
  it('one search from a place gives what a route to each port finds', async () => {
    const { sailRoute, sailTimes, harbourApproach } = await import('../src/sim/mapChecks');
    const map = prepareMap(grownMap(PHASE1_SOURCE));
    const times = sailTimes(map, map.start, map.wind.fromDeg);
    for (const port of map.ports) {
      const goal = harbourApproach(map, port);
      const route = sailRoute(map, map.start, goal, map.wind.fromDeg);
      if (!route) expect(times(goal)).toBeUndefined();
      else expect(times(goal)).toBeCloseTo(route.seconds, 6);
    }
  }, 60_000);
});

describe('sea steps, as npm run sea applies them (0161)', () => {
  it('lays out a new sea from data, in canonical key order', async () => {
    const { applySeaSteps } = await import('../src/editor/seaSteps');
    const doc = fresh();
    const made = applySeaSteps(doc, [
      { do: 'new', sea: 'north', name: 'The Ice' },
      { do: 'add', what: 'area', sea: 'north', at: [0, 780], fields: { id: 'ice', name: 'Ice' } },
      { do: 'add', what: 'zone', sea: 'north', at: [100, 820], fields: { kind: 'cold-gale' } },
      { do: 'add', what: 'mark', sea: 'north', at: [30, 700], fields: { type: 'light' } },
      { do: 'add', what: 'shallows', sea: 'south', at: [300, -640], fields: { maxDraft: 1 } },
      { do: 'move', what: 'mark', id: doc.marks!.length, by: [5, 0] },
    ]);
    expect(made).toHaveLength(6);
    const out = seaExports(doc, shipped());
    const north = JSON.parse(out.find((f) => f.path === 'src/data/seas/north.json')!.text);
    expect(Object.keys(north)).toEqual([
      'id',
      'name',
      'islands',
      'terrain',
      'ports',
      'course',
      'marks',
      'windZones',
      'chartAreas',
    ]);
    expect(north.marks).toEqual([{ type: 'light', x: 35, y: 700 }]);
    expect(north.chartAreas[0].id).toBe('ice');
    const south = JSON.parse(out.find((f) => f.path === 'src/data/seas/south.json')!.text);
    expect(south.terrain.at(-1)).toMatchObject({ kind: 'shallows', maxDraft: 1 });
    expect(quickChecks(prepareMap(doc)).filter((c) => !c.ok && c.severity === 'error')).toEqual([]);
  });

  it('puts a chart area made on the ring into the first sea (the ring has no fog)', async () => {
    const { addChartArea } = await import('../src/editor/model');
    const doc = fresh();
    doc.seaEditor.active = RING;
    addChartArea(doc, 0, -700);
    claimNew(doc);
    const { seas, ring } = splitSeas(doc);
    expect(seas[0]!.chartAreas!.at(-1)!.id).toBe('area-1');
    expect('fog' in ring).toBe(false);
  });

  it('refuses a step that cannot apply', async () => {
    const { applySeaSteps } = await import('../src/editor/seaSteps');
    expect(() => applySeaSteps(fresh(), [{ do: 'remove', what: 'island', id: 'nope' }])).toThrow(
      'no island',
    );
    expect(() =>
      applySeaSteps(fresh(), [{ do: 'add', what: 'reef', sea: 'nowhere', at: [0, 0] }]),
    ).toThrow('no sea');
  });

  it("sets a reef's rock style into its look, keeping the rest (0173)", async () => {
    const { applySeaSteps } = await import('../src/editor/seaSteps');
    const doc = fresh();
    const reef = doc.terrain!.find((t) => t.id === 'stepping-stones-1')!;
    reef.look = { ...reef.look, landmark: 'wreck' };
    applySeaSteps(doc, [
      { do: 'set', what: 'shape', id: reef.id, fields: { look: { style: 'strand' } } },
    ]);
    expect(reef.look).toEqual({ style: 'strand', landmark: 'wreck' });
    applySeaSteps(doc, [
      { do: 'set', what: 'shape', id: reef.id, fields: { look: { style: null, landmark: null } } },
    ]);
    expect(reef.look).toBeUndefined();
  });
});
