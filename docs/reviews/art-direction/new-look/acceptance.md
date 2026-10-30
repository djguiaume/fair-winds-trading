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

Status: ok (AD and Guillaume 2026-10-30, PR #367). Coasts match on all five. Fixed: Low's dark blobs in calm zones (the calm sheet now clears the coarse ocean's sag), Low's sand ring on low beaches (waves calm by the shore on a coarse grid, `graphics.json › water.shoreCalm`), crisper ground zones on small islands (finer colour texture, `terrain.json › draw.fineTexels`), Lone Palm's palm 1.5x plus a second small palm. Separate: Palm Key's town level 3 visual step (AD handover).

## North (8): rimewick, snowberry-isle, whitefell, lead-rock, cairn-holm, seal-rocks, selkie-rock, old-blue

Status: ok (AD and Guillaume 2026-10-30, PRs #367, #368). Snowberry Isle: waves calm under pack ice on Low. Lead Rock, Cairn Holm, Seal Rocks: rock tops raised into smooth outcrops, grey boulders. Nice to have: Rimewick Low's pale snow patch on the right hill; a touch of sky tint in the north water (park for the #276 haze pass).

## West (10): emberhold, the-smoulder, organ-pipes, cinder-isle, steam-holm, spark-rock, the-chimneys, the-chimneys-2, the-tongs, the-tongs-2

Status: ok (AD and Guillaume 2026-10-30, PR #368). Organ Pipes got more basalt columns. Cinder Isle stands only after `emberhold-glass`: `npm run review -- cinder-isle --quest outpost-west:supplies`.

## East (9): fogwatch, the-giant, his-wife, amber-strand, puffin-holm, lamb-holm, broch-isle, the-kittiwakes, sandwick-holm

Status: AD ok (2026-10-30), waiting for Guillaume. Fixed: dark blobs in the current water (sheets now a 6-unit grid), Broch Isle's broch, stones and wall. Nice to have: dune grass, driftwood and rock pools on Amber Strand (its growth stages); `?bench` check of the current sheets (#278).

## Carried over (done in #370)

- Traffic boats: hull, band and `wakeEdge` rechecked on depth water and haze; they read well, no change.
- Fogwatch: three `heath` ground patches (palette.json), small to stay inside the classic 6000-triangle budget. More boulders and walls were not added.
- Emberhold: three groves beside the lanes and birch scale 1.1 to 1.7 (`forests.json`).
- Amber Strand: more and darker marram (shared prop, so Two Palms and Sandwick Holm change a little), two larger pale driftwood, two boulders. Rock pools have no prop yet (v1.3 idea). Rimewick Low's white spot on the right hill's summit is not a ground patch (the ground there is untouched by any edit); it is how Low draws that summit, so it waits for v1.3.
- North sea horizon tint cooler (`palette.json` water.north.horizon).

## Gate

The v2 fallback is removed, or the new look made the default, only after every row is `ok` and the visual, gameplay and performance gates (`?bench`, `npm run balance` on all three levels) pass.
