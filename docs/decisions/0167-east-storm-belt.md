# 0167. East storm belt

**Status:** Proposed (2026-10-24). Waiting for Guillaume's OK on the look ([captures](../reviews/storm-belt/README.md)).

## Context

[0137](0137-phase-4-biomes-and-founded-outposts.md) gave the east sea fog and storms, and an "expedition storm belt" that could start there later. [0140](0140-wind-zones-and-currents.md) and [0144](0144-wind-zones-in-the-sim.md) built wind zones, including a `stormy-coast` kind that breeds extra storms at random. Guillaume's rules apply: hazards have their own Settings switch and no story step needs them (0137, storyteller brief), balance is checked on all three levels, everything is data and editable in the editors and from the command line (0153, 0161), the tablet is GPU fill-rate bound (0148), and he sees every new look before it merges.

A belt of random storms is only a gustier stormy coast. A storm belt should be a place you **time or skirt**.

## Decision

1. **A new wind-zone kind, `storm-belt`** (`weather.json` › `zones.kinds`): `squallEverySec` 240, `squallShare` 0.5, `squallGapSec` 28, `squallRadius` 60, `squallSpeed` 7 units/s, `gusts` 1.5. A belt is an ordinary `windZones` entry (outline + `headingDeg`), so the sea editor and `npm run sea -- add zone --kind storm-belt` make it, and any zone can override a number with `tune`.
2. **Trains and lulls** (`src/sim/stormBelt.ts`): every cycle starts with a train of squalls (a little late now and then, so it is a rhythm, not a clock) and ends with a lull. While the train lasts a squall enters the belt about every `squallGapSec` at a random place across it, and marches **downwind of `headingDeg`** to the far edge, building as it enters and dying as it leaves or strays outside the outline. Squalls are ordinary storms (wind spins round them and blows up to 1.9×, rain, gloom, cargo can go overboard on Captain and Old salt), a pure function of seed and time, so the save does not change.
3. **Difficulty:** each level's `stormBelt` knob in `difficulty.json` scales the train's share of the cycle: Fair winds 0.7 (trains 35 % of the time), Captain 1 (50 %), Old salt 1.3 (65 %).
4. **Settings › Storm belt** (`settings.stormBelt`), next to Wind zones. Off, the belt keeps its water and gusts but has no squalls and no HUD line. It also has no squalls with Weather, Storms or Wind zones off, during the tutorial's hold (0072), and squalls only form fresh when it comes back on.
5. **Timing in the HUD** (wording by the storyteller): within the storm warning range, under the wind: "Squalls in the Stormbreak · lull in about 1 min" or "Lull in the Stormbreak · squalls in about 2 min", computed for the boat's own place along the belt (a train reaches the far end later). The first belt met shows a one-time hint. Belt squalls do not raise one storm toast each.
6. **Look** (art director, 0165): the belt's water is darker slate-blue and choppy (`rough` 1, colours `water`, `waterLight`, `foam` in the kind, so they are data), with white whitecap streaks blown downwind and a thin edge of broken foam to steer by. One mesh per belt like the doldrums' glass, raised a little so Low quality's coarse ocean never pokes through, darkened with the sea at night. Squalls are the storm shadow discs, a little darker than before; up to five now show, the nearest the boat (before, two discs shared one opacity). Rain curtains were tried and dropped: from the game's high camera they drew stripes, and the disc plus the rain streaks read better at no fill cost.
7. **Checks:** the editor's and `npm run check`'s map checks want a `headingDeg` on a belt, keep every harbour approach a squall's radius clear of belts (`calm-harbours`), and the route checks want every pair of charted ports to connect with each belt as solid as an island (`skirt-belt`): timing a lull is a shortcut, never the only way.
8. **Balance:** the balance bots wait at a belt's edge for the lull (seeded legs), and the average leg adds the level's mean wait (`share² × cycle / 2`: 15, 30 and 51 s).
9. **Editors and tools:** the sea editor draws amber chevrons across a belt for the squalls' way and lists its numbers under "This zone only"; `npm run chart` uses the editor's tints and says "squalls march" in the legend; `npm run balance -- --map` and `npm run shots -- --sea` take a sea file merged round the ring (shared `tools/fw/seas.ts`); `shots --quality low|medium|high` and `--no-belt`.
10. **Place: the Stormbreak** (name approved by the storyteller), an east-west band about 110 units wide across y 230..340 from x ≈ 600 to the sea's edge, between Fogwatch (south) and Amber Strand (north), agreed with the east fog sea thread, which keeps islands and harbour approaches out of it and x 440..600 open as the way round. It goes into `src/data/seas/east.json` with whichever of the two PRs merges second.

## Consequences

- Seas without a belt are unchanged: no zones means no belt work, and the ring's balance is the same.
- Cost: one more zone mesh per belt, the same as the doldrums; the belt's squalls are a few storm discs; the sim looks up belts only near the boat.
- Measured with a test belt laid across the Sunreach to Palm Key leg (`npm run balance -- --map`, the Phase 4 sea): sloop legs 9 in 10 under 173 → 200 s on Fair winds, 173 → 248 s on Captain, 173 → 287 s on Old salt (medians +2 s). The bots only wait, never skirt, so this is the worst case. The Phase 4 sea's other balance checks were already failing before this and are the economy threads' work.
- Later: Elias at Fogwatch can hint at it ("Out past the fog the weather comes in breaths. Wait for the quiet one, captain."), the expedition can start past it, and the weather glass could forecast lulls.
