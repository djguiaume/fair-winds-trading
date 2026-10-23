import type { MapDef } from '../sim/map';
import type { SaveStorage } from '../sim/save';
import { type IslandDesign, isIslandShape, useIslandDesign } from './islands';
import { PHASE1_SOURCE, prepareMap } from './maps';

/**
 * "Play this map" from the map editor (decision 0095). The editor keeps its working map in this
 * browser under EDITED_MAP_KEY and opens the game with `?map=edited`. That voyage keeps its own
 * save and tutorial progress (every key gets EDITED_PREFIX), so trying a map never touches the
 * player's real voyage. Players never see any of this: without the parameter nothing changes.
 */
export const EDITED_MAP_KEY = 'fwt.editor.map.v1';
export const EDITED_PREFIX = 'fwt.editor.play.';
/** The island builder's edited island files (decision 0105), by island id. */
export const EDITED_ISLANDS_KEY = 'fwt.editor.islands.v1';

/**
 * The edited map to sail, or null when the address does not ask for one or it is unreadable.
 * Edited island files replace the shipped ones first; with only islands edited, the shipped map
 * is sailed, still on the play-test save.
 */
export function editedMap(search: string, storage: SaveStorage | null): MapDef | null {
  if (new URLSearchParams(search).get('map') !== 'edited' || !storage) return null;
  try {
    for (const design of editedIslands(storage)) useIslandDesign(design);
    const raw: unknown = JSON.parse(storage.getItem(EDITED_MAP_KEY) ?? 'null');
    if (raw === null) return prepareMap(structuredClone(PHASE1_SOURCE));
    if (!isMapShape(raw)) return null;
    return prepareMap(raw);
  } catch {
    return null;
  }
}

/** The island files edited in the builder; unreadable entries are left out. */
export function editedIslands(storage: SaveStorage): IslandDesign[] {
  try {
    const raw: unknown = JSON.parse(storage.getItem(EDITED_ISLANDS_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? Object.values(raw).filter(isIslandShape) : [];
  } catch {
    return [];
  }
}

/** Saves the builder's edited islands (only those that differ from the shipped files). */
export function saveEditedIslands(storage: SaveStorage, designs: IslandDesign[]) {
  if (designs.length)
    storage.setItem(
      EDITED_ISLANDS_KEY,
      JSON.stringify(Object.fromEntries(designs.map((d) => [d.id, d]))),
    );
  else storage.removeItem(EDITED_ISLANDS_KEY);
}

/** Enough of a map's shape to load it (the editor's checks then say what else is wrong). */
export function isMapShape(raw: unknown): raw is MapDef {
  const map = raw as MapDef | null;
  return (
    !!map &&
    typeof map === 'object' &&
    typeof map.name === 'string' &&
    typeof map.boundsRadius === 'number' &&
    Array.isArray(map.islands) &&
    Array.isArray(map.ports) &&
    Array.isArray(map.course) &&
    typeof map.start?.x === 'number' &&
    typeof map.wind?.fromDeg === 'number'
  );
}

/** The same storage with every key moved under a prefix. */
export function prefixedStorage(storage: SaveStorage, prefix: string): SaveStorage {
  return {
    getItem: (key) => storage.getItem(prefix + key),
    setItem: (key, value) => storage.setItem(prefix + key, value),
    removeItem: (key) => storage.removeItem(prefix + key),
  };
}
