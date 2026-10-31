import type { IslandDesign, SculptDef } from '../../../data/islands';
import { t } from '../../../i18n';
import { BakeError, bakeSummary } from '../../../sim/coastBake';
import { bakeIsland } from '../../../sim/coastBakeMap';
import type { IslandCheckKit } from '../../../sim/islandChecks';
import type { MapDef } from '../../../sim/map';

/** What the builder gives the terrain saves: its file, the checks' kit, and one undo step per save. */
export interface TerrainSaveHost {
  design(): IslandDesign;
  kit(): IslandCheckKit;
  /** The sea being edited, prepared, for the map checks a bake can break. */
  map(): MapDef;
  strokes(): number | undefined;
  /** Remembers the file for undo, before a change. */
  record(): void;
  /** Rebuilds and rechecks after a change. */
  commit(): void;
}

/** The Terrain tab's changes to the island file, each one undo step of the builder's history. */
export function terrainSaves(host: TerrainSaveHost) {
  const sculpt = (next: SculptDef | undefined) => {
    host.record();
    if (next) host.design().sculpt = next;
    else delete host.design().sculpt;
    host.commit();
  };
  return {
    /** One stroke, or a reset. */
    sculpt,
    reset() {
      if (host.strokes() && confirm(t('editor.terrain.resetAsk'))) sculpt(undefined);
    },
    /** Traces the sculpted ground's coast into the file's outline (decision 0255), after showing what it does. */
    bake() {
      let result: ReturnType<typeof bakeIsland>;
      try {
        result = bakeIsland(host.design(), host.kit(), host.map());
      } catch (e) {
        if (!(e instanceof BakeError)) throw e;
        return alert(t('editor.terrain.bakeRefused', { why: e.message }));
      }
      if (!confirm(`${t('editor.terrain.bakeAsk')}\n\n${bakeSummary(result).join('\n')}`)) return;
      host.record();
      host.design().coasts = result.coasts;
      host.commit();
    },
  };
}
