# 0095. Map editor page

**Status:** Implemented for review (2026-10-23). Step 3 of [0093](0093-data-driven-content-and-authoring-tools.md), asked for by Guillaume the same day. How to use it: [docs/map-editor](../map-editor/README.md).

## Context

[0093](0093-data-driven-content-and-authoring-tools.md) decided that Guillaume edits the game himself, and that the map gets an editor page next to the model sheet: drag islands, ports, waypoints and coastline points, edit port properties, run the map checks the tests run, play the edited map and export the JSON. The map is already data (`src/data/phase1-map.json`), so the editor needs nothing from the parallel "tuning to data" work ([0094](0094-tuning-moved-to-data.md)).

Three things in the code shaped the design:

- The map checks lived inside `tests/strategic-map.test.ts` (clear water, harbour approaches, a wind-aware route finder), hard-wired to the Windward Ring.
- `src/data/maps.ts` changed the imported JSON in place: each port island's look faces the course waypoint that carries its name. An editor that prepares its map many times needs that on a copy.
- The game has one save key: playing an edited map with the same map name would have overwritten the real voyage.

## Decision

1. **`editor.html`**, a third Vite entry like `models.html`, published on Pages at `/fair-winds-trading/editor.html`. Players never load it; the game's bundle only gains about 2 kB (reading the edited map).
2. **Chart view in SVG** with the sea chart's colours ([0049](0049-ui-instrument-style.md), [0058](0058-chart-style-d-port-cards.md)): islands with their real coastlines, barrier islands, reefs and sandbanks, piers with the dock range, harbour waypoints, the start and the base wind. Layers: names, waypoints, harbour ranges, a 50-unit grid. Pan, wheel or pinch zoom, fit.
3. **Editing:** drag islands (their harbour waypoint moves with them so the harbour keeps facing the same way), radius handles, whole shapes, outline points (drag the small ring on an edge to add one), waypoints and the start. Tools add an island, a reef, a sandbank or a barrier island, or move the start. The side panel edits the selection: island name and look; port name, start level, makes, wants, makes and wants per level, wants made, ships built, hidden, home port; shape kind, name and landmark; with nothing selected, the map name, seed, sea radius, base wind and home port. Delete key, arrow-key nudges, undo and redo (whole-map snapshots).
4. **Checks in the page from the same code as the tests.** `src/sim/mapChecks.ts` holds the clear-water test, the route finder and the rules, written for any map; `tests/strategic-map.test.ts` now imports them and `tests/map-checks.test.ts` runs every rule on the shipped map and on broken ones. Quick checks run on every edit: ids and links, known goods, every good with a maker and a buyer, land inside the world edge, clear start, clear harbour approaches, ports facing a waypoint, landmarks on scenery islands, and port distances that moved more than 5 % (a warning: prices and orders were tuned on them). The route checks (a sloop reaches every port from the start in the base wind and its opposite; every pair of charted ports connects) take a few seconds, so they run in a Web Worker once edits settle.
5. **Play this map:** the working copy lives in this browser (`fwt.editor.map.v1`), and **▶ Play this map** opens the game with `?map=edited`. That voyage's save and tutorial progress use their own keys (prefix `fwt.editor.play.`), so a test voyage never touches the real one. A small "Edited map · back to editor" link shows in the game. Without the parameter the game is unchanged.
6. **Export map.json** writes the file exactly as Prettier formats it (the shipped maps round-trip byte for byte, tested), so it uploads to `src/data/` on GitHub with a clean diff and passes `npm run lint`; CI then runs every map test. **Import** opens a map file, **Reset** goes back to the shipped map.
7. `prepareMap` in `src/data/maps.ts` prepares any authored map on a copy; `PHASE1_SOURCE` is the map as authored.
8. The editor is in English only, like the model sheet: it is an authoring tool, not part of the game.

## Consequences

- Guillaume can move, add and reshape land and ports and see at once whether the map still works, then play it before committing.
- Map rules are written once: a new rule added to `mapChecks.ts` shows up in the editor and in CI.
- Map-specific test expectations (four ports in four quarters, the eastern lane, the Saltmere–Westholm block, the measured circuit) stay in the tests: they describe the Windward Ring, not maps in general, so an edited map can make them fail in CI even with every editor check green. The PR then says which.
- Not yet: editing ships' yard data moves into ship files with step 1b; selectable maps (roadmap "between Phases 2 and 4") will add a map picker to the editor; a Save button in `npm run dev` stays optional.
