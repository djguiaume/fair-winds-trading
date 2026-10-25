# 0191. Phase 4 review polish: chart labels, Fogwatch's south, outpost berths

**Status:** Proposed (2026-10-25). Waiting on the art director and Guillaume's look at the
screenshots in [docs/reviews/phase-4-polish](../reviews/phase-4-polish/).

## Context

The Phase 4 review ([0188](0188-phase-4-review-and-release-gate.md)) listed the art director's musts
that block the release: Fogwatch's south tier was one big empty green plane and its shore a wide grey
band; the in-game chart named wind zones over uncharted water, showed the raw id "cold-sea", cut the
Stormbreak's name at its rim, and the labelled map ran "The Cold Sea (cold sea)" into "The Calving
Grounds"; Cinder Isle's berth sat in open water; Snowberry Isle had no pier and looked the same at
every town level.

## Decision

**Chart labels.**
- A wind zone's name on the in-game chart waits for its water to be charted (`chartedAt`, 0156),
  like the islands in it, and slides in from the sea's rim so the edge never cuts it.
- A zone whose name already says its kind is named alone: "The Cold Sea", not "The Cold Sea · cold
  sea" (`zoneLabel` in `src/i18n`, whole-word match). The `cold-sea` kind gets its words in English
  and French.
- The labelled map (`npm run chart`, the editors' chart): a zone's name takes the first free spot
  stepping toward the sea's middle from its centre (and a little to either side), clear of the other
  names and of the islands, and inside the rim.

**Fogwatch's south** (with `npm run island`, at the 6,000-triangle budget):
- The south arm by the quay gets a croft: a turf house at Town, a second at Port town, a kailyard,
  two field walls, a peat stack and sheep. The south shelf gets a small croft, a kailyard, field walls
  and a peat bank. The coast's beach is half as wide (0.05 → 0.025), so the grey band is narrower.
- To stay under budget: one fish drying rack, two boulders that sat on top of two others, three
  cairns and three marram tufts (dune grass on turf) are gone.

**Cinder Isle's berth is right in the game.** Cinder Isle rises after `emberhold-glass` (0166), and
land rises only out of the boat's sight or while docked clear of it. The shots tool moored first, so
the island never rose and the boat lay in open water. Now `questAt` (the shots' `--quest`) and a quest
test bring the land up to date while the boat is still at her start, and the test berth looks for
water in the land as it stands (ice gone after a quest is open water). Outpost shots take
`--quest outpost-west:settler --town cinder-isle:N --moor cinder-isle`.

**Snowberry Isle**: a pier on the cove side (east, toward the Snowberry Pack that clears after
`rimewick-jam`), a warehouse and a berry drying rack at Village, two more houses, two lamps and a
second pier at Town. `npm run shots -- --moor snowberry-isle` now finds its berth.

`npm run shots -- --charted` also hands over every chart area, since zone names need charted water.

## Consequences

- A player who sails into a zone before its chart is handed over sees its dashed edge under the fog
  but not its name; the name appears with the chart.
- Fogwatch has no triangles left. The art director (2026-10-25) keeps the terraces (Fogwatch's Faroe
  look) and proposes, as a follow-up after the release, about 7,500 triangles for the four main ports
  only (6,000 stays for every other island), checked with `?bench` first since the tablet is
  fill-rate bound; the room then goes to two or three more crofts and dykes on the lowest shelf.
- Art director: approved for v0.4 (2026-10-25). Guillaume's look still to come.
- Shots and quest tests of land that rises after a quest now show it from the first frame.
