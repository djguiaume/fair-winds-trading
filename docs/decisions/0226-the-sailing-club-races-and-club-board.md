# 0226. The Sailing Club races and club board

**Status:** Proposed (2026-10-28).

## Context

v1.1 "The Sailing Club" adds new races, with fixed storms for some ([0225](0225-fixed-storms-in-races.md)), and a place for best times. The storyteller's rulings and words are in [club-words.md](../story/club-words.md), issue #260.

## Decision

- **Eight races, series `regatta-club`** ("The Sailing Club", pennant `pennant-club`, a navy and white burgee, won with silver or better in all six). All open once `race-greyback` is done.
  - Home waters, no storm: `race-mill` (Westholm), `race-light` (Stonehaven, round Teeth Rock), `race-abbey` (Saltmere, round Bell Rock to Abbey Head). Gold 80 / 160 / 260.
  - One fixed storm each, also needing that sea's outpost: `race-coral-squall` (Sunreach, Lone Palm), `race-snowberry-squall` (Rimewick, Snowberry Isle), `race-sandwick-squall` (Fogwatch, Sandwick Holm). Gold 140 / 280 / 450. The storm crosses one leg at a set time; no text depends on it, and with Storms off the pars still hold (0225).
  -   - Two long one-way crossings of about five minutes through several biomes (Guillaume, 2026-10-28), no storm: `race-meridian` (The Meridian Run: Sunreach north through the ice gate and the ring to Rimewick; needs the south and north outposts) and `race-great-reach` (Emberhold across the ring to Fogwatch; needs the west and east outposts). Both need `race-greyback`. Gold 200 / 400 / 650. Words and directions are the storyteller's. The Meridian has a quartering breeze at 12 kn; the Great Reach a light 7 kn from the west-north-west so the long reach takes about 5 minutes. The finish needs no sail home.
  - Courses, storms and pars are data in the quest files; pars come from `npm run race -- --all --pars --write` on all three levels. Authoring is the quest builder and `npm run race` as for every race.
- **Club board** on the Quay tab at Saltmere, before Rook's book (`src/ui/clubBoard.ts` model, `clubBoardView.ts` html, `club.css`). It appears once a club race is open. Per series: each race met with its best time and medal for the ship sailed now, that ship's par, "Not sailed yet", and "Race again" on sailed races; a header counts medals of all races. Only the captain's own times, no ranking. Words: `club.*`.
- **Best times per ship class**, like the pars: a race's progress keeps `bests` (class → time) beside the overall `best` and medal (`src/sim/raceRecords.ts`, also in the save code). A record from before counts for every ship until the ship sails it.
- Wren opens the club on the offer of the first club race (`club.open`); each race has a `.race.done` line shown after its result card.

## Consequences

- The first-win gold of all races is now 12,340 (the club adds 6,610); the regatta test's ceiling moved from 6,000 to 13,000. Rewards stay pride-sized next to the rest of the economy, but this is a number to watch.
- The save code carries each class's best time; links made before this change are refused by the fingerprint, as for any new quest.
- Courses are first placements on the chart: moving a mark means re-sailing that race's pars.
