# 0221. An Ultra quality level for desktop and Xbox

**Status:** Accepted for scope (2026-10-26, Guillaume: "I agree with your plan"). The look itself is approved later from screenshots (art director, then Guillaume), as every visual is ([0165](0165-art-bible-and-the-phase-4-biome-looks.md)).

## Context

Players say the game does not look good enough on computers; on phones it is fine (Guillaume, 2026-10-26). He pointed at *Traffic Architect* (Green Signal Games, Steam, WebGL 2) as the level to reach, "achievable, not AAA", and said its terrain, assets, water, shadows and reflections all look better than ours. He is open to dropping the old tablet, to native apps and to several builds, with the web staying the preferred platform.

A read-only study (thread "Reach Traffic Architect's graphic level", review in [docs/reviews/desktop-graphics](../reviews/desktop-graphics/README.md)) found:

- *Traffic Architect*'s models are as simple as ours. Its look comes from a camera that shows the horizon, a low sun with soft shadows on everything, smooth rolling ground with soft colour variation, dense instanced woods and traffic, tone mapping and haze, and water with depth colour and sky reflection. It runs on WebGL 2, like us.
- A prototype in the real game (a page script, no game code changed) with a lower camera, a low sun, soft 4096 px shadows on all lit meshes, neutral tone mapping and ground-truth ambient occlusion (three.js `GTAOPass`) showed the camera and sun make the biggest change, shadows and occlusion add depth, tilt-shift blur is not worth its cost, and night gets too dark without retuning.
- Today our best level (High) has shadows from island ground only, no tone mapping, anti-aliasing and a 1.5 pixel ratio cap, and the art bible forbids post-processing passes (rule 1) to keep the 2 GB tablet smooth (rule 8).

## Decision

1. **A fourth quality level, Ultra**, in the same web build. Auto picks it only on desktop GPUs and the Xbox; Low, Medium and High stay as they are, so phones and the old tablet are untouched and **old-tablet support is not dropped**. The player can still choose any level in Settings.
2. **Split over two updates:**
   - **v1.1 (about 2 weeks):** the Ultra render pipeline (neutral tone mapping; soft shadows that follow the camera on all props, towns and boats; ambient occlusion at half resolution; anti-aliasing at full resolution; sky gradient and horizon haze), the water upgrade (depth colour, softer shore foam, Fresnel sky reflection; the sky reflection also on High if it is cheap), night retuned for the new colour response, and a lower tilt limit (about 35°) for the turnable camera already in the v1.1 plan.
   - **v1.2, "a new look" (about 4 to 6 weeks):** smooth-shaded rolling terrain with colour variation and grass tufts (rocks and cliffs stay faceted), new tree and house recipes grown into dense instanced woods and fuller towns, and planar reflections of islands and boats on Ultra. These change every island, so they are reviewed island by island.
3. **No engine change, no WebGPU yet, no native app for graphics.** The effects come with three.js; WebGPU waits until Ultra runs short of frame time; a Tauri or Electron desktop app is a store decision ([0204](0204-selling-on-android-iphone-and-xbox.md)), not a graphics one. No paid tools or assets.
4. **Art bible:** rule 1 ("no post-processing passes") gets one exception, the Ultra level. Rule 8 (cheap on the tablet) keeps holding for Low and Medium. v1.2 will amend "flat shading everywhere" for terrain in its own ADR once the art director has seen it.
5. **Everything editable:** every new number (tone mapping exposure, shadow size and softness, occlusion radius and strength, haze, water colours, the Ultra tilt limit) lives in data (`tuning.json` or `palette.json`), shows on the tuning page, and each effect has a Settings switch (rule 7, decision [0093](0093-data-driven-content-and-authoring-tools.md)). `npm run shots` gets a `--quality ultra` option so agents can show it.

## Consequences

- Frame budget: Ultra aims for 60 fps at 1080p on a mid desktop GPU and on the Xbox. Shadows plus half-resolution occlusion are estimated at 2 to 4 ms per frame there; `?bench` measures it on a real desktop and an Xbox before v1.1 ships. If the Xbox falls short, it gets High plus the water upgrade.
- The style E reskin ([0220](0220-a-game-like-ui-skin-style-e.md)) mockups are shot on the Ultra look once the pipeline lands, since tone mapping shifts the 3D colours.
- Screenshots in docs taken on High stay valid (High does not change); new review shots for desktop use Ultra.
- Auto quality must not step a desktop down from Ultra to High for one slow frame; it uses the same step-down rule as today, measured over seconds.
