# 0110. Every island has its own file

**Status:** Implemented for review (2026-10-23). Extends [0101](0101-island-files-built.md) (island files for the four ports) and the island builder of [0105](0105-island-builder-props.md) and [0106](0106-island-builder-ground-lanes-woods.md). How to use it: [map editor](../map-editor/README.md), [island builder](../island-builder/builder/README.md); before and after: [conversion](../island-builder/conversion/before-after.png).

## Context

Only the four port islands had island files, so only they opened in the builder. Guillaume (2026-10-23): every island must have its own file and be editable in the builder, including islands added in the map editor, the scenery islands and the separator ridges, "or it's useless". He also asked whether reefs should share one file or have one each, and said the map will grow to about five times its size soon, so its size must be editable too.

Asked how the scenery islands should get their files, Guillaume chose **rebuild them in the port format** (the same ground, props and woods as a port), with before-and-after pictures of each for his approval, over keeping them drawn exactly as before.

## Decision

- **One file per island.** Skerry, Bell Rock, Lantern Rock, Abbey Head, Watchman Key and the two separator ridges (Greyback, Gull Hook) are now `src/data/islands/<id>.json`, like the ports. Their map entries keep position, radius and the harbour bearing and gain `look.design`; the ridges moved from `terrain` to `islands`. The loader picks up every JSON file in the folder.
- **Converted from how they were drawn.** `src/editor/island/fromLook.ts` replays the old drawing code's random choices into a file: the beach blob becomes the coast, rock layers become rock ground with a grass top, trees become `pine` props, houses `cabin`s, the boulder a rock peak, plus the landmark and wreck. Abbey Head and Watchman Key (future shipyards) get the yard town by level: warehouses, slipway, yard houses, the pier. A ridge becomes an island of radius 20 centred on its outline with three tiers, outcrops, pines and boulders (a new `boulder` prop). `settle` then moves anything the checks reject (off the coast, on a cliff edge, in the harbour approach) to the nearest good spot on the same terrace.
- **Harbour or not.** An island has a harbour (pier, flag, landing, side piers, approach lane and its check) only when its map entry has `look.dock`. Without one it is always drawn at level 4 and the builder hides the levels bar.
- **Islands made in the map editor.** Every island's panel has **✎ Edit island**. An island or ridge without a file gets one made from how it is drawn now (the same conversion), as an undoable map edit, and the builder opens on it. The file is kept in the browser with the edited map and exported from the builder like any other.
- **Reefs and sandbanks stay entries in the map file**, not files: they are just outlines, and the map editor already reshapes them. Each terrain entry now stores its own `seed`, so removing the ridges from `terrain` did not reshuffle the reefs' rocks.
- **Map size** is already editable: **Sea radius** (`boundsRadius`) in the map's panel. Making a five-times-bigger map fast (draw only the islands near the ship) is a separate step for when the map grows.
- Map checks find a scenery island's landmark in its file (`landmarkOf`); the harbour approach check stays far enough out for small islands (`1 + 22 / radius`).

## Consequences

- Every island on the map opens in the builder; Guillaume approves the conversion from [the before-and-after sheet](../island-builder/conversion/before-after.png).
- The scenery islands look very close to before but not identical: straight cliffs instead of tapered ones, the catalogue's pines and cabins, a hull on the slipway and a flag at the yards at level 4. Reefs are identical.
- A new island made in the editor needs both files committed: `map.json` and its `islands/<id>.json`.
- 11 island files now carry golden hashes in `tests/island-files.test.ts`.
