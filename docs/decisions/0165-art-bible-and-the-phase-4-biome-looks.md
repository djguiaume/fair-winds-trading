# 0165. Art bible and the Phase 4 biome looks

**Status:** Accepted (2026-10-24). Guillaume still gives the final OK on every visual.

## Context

Phase 4 wave 2 starts three sea threads at once (west fire, north ice, east fog and the storm belt). Each adds new ground, houses, props and tints. Without one reference they would drift apart, and the art choices so far (water A, islands B2, boats D, characters B, UI D, props as data, the tropic south) were spread over a dozen decisions. Guillaume asked for creative biome islands (fire after Iceland with lava rivers, black ground with glowing red fractures and black beaches; ice after Greenland, Svalbard and Antarctica with snow and ice textures, snowmen and snowy trees; fog after the Faroe Islands or Scotland), everything as data and editable in the editors, and suggested an art director that keeps the game cohesive and talks with the storyteller.

## Decision

1. **[Art bible](../art/art-bible.md)** in `docs/art/art-bible.md`: the look in one sentence, the decided parts and where, nine rules every visual follows (flat shading and vertex colours, named colours in data, storybook never grim, readable at the game camera, one signature per port, night shows the way, everything editable, cheap on the 2 GB tablet, hazards switchable), the shared palette and per-biome direction.
2. **Shared mechanisms, built once:** ground materials as data (`palette.json` `grounds`, a style picks its beach, cliff and cap grounds; built by the north thread), glow through the existing lit-window material with an ember day/night tint (lava cracks, lava rivers, craters), a river feature in island files with `kind: "water" | "lava"` (built by the west thread, reused by the east for a waterfall), and a per-sea or per-area **look** tint in the sea files (north first, east adds fog density).
3. **No image textures for now:** snow and ice "texture" is per-face colour jitter; a single shared detail texture is the fallback only after a measured test and Guillaume's OK.
4. **An art director thread** answers the sea threads' look questions, reviews their screenshots and charts before Guillaume sees them, and agrees with the head storyteller where look and story meet (port signatures, objects that appear after quests).

## Consequences

- Sea threads build looks from the bible without asking Guillaume first; he sees all shots, charts and schemas before any visual merge.
- New colours, grounds and tints are data, so the island builder, sea editor and `npm run island` / `npm run sea` gain them as each mechanism lands.
- The bible is updated when a biome's look is approved or changed.
