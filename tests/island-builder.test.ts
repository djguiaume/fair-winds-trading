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
} from '../src/editor/island/doc';
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
    expect(Object.keys(tidyDesign(d).props[i]!)).toEqual([
      'type',
      'x',
      'z',
      'turn',
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
