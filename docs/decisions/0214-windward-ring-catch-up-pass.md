# 0214. Windward Ring catch-up pass

**Status:** Proposed (2026-10-25). Waiting on Guillaume's look at the screenshots and his call on growing the ring ports.

## Context

Phase 5 part 2 ([brief](../phase-5/brief.md), [0207](0207-the-roadmap-after-phase-4.md)): Guillaume found the central sea
less polished than the four outer seas. The [ring review](../reviews/ring-review/README.md) (every ring island at the same
cameras as Sunreach, day and night, town levels 1 and 4) found: one flat ground at Westholm, one-tone cliffs and beaches
everywhere, no lamp post on any ring island, lone ball trees, stacked-octagon islands and straight extruded ridges, reefs
with no names, dark towns at night. It also found the ring's ports are radius 18–26 against 48–60 for the outer main ports,
which no amount of detail closes (asked of Guillaume separately). The head storyteller and the art director answered the
review's questions (Saltmere's signature, what each port shows before and after its arc, reef names; the checklist and
cameras).

## Decision

- **Ring grounds as data.** The ring's styles (`grain`, `fish`, `timber`, `stone`) swap `grass`, `rock` and `sand` for
  new grounds in `palette.json`: `downs` (two greens per face, cliff faces in four sandstone tones), `sandstone` and
  `ringsand`. Every ring island gets banded cliffs at once; no island file names them.
- **Windows that read.** A recipe's `windows` part takes `pane` (pane size, 1 = as before); the ring's house recipes use
  1.5, because their houses are small.
- **Ports** (with `npm run island`, steps kept in `docs/reviews/ring-review/steps/`): Westholm gets a mill knoll, wooded
  downs with a sandstone crown, woods in clumps, hedges (new `hedge` prop) and lamps; Saltmere its signature, a smokehouse
  row that smokes after `saltmere-shoals` (`chimney-smoke`), empty racks (`empty-rack`) and boats pulled up before it,
  nets on the green (`net-rack`) and Rook's harbour office (`harbour-office`); Stonehaven a ragged coast, lamps and uncut
  blocks on the quay until `stonehaven-light`. Coasts rise to show the bands.
- **The Teeth's wreck.** A new sea mark type `wreck` (an old, empty hull aground; it does not bob, it may sit on a reef)
  stands on the Teeth until `stonehaven-light`; in the map editor, `npm run sea` and the chart.
- **Names.** The ring's reefs take the storyteller's names: East Reef, The Teeth, The Combs, Mackerel Ledge, The Friars;
  Bell Rock is named (`npm run sea -- --steps`).
- **Shapes.** Abbey Head, Watchman Key, Lantern Rock, Bell Rock, Teeth Rock, Greyback Ridge and Gull Hook get ragged coasts
  and offset, ragged tiers instead of rings and straight bands.
- **Budget check.** The island checks count a town's triangles as a new voyage finds it and with all its quests done, and
  keep the larger, instead of counting before- and after-quest props together.

## Consequences

- Island hashes in `tests/island-files.test.ts` are re-recorded; Westholm's moored boat adds one solid hull.
- Every image goes to Guillaume before merge ([rule](../roadmap.md#rules-that-hold-in-every-phase)).
- Growing the ring ports, if Guillaume picks it, is a map change on top: routes, prologue and balance on all three levels.
