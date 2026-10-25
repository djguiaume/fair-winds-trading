# 0207. The roadmap after Phase 4

**Status:** Proposed (2026-10-25). Waits on Guillaume's pick of a Phase 5 option and his answers to
the questions in the [review](../reviews/whole-game/README.md#questions-for-guillaume).

## Context

Phase 4 was released as v0.4.226 ([0206](0206-phase-4-release.md)). Before the Phase 5 brief,
Guillaume asked for a review of the whole game and of the roadmap, which he called indicative.
The [review](../reviews/whole-game/README.md) checked `main` at `901b25c` with the agent tools
(checks, 1180 tests, balance 28/28 on all three levels, screenshots) and asked the head storyteller
([story view](../reviews/whole-game/story-view.md)) and the art director
([art view](../reviews/whole-game/art-view.md)).

It found the direction of [0120](0120-communities-and-home-island.md) right, and these weak points:
no other ship ever sails; the four seas follow one story template and the people go silent after
their arc; sound is one theme and two effects; the harbour screen hides the town; racing missions
and visible damage were asked for and never built; and Phase 5 as written (pirates that hunt
merchants, guns, a warship line) breaks the storyteller brief's first rule (no villains, no danger
to people, kids can read every line) and is the costliest system on the roadmap.

## Decision

**Must-haves (Guillaume, 2026-10-25), whatever option is picked, first in Phase 5:**

- **The home island's build view is fixed.** The arc giver names the plot and the two buildings on
  the done card (building names from the build-spot data, brief rule 12 changed by the storyteller);
  the next docking at Skerry opens the choice on that spot; Skerry gets a harbour screen with an
  Island tab (spots, warehouse, repairs), and the spot circles over the island only show while a
  choice waits. Mockups first.
- **The central sea gets the outer seas' review:** every ring island's look and detail at each town
  level and at night against art bible rule 10, density, landmarks and names, the story's places on
  the grown map and each port's winter damage before and after its arc; then a catch-up pass, with
  screenshots to Guillaume.

Proposed for the rest, Option B of the review:

1. **Phase 5 becomes "A living sea":** (a) other ships that sail by the same wind model (fishing
   boats, coasters, far-sea visitors), capped per quality level, as data editable in the sea editor
   and `npm run sea`, with the sounds of the sea and harbours; (b) **rovers**, the storyteller's cozy
   pirates: hard-up crews who shadow loaded ships and take a share of the hold if they come
   alongside, outsailed with point of sail and draft, and brought home one crew per sea through a
   story arc; nobody hurt, nothing fired, no ship lost; the Pirates switch (0010) and a per-level
   scale (0083) stay; (c) **regattas**, the racing missions of 2026-10-19 with a friendly rival.
2. **No guns track and no warship line** (storyteller). [0035](0035-three-ship-lines.md) keeps the
   starter, swift and hauler lines; the answer to a rover is speed and draft. The art director would
   keep cozy cannon fights (puffs, splashes, nothing sinks, the pirate strikes its flag) and the
   ketch, brig and frigate; Guillaume decides (review question 2).
3. **Sound of the sea and harbours** (an ambient bed per sea, a harbour bell) and **visible hull
   damage** move from Phase 7 into Phase 5; **flags as data** come with the rovers; the **port screen
   gets a header band** (signature, keeper's portrait, town level). **Standing orders** (small
   repeatable asks from people whose arc is done) and **a harbour screen that shows the town** are
   small Phase 5 items.
4. **Phase 6** becomes "friendly rival companies (maybe)", never enemies.
5. **Seeded maps and seasons** move out of scope for now (seeded maps fit only a sandbox). Tides,
   the great expedition and steam stay later; they would reuse Phase 5's ships.
6. **The roadmap is rewritten short** ("Now, Next, Later", one line per phase, links to decisions);
   its history moves unchanged to `docs/roadmap-history.md`, and the roadmap picture is redrawn.

Rejected for now: Option A (pirates as written) for the reasons above; Option C (a polish-only v1.0
phase first) because it leaves the empty sea, the main weak point, in place. Its polish items join
Phase 5 instead.

## Consequences

- The ring review and the home island fix can start as soon as Guillaume says go, before the rest
  of the brief: they don't depend on the pirate choice.
- The Phase 5 brief is written by this review's thread with the head storyteller and the art
  director once Guillaume picks, then split into build threads: traffic (sim, render, data, editor,
  CLI, `?bench`), sound, rovers story and chase, regattas.
- The performance budget must be measured with other ships on the old tablet's Low quality before
  their number is set ([0116](0116-performance-priorities.md)).
- Every rover quest must play with the Pirates switch off (storyteller rule).
- The roadmap edits wait for Guillaume's answers; nothing in `docs/roadmap.md` changes in this PR.
