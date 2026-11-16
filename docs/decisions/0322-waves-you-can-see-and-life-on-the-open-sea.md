# 0322. Waves you can see and life on the open sea

**Status:** Accepted (2026-11-16). Build thread for #551 and #546; Guillaume sees it in the end-of-release review.

## Context

From the v1.9 whole-game review: from the follow cam at 8 to 12 kn the sea was a flat plane and harbours were glass (#551); from above, the open sea away from land was one flat blue with thin streaks (#546). The waves were true to the model but small for the boats (a fresh breeze raised chop about 0.4 u crest to trough under an 18 u sloop) and nearly sinusoidal (shift = steepness × height).

## Decision

- **Scale the field, not the sea state.** `waves.json › bands.*.scale` multiplies each band's component heights in the wave field (swell 1.5, chop 1.8, ripple 1.5): what boats ride and the ocean draws stay one model (0245). Drag (0256), foam and surf read the sea state's height, so sailing, balance and foam tuning are unchanged. Sharper chop (steepness 2) and swell (0.6); the meta range is now 0 to 6.
- **Shade slopes by the view** (`look.viewTone`, `viewToneMax`): a stylised Fresnel contrast; slopes facing the camera darker, turned away lighter. It is what makes the swell read from 11° and keeps the mean colour.
- **Her middle rides too** (`motion.ride.middle` 0.5): the rise mixes the sea under her middle into the four hull samples.
- **The coast keeps some waves** (`coast.keep`: ripple 0.6, chop 0.15) in both `bandCalm` and the shader's `coastCalm`.
- **Glint fades earlier** with a steep view (`water.glintFadeFrom/To` 0.4 / 0.6): taller facets near the camera made a glare blob behind the boat facing the sun.
- **Swell lines** (`look.swellTone`): the vertex shader keeps the swell's own height; its troughs shade darker.
- **Cloud shadows** (`src/render/seaClouds.ts`, `waves.json › clouds`): value noise drifting downwind, colour only, in the ocean shader on Medium and up (define `CLOUDS`); none at night or under overcast (`gloomGone`). `?off=clouds` device switch. No new pass.
- **No finer mesh ring.** The issue proposed one; with taller waves the existing grid's facets read as the low-poly style, so the triangle budget stays.

## Consequences

- Sheets and numbers: [docs/reviews/v1.12/water](../reviews/v1.12/water/README.md). One-atmosphere pairs are unchanged within about ΔE 2; the top view moves by at most ΔE 2.5 at the open sea.
- Boats sit up to a quarter of the sea's height off the water at her middle in a 20 kn sea (test relative now); a storm sea stands up to `highestWaves()` (about 6.5 u).
- Clouds on the sea only: an island under a passing shadow stays lit. Matching ground shadows would need the ground shader (follow-up if the art director wants it).
- Shader cost: a normalize, two noise taps and a varying; headless frame time within noise on Medium and High. Real-device `?bench` joins #377.
