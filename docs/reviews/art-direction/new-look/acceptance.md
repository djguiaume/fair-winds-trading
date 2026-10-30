# New look: island-by-island acceptance (#277)

One row per shipped island, ring first, then south, north, west, east. A group goes to the art
director first, then Guillaume, in one round. Record the approval and any unresolved fix here.

Make the sheets (High and Low at one pose, plus the coast chart: the island file's coast against
the new look's smoothed coast):

```
npm run review -- --sea ring              # every island of a sea (ring|south|north|west|east)
npm run review -- calda,saltmere --zoom 1.4 [--night]   # chosen islands, closer, at night
npm run chart -- --around calda --coast   # the coast overlay alone
```

Status: `todo`, `sheet` (sheet made), `AD ok`, `ok` (Guillaume), `fix` (see note).

## Ring (12): calda, saltmere, westholm, south-cay (Stonehaven), skerry, bell-rock, abbey-head, watchman-key, lantern-rock, greyback-ridge, gull-hook, teeth-rock

Status: ok (AD 2026-10-29, Guillaume 2026-10-30, PR #353). Fixed in the round: Low shore band and foam ring, night shallows (`graphics.json › water.depth.nightShallow`), cabin side windows (Calda), Stonehaven's faceted quarry tiers shrunk inside the smoothed slope (never make a smooth shape faceted to hide a problem). Nice to have: reeds or rocks on Greyback Ridge and Gull Hook's sand; Stonehaven's close-zoom slopes are big flat triangles.

## South (5): sunreach, sunreach-south, palm-key, lone-palm, two-palms

Status: AD reviewed 2026-10-30; fixes made, waiting for the AD re-check, then Guillaume. Coasts match on all five. Fixed: Low's dark blobs in calm zones (the calm sheet now clears the coarse ocean's sag), Low's sand ring on low beaches (waves calm by the shore on a coarse grid, `graphics.json › water.shoreCalm`), crisper ground zones on small islands (finer colour texture, `terrain.json › draw.fineTexels`), Lone Palm's palm 1.5x plus a second small palm. Separate: Palm Key's town level 3 visual step (AD handover).

## North (8): rimewick, snowberry-isle, whitefell, lead-rock, cairn-holm, seal-rocks, selkie-rock, old-blue
## West (10): emberhold, the-smoulder, organ-pipes, cinder-isle, steam-holm, spark-rock, the-chimneys, the-chimneys-2, the-tongs, the-tongs-2
## East (9): fogwatch, the-giant, his-wife, amber-strand, puffin-holm, lamb-holm, broch-isle, the-kittiwakes, sandwick-holm

Status: todo.

## Carried over

- Traffic boats: recheck hull, band and `wakeEdge` colours on depth water and haze (#331).
- Fogwatch and the east sea: heath and bracken ground patches (new `palette.json` ground, used in the fog and strand styles), more boulders and walls (#275).
- Emberhold scrub: bigger birch clumps near the lanes (`forests.json › biomes.west`, or the island's grove/density) (#275).

## Gate

The v2 fallback is removed, or the new look made the default, only after every row is `ok` and the visual, gameplay and performance gates (`?bench`, `npm run balance` on all three levels) pass.
