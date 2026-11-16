# 0325. Follow cam sound

**Status:** Accepted (2026-11-16).

## Context

Nothing in `src/audio` knew which camera was on (issue #555, from the v1.9 whole-game review). The follow cam looks like being aboard but sounded like the sea camera.

## Decision

The mix eases with the camera's blend (`rig.chase.eased`, 0 to 1), passed to the sea listener and into `SoundsHere.aboard`. `audio.json` › `boat.aboard` holds multipliers on the sea camera's layers (wash louder and brighter with speed, waves and wind lower, luffing heavier), a rig creak when a gust lifts the wind `gustKn` over its slow average (`GustWatch`, at most once in `every` seconds) and a block rattle on a tack. Both are effects of the sound list (`rig-creak`, `block-rattle`), only played in proportion to the blend. All of it is edited on the Sounds page (boat) and heard with `npm run sound -- sea <id> --aboard`.

## Consequences

The sea camera's mix is unchanged (every multiplier at a blend of 0 is 1). Numbers were set by measurement; Guillaume's listen on desktop and phone may move them. No extra audio nodes: only levels and one filter frequency glide.
