# 0247. Ultra-low quality level for weak tablets

**Status:** Proposed (2026-10-30).

## Context

Round 3 of the old-tablet test ([results](../reviews/old-tablet-test/README.md), issue #390) ran `?bench&map=stress` with the new look on Guillaume's weak Android tablet. Low at its 400 000-pixel cap ([0240](0240-lower-pixel-cap-for-low.md)) ran 25.5 fps with 5 hitches; the 0.7 pass (about 196 000 pixels) 31.7 and the 0.5 pass 34.2. Fewer pixels still help, but even a quarter of them miss 35 fps: the new look's ground shader (four texel reads, detail noise, cliff bands) and the water's per-pixel shore, depth and facet lighting cost this chip as well. Auto could not go below Low. The quality table itself was still TypeScript constants, a debt against [0093](0093-everything-data-driven.md).

## Decision

- A fifth level, **Ultra-low** (`ultralow`), below Low: 200 000 pixels at most, the plain water and ground below, 30 % of the trees, 2 other boats, Low's boat detail, wake and ground grid (`groundStep` 3, so the drawn coast and the buildings' footing stay as checked).
- **Plain water** (`PLAIN` in the ocean shader, `plain` in the table): shore distance and seabed depth are read per vertex on a finer grid (96 cells, 5 units) and the facet lighting from screen derivatives is dropped. The vertex waves stay: they cost no fill rate, and boats, wakes and the calm, rough and current sheets all ride the same wave height, so a flat sea would part from them. The waves show through the crest colour. Nothing in the plain path reads the wave state; it stays with the sea-state module and the shared wave shader (#281).
- **Plain ground** (`groundPlain` uniform, same material, no recompile on a level change): the filtered colour texture, and on slopes the nearest texel's cliff colour in its height band (two reads), no detail noise (`octaves` 0), no crisp edges.
- **Auto steps down to it**: the frame monitor's budget (40 fps over 1.5 s, a first wait of 2 s, 4 s between drops) moves to `graphics.json › auto`, and the game now steps one level down from Low as from any other. The benchmark still keeps one level. Auto's first guess is unchanged (weak touch devices start on Low).
- The whole quality table moves to **`graphics.json › quality`** with tuning meta, so the `?tune` panel shows it.

## Consequences

The weak tablet should land on Ultra-low after a few seconds on Auto, or be forced with `&quality=ultralow`. Round 4 reads `?bench&map=stress&quality=ultralow` on the device; the target is about 35 fps without hitches. If it falls short, the next steps are fewer pixels (the 0.5 pass of round 3 suggests about 150 000) or the per-vertex ground colour. Sailing is the same on every level: the level changes only drawing, and the traffic count, which never touched the balance bots. A phone on Low that runs under 40 fps also drops to Ultra-low, a softer picture in exchange for steady frames. Settings shows six buttons on the Graphics row.
