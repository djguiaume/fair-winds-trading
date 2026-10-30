# 0240. Lower pixel cap for Low

**Status:** Accepted (2026-10-30).

## Context

The old-tablet test ([results](../reviews/old-tablet-test/README.md)) ran the automatic benchmark (0154) on Guillaume's weak Android device (2 GB, Auto chose Low, 800×1280 screen) on the stress sea. Low drew 719×1042 pixels, the 750 000-pixel cap (0013), and the three passes gave:

| Pass                     | Avg FPS | 1 % low | Slow frames (≥ 50 ms) | Hitches (≥ 100 ms) |
| ------------------------ | ------- | ------- | --------------------- | ------------------ |
| full (719×1042)          | 28.3    | 14.9    | 17 %                  | 11                 |
| 0.7 resolution (503×729) | 37.6    | 19.9    | 2 %                   | 0                  |
| 0.5 resolution (359×521) | 41.9    | 20.0    | 1 %                   | 0                  |

Fewer pixels made the frames steadily faster, so the weak device is limited by how many pixels its graphics chip can shade, not by the number of islands, draw calls or triangles. Auto cannot step below Low, so nothing helped it.

## Decision

Low's drawing-buffer cap goes from 750 000 to **400 000 pixels** (`QUALITY.low.maxRenderPixels` in `src/render/quality.ts`). On the device above that is about 526×760, 0.73 of today's width and height, between the 0.7 pass (smooth) and the full one. The other levels keep their caps. The cap only binds on screens with more than 400 000 CSS pixels (tablets and windows); phones, at about 300 000, draw as before.

## Consequences

Tablets and large windows on Low get a softer picture (the sea and boat upscaled about 2.3× on the device above) in exchange for steady frames. The DOM (HUD, cards, chart) stays at native resolution. The expected result is about 36 fps average with no hitches on that device; this is read from the table above, not measured with the new cap, so round 3 repeats `?bench&map=stress` there. The benchmark's 0.7 and 0.5 passes are factors on top of the level's own canvas, so the new report's numbers read lower in pixels than round 2's. The quality table's numbers are still constants in `quality.ts` rather than data (decision 0093); moving them is a separate refactor.
