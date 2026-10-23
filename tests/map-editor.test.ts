import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EDITED_MAP_KEY, EDITED_PREFIX, editedMap, prefixedStorage } from '../src/data/editedMap';
import { PHASE1_SOURCE } from '../src/data/maps';
import {
  History,
  addIsland,
  addPort,
  addShape,
  deleteSelection,
  findIsland,
  findShape,
  formatMapJson,
  insertPoint,
  moveIsland,
  movePoint,
  renameIsland,
  waypointOf,
} from '../src/editor/model';
import type { MapDef } from '../src/sim/map';
import { quickChecks } from '../src/sim/mapChecks';
import { prepareMap } from '../src/data/maps';

const fresh = () => structuredClone(PHASE1_SOURCE);
const memory = () => {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  };
};

describe('map editor document (0095)', () => {
  it('exports the shipped maps byte for byte, so an export drops into the repo', () => {
    for (const file of ['src/data/phase1-map.json', 'src/data/phase0-map.json']) {
      const text = readFileSync(file, 'utf8');
      expect(formatMapJson(JSON.parse(text) as MapDef)).toBe(text);
    }
  });

  it('moves an island with its harbour waypoint, in whole units', () => {
    const map = fresh();
    const island = findIsland(map, 'westholm')!;
    const wp = { ...waypointOf(map, island)! };
    moveIsland(map, 'westholm', island.x + 20.4, island.y - 9.6);
    expect([island.x, island.y]).toEqual([-290, 40]);
    expect(waypointOf(map, island)).toMatchObject({ x: wp.x + 20, y: wp.y - 10 });
  });

  it('adds, moves and deletes outline points but keeps at least three', () => {
    const map = fresh();
    const id = addShape(map, 'reef', 0, 300);
    expect(findShape(map, id)!.outline).toHaveLength(6);
    const k = insertPoint(map, id, 5)!;
    expect(k).toBe(6);
    movePoint(map, id, k, 12.7, 301.2);
    expect(findShape(map, id)!.outline[6]).toEqual([13, 301]);
    for (let i = 0; i < 6; i++) deleteSelection(map, { kind: 'shape', id, point: 0 });
    expect(findShape(map, id)!.outline).toHaveLength(3);
    expect(deleteSelection(map, { kind: 'shape', id })).toBeNull();
    expect(findShape(map, id)).toBeUndefined();
  });

  it('turns a new island into a port that passes the checks once it trades', () => {
    const map = fresh();
    const id = addIsland(map, 120, 60);
    const port = addPort(map, id)!;
    expect(port).toMatchObject({ id, islandId: id, level: 1, produces: [], wants: [] });
    expect(waypointOf(map, findIsland(map, id)!)).toBeDefined();
    renameIsland(map, id, 'Gullhaven');
    expect(port.name).toBe('Gullhaven');
    expect(waypointOf(map, findIsland(map, id)!)?.label).toBe('Gullhaven');
    port.produces = ['fish'];
    port.wants = ['stone'];
    const failed = quickChecks(prepareMap(map)).filter((c) => !c.ok && c.severity === 'error');
    expect(failed).toEqual([]);
    // Deleting the island takes its port and harbour waypoint with it.
    deleteSelection(map, { kind: 'island', id });
    expect(map.ports.some((p) => p.islandId === id)).toBe(false);
    expect(map.course.some((w) => w.label === 'Gullhaven')).toBe(false);
  });

  it('undoes and redoes whole edits', () => {
    let map = fresh();
    const history = new History();
    history.record(map);
    moveIsland(map, 'calda', 0, 0);
    map = history.undo(map)!;
    expect(findIsland(map, 'calda')!.x).toBe(170);
    map = history.redo(map)!;
    expect(findIsland(map, 'calda')!.x).toBe(0);
    // A click that changed nothing leaves no undo step.
    history.record(map);
    history.discardIfSame(map);
    expect(history.canUndo).toBe(true);
    history.undo(map);
    expect(history.canUndo).toBe(false);
  });
});

describe('play this map (0095)', () => {
  it('loads the edited map only with ?map=edited and a readable map', () => {
    const storage = memory();
    const map = fresh();
    moveIsland(map, 'calda', 160, 260);
    storage.setItem(EDITED_MAP_KEY, JSON.stringify(map));
    expect(editedMap('', storage)).toBeNull();
    expect(editedMap('?map=edited', null)).toBeNull();
    const played = editedMap('?debug&map=edited', storage)!;
    expect(findIsland(played, 'calda')!.x).toBe(160);
    expect(findIsland(played, 'calda')!.look?.harbourBearing).toBeTypeOf('number');
    storage.setItem(EDITED_MAP_KEY, '{"name":"broken"}');
    expect(editedMap('?map=edited', storage)).toBeNull();
    storage.setItem(EDITED_MAP_KEY, 'not json');
    expect(editedMap('?map=edited', storage)).toBeNull();
  });

  it('keeps the play-test voyage apart from the real one', () => {
    const storage = memory();
    storage.setItem('fwt.save.v1', 'real voyage');
    const play = prefixedStorage(storage, EDITED_PREFIX);
    play.setItem('fwt.save.v1', 'test voyage');
    expect(storage.getItem('fwt.save.v1')).toBe('real voyage');
    expect(play.getItem('fwt.save.v1')).toBe('test voyage');
    play.removeItem('fwt.save.v1');
    expect(storage.getItem('fwt.save.v1')).toBe('real voyage');
  });
});
