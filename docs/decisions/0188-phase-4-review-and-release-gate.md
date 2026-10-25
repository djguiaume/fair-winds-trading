# 0188. Phase 4 review and release gate

**Status:** Proposed (2026-10-25). Guillaume asked for the Phase 4 review before releasing v0.4.x;
the gap list waits on his OK.

## Context

Phase 3 was released once its "done" list was empty on `main` ([0138](0138-phase-3-release.md)).
Phase 4 has no written "done" list yet. The four seas are laid out, filled and mostly written
([0137](0137-phase-4-biomes-and-founded-outposts.md), [0147](0147-phase-4-story.md),
[0179](0179-four-equal-sea-quarters.md), [0180](0180-even-density-across-the-four-seas.md)).
The review in [docs/reviews/phase-4-review](../reviews/phase-4-review/README.md) checked the roadmap,
the scope and the story brief against `main` at `afc2d5a` with the agent tools (check, balance on
the ring and on the grown sea, chart, shots).

## Decision

Phase 4 is released (v0.4.x, the same way as [0062](0062-github-releases-per-phase.md) and 0138)
once these are true on `main`:

1. **The grown sea is the main game's sea.** No `?map=phase4` needed: a new game and an old ring
   save both sail the grown sea, the outer seas start fogged, the dev badge is gone, FW2 codes still
   load, the editors and tools default to it, and `?bench` runs on it.
2. **All four seas' stories are playable:** the east's `westholm-letter`, `fogwatch-amber` and
   `outpost-east`, with Elias Morrow and Pip Holt in `characters.json` (owned by the thread "Write
   the east sea's quests").
3. **The balance bots play the grown sea as the game opens it** (ring first, each sea after its
   letter), with late-game targets for the far-goods routes, and every check passes on all three
   difficulty levels. Today `npm run balance -- --map phase4` fails 8 of 19 checks.
4. **A full playtest of a new game on all three levels** through every arc, with screenshots
   Guillaume has seen.
5. **The art director's musts are done:** Fogwatch's south tier, the chart's wind-zone labels
   (hidden until charted, no raw ids, no clipping or collisions), and the outposts, Cinder Isle and
   the night ports approved from screenshots.
6. **The closing beat `four-winds`** (Rook at Skerry once all four outposts stand, a signpost on the
   pier), from the head storyteller.
7. **No Phase 4 PR left open** (today #193, #195, #199).

Not part of the gate, kept for later: outpost build spots (0157), the Xbox couch text size and
no-typing save transfer ([0183](0183-play-in-the-xbox-browser.md)), the big-event panel
([0174](0174-event-panel-for-big-story-events.md)), a density warning in `npm run check`, seeded
maps, seasons and tides, and Charlotte's old-tablet `?bench` run (any time, never blocking).

## Consequences

- Each gap gets its own build thread; the release thread writes the notes and the release ADR when
  the list is empty, as for Phase 3.
- The release PR opens Phase 5 (pirates): `package.json` to `0.5.0` and the menu to "Phase 5".
