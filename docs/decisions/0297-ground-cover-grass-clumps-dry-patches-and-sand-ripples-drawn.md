# 0297. Ground cover: grass clumps, dry patches and sand ripples drawn by the ground shader

**Status:** Accepted (2026-11-11).

## Context

v1.8 "A richer look" (issue #499, `docs/v1.8/brief.md`): the island ground was flat colour with a
faint noise, so it never caught the light the way Saltline's ground does. Guillaume picked the
mockup of PR #496 (`docs/reviews/saltline-lighting/ground-sheet-2.jpg`) and rejected its cliff
ledge lines. The art director's limits: bumps through the normal only, tints at most about 6% off
the zone colour, dry patches of warm grass `#a8b45c` on at most a fifth of a grass zone, none on
rock, slate, lava, snow or lanes, no ruled lines. No new textures or memory.

## Decision

The ground shader (decision 0239) draws a small cover inside each zone (`fieldGroundCover.ts`):

- **Grass:** three noise layers (clumps, tufts, blades). Each tints the grass a little and bumps
  the lit normal by its slope, so clumps have a sunny and a shaded side. Broad soft **dry patches**
  mix in `palette.json › colors.drygrass`.
- **Sand:** wind ripples as a bump only, their crests bent by a broad noise, and a faint grit.
- **Cliffs and zone edges are untouched.** Grass cover fades out with the slope; the cover follows
  the zone edge the shader already draws.
- **Which ground wears what is palette data:** `palette.json › grounds.*.cover` is `grass`,
  `heath` (relief without dry patches: moss, moor, heath, marram) or `sand` (beaches). Left out, a
  ground stays bare: rock, slate, snow, ice, lava, shingle. The shader gets them as bit masks by
  ground index, so there is no new texture and no extra texture read up close.
- **Numbers** are `terrain.json › draw.cover`, with ranges in `tuning-meta-cover.ts` that hold the
  art director's limits: the `?tune` panel and `npm run tune -- list terrain` / `set
  terrain.draw.cover.ripples.height 0.03` edit them (decision 0153).
- **Quality:** on for High and Ultra (`draw.cover.on`), off below; one shared switch uniform, set
  by the view each frame from the level and the Settings switch. Every layer fades out before
  one of its waves is under two pixels (`groundResolved`), so there is no shimmer far off.
- The noise gives its value and its slope in one evaluation, so the bump needs no extra samples:
  4 noise evaluations on a grass pixel and 2 on a sand pixel, against the mockup's 15 or so.

## Consequences

- No new textures, triangles, draw calls or memory. The cost is fragment work on ground pixels on
  High and Ultra only.
- Measured headless (software renderer, High, phone screen 844x390, docked at the start port, two
  runs each): median frame 407 and 576 ms with the cover, 418 and 557 ms without. The difference
  is inside the run-to-run noise, so the headless renderer cannot price it. On a device:
  `?bench&quality=high`, then `?bench&quality=high&off=cover`, and subtract the avg ms.
- Settings › Ground detail switches it off, on the levels that draw it (a graphics effect like the
  others, decision 0221).
- Medium stays off until a device run shows room (flip `draw.cover.on.medium`). On Medium zone
  edges are crisp, so it needs no other change.
- A level without crisp zone edges (Low) would see the cover follow the texel grid up close; keep
  it off there.
- A new ground needs a `cover` line in `palette.json` to get any; a test keeps rock, snow, ice and
  lava bare and the tints inside 6%.
- Ripples run one way on every beach (`ripples.heading`); they do not follow the wind.
