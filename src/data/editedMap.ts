import type { MapDef } from '../sim/map';
import type { QuestDef } from '../sim/quests';
import type { SaveStorage } from '../sim/save';
import { type IslandDesign, isIslandShape, useIslandDesign } from './islands';
import { GAME_SOURCE, PHASE1_SOURCE, prepareMap } from './maps';

/**
 * "Play this map" from the map editor (decision 0095). The editor keeps its working map in this
 * browser under EDITED_MAP_KEY and opens the game with `?map=edited`. That voyage keeps its own
 * save and tutorial progress (every key gets EDITED_PREFIX), so trying a map never touches the
 * player's real voyage. Players never see any of this: without the parameter nothing changes.
 */
export const EDITED_MAP_KEY = 'fwt.editor.map.v1';
export const EDITED_PREFIX = 'fwt.editor.play.';
/**
 * The sea editor's working copy (decision 0161): the whole Phase 4 sea, played with
 * `?map=edited&sea=phase4` on its own save (EDITED_SEA_PREFIX).
 */
export const EDITED_SEAS_KEY = 'fwt.editor.seas.v1';
export const EDITED_SEA_PREFIX = 'fwt.editor.play.phase4.';

/** Whether the address asks for the sea editor's Phase 4 sea rather than the edited ring. */
export function editedSea(search: string): boolean {
  return new URLSearchParams(search).get('sea') === 'phase4';
}
/** The island builder's edited island files (decision 0105), by island id. */
export const EDITED_ISLANDS_KEY = 'fwt.editor.islands.v1';
/** The quest builder's working copy (decision 0142): the quests and the text edited there. */
export const EDITED_QUESTS_KEY = 'fwt.editor.quests.v1';

/** What the quest builder keeps: every quest, and the text keys changed from the shipped files. */
export interface EditedQuests {
  quests: QuestDef[];
  text: { en: Record<string, string>; fr: Record<string, string> };
}

/** Enough of the quest builder's copy to load it (the builder's checks say what else is wrong). */
export function isEditedQuests(raw: unknown): raw is EditedQuests {
  const doc = raw as EditedQuests | null;
  return (
    !!doc &&
    typeof doc === 'object' &&
    Array.isArray(doc.quests) &&
    doc.quests.every((q) => typeof q?.id === 'string' && Array.isArray(q.steps)) &&
    typeof doc.text?.en === 'object' &&
    typeof doc.text?.fr === 'object'
  );
}

/**
 * The quests edited in the quest builder, for `?map=edited` (decision 0142), or null when the
 * address does not ask for the edited map or nothing was edited.
 */
export function editedQuests(search: string, storage: SaveStorage | null): EditedQuests | null {
  if (new URLSearchParams(search).get('map') !== 'edited' || !storage) return null;
  try {
    const raw: unknown = JSON.parse(storage.getItem(EDITED_QUESTS_KEY) ?? 'null');
    return isEditedQuests(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * The edited map to sail, or null when the address does not ask for one or it is unreadable.
 * Edited island files replace the shipped ones first; with only islands edited, the shipped map
 * is sailed, still on the play-test save. With `&sea=phase4` it is the sea editor's grown sea
 * (decision 0161), whose things carry the sea file they belong to: the game ignores that.
 */
export function editedMap(search: string, storage: SaveStorage | null): MapDef | null {
  if (new URLSearchParams(search).get('map') !== 'edited' || !storage) return null;
  try {
    for (const design of editedIslands(storage)) useIslandDesign(design);
    const sea = editedSea(search);
    const raw: unknown = JSON.parse(
      storage.getItem(sea ? EDITED_SEAS_KEY : EDITED_MAP_KEY) ?? 'null',
    );
    if (raw === null) return prepareMap(sea ? GAME_SOURCE : structuredClone(PHASE1_SOURCE));
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

/** A storage that keeps nothing past this page: a quest test's fresh voyage (decision 0142). */
export function memoryStorage(): SaveStorage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}
