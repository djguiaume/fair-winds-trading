import type { MapDef } from '../sim/map';
import type { SaveStorage } from '../sim/save';
import { prepareMap } from './maps';

/**
 * "Play this map" from the map editor (decision 0095). The editor keeps its working map in this
 * browser under EDITED_MAP_KEY and opens the game with `?map=edited`. That voyage keeps its own
 * save and tutorial progress (every key gets EDITED_PREFIX), so trying a map never touches the
 * player's real voyage. Players never see any of this: without the parameter nothing changes.
 */
export const EDITED_MAP_KEY = 'fwt.editor.map.v1';
export const EDITED_PREFIX = 'fwt.editor.play.';

/** The edited map to sail, or null when the address does not ask for one or it is unreadable. */
export function editedMap(search: string, storage: SaveStorage | null): MapDef | null {
  if (new URLSearchParams(search).get('map') !== 'edited' || !storage) return null;
  try {
    const raw: unknown = JSON.parse(storage.getItem(EDITED_MAP_KEY) ?? 'null');
    if (!isMapShape(raw)) return null;
    return prepareMap(raw);
  } catch {
    return null;
  }
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
