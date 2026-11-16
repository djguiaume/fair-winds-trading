# Softness, detail and texture (#572)

Decision [0327](../../../decisions/0327-soft-surface-patterns-near-the-camera-and-smooth-hulls.md).

## Final (for Guillaume's end-of-release review)

- [final-town.jpg](final-town.jpg) and [final-sail.jpg](final-sail.jpg): before (High) against
  after on High and on Medium (patterns, flat hulls), same poses as the variants sheet. The
  crew and spray in the after rows are #553/#554 (merged meanwhile), not this part.
- Art director's pick (2026-11-16): A's soft edges, walls, roofs and land wood (quays, signs,
  sheds) at ±6 %, hull planks, decks and sail seams at ±10 %; fade ranges as below.

## Cost (`npm run perf`, headless 1280×800, medians of three runs, main → this branch)

| | draw calls | triangles | graphics memory |
|---|---|---|---|
| High, sailing chase | 31 → 32 | 143k → 143k | 62 → 63 MB |
| High, docking chase | 56 → 56 | 238k → 238k | 63 → 63 MB |
| High, sailing (top) | 26 → 31 | 156k → 155k | 63 → 62 MB |
| Medium, sailing chase | 23 → 23 | 42k → 42k | 17 → 18 MB |

The patch adds no mesh, triangle or download; the +5 calls on top-view sailing come from what
was in view in that run (boats and folk move), not from the patterns (not checked further). The software renderer's frame times say nothing about a GPU's pixel cost; on real
devices compare `?bench&quality=high` against `&off=surface` in the device round (#377).

# The variants sheet

v1.13 part 1. The art director picked (conditions in `docs/reviews/art-direction/v1.13/README.md`).
High, desktop, rows today / A / B / C.

- [sheet-town.jpg](sheet-town.jpg): Amber Strand from the follow cam (house, sign, quay, sloop),
  noon and golden hour, and from above at the closest top zoom.
- [sheet-sail.jpg](sheet-sail.jpg): the sloop on a beam reach off Westholm (sail and hull close),
  noon and golden hour, and the usual top view.

## The variants

| | What changes | Tune file |
|---|---|---|
| Today | main | `src/today.json` |
| A | hull shaded round between its strakes (rail, keel and transom stay crisp), softer High shadow edge (radius 2 → 4); AA on High was already on | `src/A.json` |
| B | A + patterns at ±6 % lightness: planks (hulls, decks, quays, signs), plaster, stone, roof tiles, slate, thatch, sail cloth seams | `src/B.json` |
| C | A + the same patterns at ±10 % | `src/C.json` |

## How it works

- One shader patch for the Lambert materials (`src/render/surfaceDetail.ts`, patterns in
  `surfaceGlsl.ts`): no image file, the pattern comes from the model's own position, shifts only
  the face colour's lightness (never its hue; shadows keep their blue) and fades by distance.
- Which pattern: by palette colour name (`palette.json › surfaces`: `plank` → planks, `walls` →
  plaster, `roofs` → tiles), changed per island style (`styles.stone.surfaces`: stone walls, slate
  roofs), or a recipe part's own `surface`. Hulls are planks, sails canvas.
- Fade: from above (the top view) patterns fade from 40 to 70 units, so the top view stays as
  clean as today (column 4); seen level (the follow cam) from 50 to 130, because the towns stand
  40 to 100 units away there. Patterns finer than a few pixels fade too, so nothing shimmers.
- Levels: none on Ultra-low and Low; patterns on Medium; patterns and smooth hulls on High and
  Ultra (`graphics.json › quality.*.surfacePatterns`, `softEdges`). `?off=surface` for the device round.
- The sea is not touched (its shader has no patch), so the follow-cam sea ΔE cannot move.

## Re-run

`npm run shots -- --list docs/reviews/v1.13/surface-detail/src/poses.json --chase --sizes desktop
--quality high --tune docs/reviews/v1.13/surface-detail/src/<variant>.json --out <dir>`, the same
with `src/top.json` without `--chase`, then `python3 src/compose.py <out.jpg> town|sail` (reads
`/tmp/claude-0/sheet/<variant>/`).
