import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  EDITED_ISLANDS_KEY,
  EDITED_MAP_KEY,
  editedIslands,
  editedMap,
  saveEditedIslands,
} from '../src/data/editedMap';
import { ISLAND_DESIGNS, islandDesign, type IslandDesign } from '../src/data/islands';
import { PHASE1_SOURCE } from '../src/data/maps';
import {
  addProp,
  deleteProp,
  duplicateProp,
  moveProp,
  newProp,
  propName,
  propsAt,
  setLevels,
  setPropValue,
  tidyDesign,
  turnProp,
  addSpot,
  deleteSpot,
  moveSpot,
  setSpotPair,
} from '../src/editor/island/doc';
import {
  addLake,
  addLane,
  addMountain,
  addPlateau,
  deletePoint,
  deleteShape,
  insertPoint,
  paintWoods,
  setEdges,
  setLaneKind,
  toggleSlopeEdge,
} from '../src/editor/island/shapes';
import { History, formatIslandJson } from '../src/editor/model';
import { islandCheckKit } from '../src/render/models/towns';
import { checkIsland } from '../src/sim/islandChecks';

const IDS = ['calda', 'saltmere', 'westholm', 'south-cay'];
const SHIPPED = structuredClone(ISLAND_DESIGNS);
const calda = () => structuredClone(SHIPPED.calda!);
const memory = () => {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  };
};

afterEach(() => {
  // Play-test loading replaces shipped designs in the shared table: put them back.
  for (const id of IDS) ISLAND_DESIGNS[id] = SHIPPED[id]!;
});

describe('island builder document (0105)', () => {
  it('exports the shipped island files byte for byte, so an export drops into the repo', () => {
    for (const id of IDS) {
      const text = readFileSync(`src/data/islands/${id}.json`, 'utf8');
      const design = JSON.parse(text) as IslandDesign;
      expect(formatIslandJson(design), id).toBe(text);
      expect(formatIslandJson(tidyDesign(design)), id).toBe(text);
    }
  });

  it('adds a prop at the level it is dropped on, with the size it usually has', () => {
    const d = calda();
    const lamp = newProp(d, 'lamp-post', 0.123456789, -0.2, 3);
    expect(lamp).toEqual({ type: 'lamp-post', x: 0.123457, z: -0.2, size: 1.3, from: 3 });
    const homes = d.props.filter((p) => p.type === 'cabin').length;
    const cabin = newProp(d, 'cabin', 0, 0, 2, true);
    expect(cabin.variant).toBe(homes);
    const i = addProp(d, cabin);
    expect(d.props[i]).toBe(cabin);
    expect(propsAt(d, 1).later).toContain(i);
    expect(propsAt(d, 2).now).toContain(i);
  });

  it('moves, turns, sizes, duplicates and deletes', () => {
    const d = calda();
    const i = d.props.findIndex((p) => p.type === 'warehouse');
    moveProp(d, i, 0.1234567, 0.5);
    turnProp(d, i, 370);
    expect(d.props[i]).toMatchObject({ x: 0.123457, z: 0.5, turn: 10 });
    turnProp(d, i, -200);
    expect(d.props[i]!.turn).toBe(160);
    setPropValue(d, i, 'size', 1);
    expect(d.props[i]!.size).toBeUndefined();
    setPropValue(d, i, 'variant', 2);
    expect(d.props[i]!.variant).toBe(2);
    const copy = duplicateProp(d, i);
    expect(copy).toBe(i + 1);
    expect(d.props[copy]).toMatchObject({ type: 'warehouse', x: 0.183457, z: 0.5 });
    const count = d.props.length;
    deleteProp(d, copy);
    expect(d.props).toHaveLength(count - 1);
  });

  it('keeps levels tidy: "to" goes when it is 4 or before "from"', () => {
    const d = calda();
    const i = d.props.findIndex((p) => p.type === 'warehouse');
    setLevels(d, i, 2, 3);
    expect(d.props[i]).toMatchObject({ from: 2, to: 3 });
    setLevels(d, i, 2, 4);
    expect(d.props[i]!.to).toBeUndefined();
    setLevels(d, i, 3, 2);
    expect(d.props[i]).toMatchObject({ from: 3 });
    expect(d.props[i]!.to).toBeUndefined();
  });

  it('writes edited props in the files key order', () => {
    const d = calda();
    const i = addProp(d, newProp(d, 'cabin', 0.1, 0.2, 2, true));
    turnProp(d, i, 30);
    setPropValue(d, i, 'shape', 0.4);
    // Calda's cabins have a size (decision 0215), so a new one takes it.
    expect(Object.keys(tidyDesign(d).props[i]!)).toEqual([
      'type',
      'x',
      'z',
      'turn',
      'size',
      'variant',
      'shape',
      'from',
    ]);
  });

  it('names every catalogue prop', () => {
    expect(propName('fish-house')).toBe("Fisher's house");
    expect(propName('cutting-shed')).toBe('Cutting shed');
  });

  it('undoes and redoes island edits', () => {
    const d = calda();
    const history = new History<IslandDesign>();
    history.record(d);
    moveProp(d, 0, 0, 0);
    const prior = history.undo(d)!;
    expect(prior.props[0]).toEqual(SHIPPED.calda!.props[0]);
    expect(history.redo(prior)!.props[0]).toMatchObject({ x: 0, z: 0 });
  });

  it('a dropped prop out at sea or on a cliff is flagged by the checks', () => {
    const d = calda();
    const R = 30 / 2.2;
    addProp(d, newProp(d, 'warehouse', 0, 1.5, 2));
    const issues = checkIsland(d, { ...islandCheckKit(d, R), triangles: undefined });
    expect(issues.filter((i) => i.severity === 'error').map((i) => i.check)).toContain('land');
  });
});

describe('island builder ground, lanes and woods (0106)', () => {
  const plateau = { kind: 'ground', index: 1 } as const;

  it('turns single edges between cliff and slope, as runs', () => {
    const d = calda();
    const g = d.ground[1]!;
    toggleSlopeEdge(d, 1, 7);
    expect(g).toMatchObject({ slope: 0.15, slopeEdges: [[7, 7]] });
    toggleSlopeEdge(d, 1, 6);
    toggleSlopeEdge(d, 1, 8);
    expect(g.slopeEdges).toEqual([[6, 8]]);
    toggleSlopeEdge(d, 1, 7);
    expect(g.slopeEdges).toEqual([
      [6, 6],
      [8, 8],
    ]);
    setEdges(d, 1, 0.2);
    expect(g.slope).toBe(0.2);
    expect(g.slopeEdges).toBeUndefined();
    toggleSlopeEdge(d, 1, 0);
    expect(g.slopeEdges).toEqual([[1, 8]]);
    setEdges(d, 1, null);
    expect(g.slope).toBeUndefined();
    expect(g.slopeEdges).toBeUndefined();
  });

  it('keeps sloped edges in place when points are added or removed', () => {
    const d = calda();
    const g = d.ground[1]!;
    toggleSlopeEdge(d, 1, 7);
    // A point in the sloped edge splits it into two sloped edges.
    expect(insertPoint(d, plateau, 7)).toBe(8);
    expect(g.outline).toHaveLength(10);
    expect(g.outline![8]).toEqual([0.55, -0.56]);
    expect(g.slopeEdges).toEqual([[7, 8]]);
    // A point before it moves the edges up.
    insertPoint(d, plateau, 2);
    expect(g.slopeEdges).toEqual([[8, 9]]);
    // Removing it again, then the split point: one sloped edge again.
    expect(deletePoint(d, plateau, 3)).toBe(true);
    expect(deletePoint(d, plateau, 8)).toBe(true);
    expect(g.outline).toEqual(SHIPPED.calda!.ground[1]!.outline);
    expect(g.slopeEdges).toEqual([[7, 7]]);
    // Outlines keep three points, lanes two.
    const lake = { kind: 'lake' } as const;
    while (d.lake!.length > 3) deletePoint(d, lake, 0);
    expect(deletePoint(d, lake, 0)).toBe(false);
    const lane = { kind: 'lane', index: 2 } as const;
    expect(deletePoint(d, lane, 0)).toBe(true);
    expect(deletePoint(d, lane, 0)).toBe(false);
  });

  it('adds raised ground, a mountain and a lake from the level they are drawn on', () => {
    const d = calda();
    const n = d.ground.length;
    expect(addPlateau(d, -1, 0.4, 0.11, 1)).toBe(n);
    expect(d.ground[n]).toMatchObject({ height: 0.31, material: 'grass' });
    expect(d.ground[n]!.outline).toHaveLength(6);
    addMountain(d, 1.2, 0.2, 0.11, 3);
    expect(d.ground[n + 1]).toMatchObject({
      height: 0.71,
      material: 'rock',
      shape: 'peak',
      base: 0.11,
      from: 3,
    });
    // One lake per island.
    expect(addLake(d, 0, 0)).toBe(false);
    deleteShape(d, { kind: 'lake' });
    expect(d.lake).toBeUndefined();
    expect(addLake(d, 0, 0)).toBe(true);
    // The main coast stays; an islet takes its own ground with it.
    expect(deleteShape(d, { kind: 'coast', index: 0 })).toBe(false);
  });

  it('draws lanes, paths and stairs, and turns one into another', () => {
    const d = calda();
    const i = addLane(d, 'stairs', [
      [-0.25, -0.55, 0.11],
      [-0.45, -0.95, 0.32],
    ]);
    expect(d.lanes[i]).toEqual({
      kind: 'stairs',
      base: 0.11,
      points: [
        [-0.25, -0.55, 0.11],
        [-0.45, -0.95, 0.32],
      ],
    });
    setLaneKind(d, i, 'path', () => 0);
    expect(d.lanes[i]).toEqual({
      kind: 'path',
      points: [
        [-0.25, -0.55],
        [-0.45, -0.95],
      ],
    });
    setLaneKind(d, i, 'stairs', (x) => (x < -0.3 ? 0.32 : 0.11));
    expect(d.lanes[i]!.points).toEqual([
      [-0.25, -0.55, 0.11],
      [-0.45, -0.95, 0.32],
    ]);
    setLaneKind(d, i, 'lane', () => 0);
    expect(d.lanes[i]).toEqual({
      points: [
        [-0.25, -0.55],
        [-0.45, -0.95],
      ],
    });
  });

  it('paints woods and clearings, each rubbing out the other', () => {
    const d = calda();
    const clear = d.woods.clear?.length ?? 0;
    paintWoods(d, -1, 0, 0.1, 'grow');
    paintWoods(d, -0.97, 0, 0.1, 'grow'); // closer than half a brush: skipped
    paintWoods(d, -0.9, 0, 0.1, 'grow');
    expect(d.woods.areas).toEqual([
      [-1, 0, 0.1],
      [-0.9, 0, 0.1],
    ]);
    paintWoods(d, -0.95, 0, 0.06, 'clear');
    expect(d.woods.areas).toBeUndefined();
    expect(d.woods.clear).toHaveLength(clear + 1);
    paintWoods(d, -0.95, 0, 0.1, 'grow');
    expect(d.woods.clear).toHaveLength(clear);
  });

  it('exports ground, lanes and woods in the files key order', () => {
    const d = calda();
    toggleSlopeEdge(d, 1, 7);
    addPlateau(d, -1, 0.4, 0.11, 2);
    paintWoods(d, -1, 0, 0.1, 'grow');
    addLane(d, 'stairs', [
      [0, 0, 0.11],
      [0, -0.2, 0.32],
    ]);
    const text = formatIslandJson(tidyDesign(JSON.parse(JSON.stringify(d)) as IslandDesign));
    const back = JSON.parse(text) as IslandDesign;
    expect(Object.keys(back.ground[1]!)).toEqual([
      'outline',
      'height',
      'material',
      'slope',
      'slopeEdges',
    ]);
    expect(Object.keys(back.ground.at(-1)!)).toEqual(['outline', 'height', 'material', 'from']);
    expect(Object.keys(back.lanes.at(-1)!)).toEqual(['kind', 'points', 'base']);
    expect(Object.keys(back.woods).at(-1)).toBe('areas');
  });
});

describe('island builder build spots (0128)', () => {
  it('adds, moves, pairs and deletes spots, kept in the file order', () => {
    const d = structuredClone(islandDesign('skerry')!);
    const before = formatIslandJson(tidyDesign(d));
    const n = d.homeSpots!.length;
    const i = addSpot(d, 0.1234567, -0.2);
    expect(d.homeSpots![i]).toEqual({ id: `spot-${n + 1}`, x: 0.123457, z: -0.2 });
    moveSpot(d, i, 0.3, 0.31);
    setSpotPair(d, i, 'crafts');
    expect(Object.keys(tidyDesign(d).homeSpots![i]!)).toEqual(['id', 'x', 'z', 'pair']);
    setSpotPair(d, i, undefined);
    expect(d.homeSpots![i]!.pair).toBeUndefined();
    deleteSpot(d, i);
    expect(formatIslandJson(tidyDesign(d))).toBe(before);
    // No spots left: the key goes, and the island is no longer buildable.
    const bare = structuredClone(d);
    while (bare.homeSpots?.length) deleteSpot(bare, 0);
    expect('homeSpots' in bare).toBe(false);
    // Ids stay unique after a delete.
    const e = structuredClone(d);
    deleteSpot(e, 0);
    expect(e.homeSpots![addSpot(e, 0, 0)]!.id).toBe(`spot-${n + 1}`);
  });
});

describe('play this island (0105)', () => {
  it('plays edited islands on the play-test save, with or without an edited map', () => {
    const storage = memory();
    const d = calda();
    moveProp(
      d,
      d.props.findIndex((p) => p.type === 'warehouse'),
      0.3,
      0.3,
    );
    saveEditedIslands(storage, [d]);
    expect(editedIslands(storage).map((e) => e.id)).toEqual(['calda']);
    // Nothing loads without the address asking for it.
    expect(editedMap('', storage)).toBeNull();
    expect(islandDesign('calda')).toBe(SHIPPED.calda);
    // Only islands edited: the shipped map, with the edited island.
    const played = editedMap('?map=edited', storage)!;
    expect(played.name).toBe(PHASE1_SOURCE.name);
    expect(islandDesign('calda').props).toEqual(d.props);
    // A broken entry is left out, the others still load.
    storage.setItem(EDITED_ISLANDS_KEY, JSON.stringify({ calda: d, westholm: { id: 'westholm' } }));
    expect(editedIslands(storage).map((e) => e.id)).toEqual(['calda']);
    saveEditedIslands(storage, []);
    expect(storage.getItem(EDITED_ISLANDS_KEY)).toBeNull();
    storage.setItem(EDITED_MAP_KEY, '{"name":"broken"}');
    expect(editedMap('?map=edited', storage)).toBeNull();
  });
});
