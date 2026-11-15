# 0318. One atmosphere in both views

**Status:** Proposed (2026-11-15). Option C recommended; the art director (v1.12) picks, Guillaume sees it in the end-of-release review.

## Context

Guillaume's condition for the follow cam to become the default (#573, 2026-11-12) is that both views share one atmosphere; on 2026-11-15 he named the vibrant top view the reference (art bible §14). Since [0284](0284-chase-camera-light-and-a-drawn-sky.md) the follow cam blended the fog to the drawn sky's pale horizon and mirrored a bluer sky at 70%, so the same place and hour read pale from behind and deep from above. Measured with the new `npm run shots -- --both`, the sea differed by ΔE up to 14 and the fog had two colours.

## Decision

- **One air.** Fog, background and the dome's horizon share one colour in both views: the sea's haze blended toward the sky look's horizon by `graphics.sky.air` (shipped 1). The dome draws the sky look above a haze line (`sky.hazeLineDeg`). The view only changes what geometry needs: how much sky is in frame and the mirror's angle.
- **A softer mirror from behind.** `sky.reflection` 0.7 → 0.25, now at night and in storms too; the follow cam keeps the top view's sea blue.
- **Clearer mid-distance in both views.** `weather.sight.near` 1.3 → 1.9 camera distances; the far end stays 2.4, so nothing past it shows and `camera.far` is unchanged.
- **Ultra's screen haze** fades out in the follow cam, whose top of screen is sky, not far sea.
- **A bluer day sky** (option C): `sky.looks.day` horizon `#7fc0e6`, zenith `#3f8ed6`.
- **The check.** `npm run shots -- --both` shoots each place from above and behind, measures the sea, land and sky inside the fog's start, prints ΔE and writes `colors.json`. Its sheet joins every PR that touches light, sea or sky. `npm run tune -- set` now also sets text values (sky colours).

## Consequences

- Sheets and numbers: [docs/reviews/v1.12/one-atmosphere](../reviews/v1.12/one-atmosphere/README.md). Top view changes by at most ΔE 2.3; sea drift ≤ 5 except looking into the sun on open sea (≤ 8).
- Land still measures apart (ΔE 13 to 38): the views see different faces. #550 (light with depth) and #552 (sky) build on the shared air and are judged with `--both`.
- No new pass, draw call or texture; one uniform and a smoothstep in the sky shader.
