# Old-tablet test

The physical device check asked for by decisions 0006, 0022 and 0116, using the `?perf` readout (0148).

## Round 1 (2026-10-24, v0.4.150)

Device: Android 10 tablet, Chrome 138, 8 cores, 2 GB memory, screen 800×1280 at 1.5, held in portrait. Graphics on Auto; the game picked **Low** at start (2 GB memory) and made no further drops. All hazard switches on, currents and wind zones included.

| Sea                     | Sailed  | Avg FPS | 1 % low | Frame ms p50 / p95 / worst | Slow ≥ 50 ms     | Hitches ≥ 100 ms | Draws / triangles |
| ----------------------- | ------- | ------- | ------- | -------------------------- | ---------------- | ---------------- | ----------------- |
| Today's sea             | 0:02 \* | 38.5    | 19.9    | 33.4 / 50.2 / 50.2         | 4 of 78          | 0                | 13 / 10.7k        |
| Stress sea (`map=stress`) | 2:24    | 35.0    | 19.9    | 33.4 / 50.2 / 89.4         | 521 of 5041 (10 %) | 0                | 18 / 12.0k        |

\* Only two seconds were counted (a card or the port was open most of the time); needs a re-run.

Canvas 719×1042 at 0.90, which is the Low cap of 750 000 pixels.

### Reading

- Frames land on 33 ms or 50 ms, the tablet's 60 Hz screen refreshing every second or third time: about **30 fps with dips to 20**. Playable, not smooth. No stutters over 100 ms.
- The 46-island stress sea costs only about 10 % more than today's sea at the same draw count range, so the 5x map (0115) is not the problem.
- The game already sits at its lowest level with few draw calls and triangles, so the likely limit is fill rate: how many pixels the graphics chip can shade per frame.

### Next

Guillaume asked for a test that plays itself, so round 2 uses the automatic benchmark (decision 0154) instead of free sailing. It sails the same route three times (full, 0.7 and 0.5 resolution). If the 0.7 and 0.5 passes run clearly faster, fill rate is the limit and the fix is a lower pixel cap for Low.

## Round 2 (2026-10-30, v1.1.309, stress sea, `?bench&map=stress`)

Same Android device, Auto picked Low and the benchmark kept it. Canvas 719×1042 at full resolution; 24 draws and 16 340 triangles at the end. Every hazard on, including the storm belt, fog and ash.

| Pass                     | Avg FPS | 1 % low | Frame ms p50 / p95 / worst | Slow ≥ 50 ms     | Hitches ≥ 100 ms |
| ------------------------ | ------- | ------- | -------------------------- | ---------------- | ---------------- |
| full (719×1042)          | 28.3    | 14.9    | 33.5 / 50.2 / 1941         | 340 of 1977      | 11               |
| 0.7 resolution (503×729) | 37.6    | 19.9    | 33.4 / 33.5 / 67.0         | 49 of 2630 (2 %) | 0                |
| 0.5 resolution (359×521) | 41.9    | 20.0    | 16.8 / 33.5 / 83.7         | 32 of 2927 (1 %) | 0                |

Only the stress sea was reported; today's sea was not needed for this question.

### Reading

- Fewer pixels, steadily faster frames: **the device is limited by fill rate**, as round 1 suspected. At 0.7 resolution nearly every frame lands at 33 ms or better and nothing stutters.
- The one 1.9 s frame and the 11 hitches are all in the first, full-resolution pass. A guess, not measured: the first lap is also the first time each island and its trees are built, and the later laps reuse them. If so a player meets that cost once per island on first approach; worth a closer look separately.
- Decision [0240](../decisions/0240-lower-pixel-cap-for-low.md): Low's pixel cap drops from 750 000 to 400 000 (about 0.73 of today's width and height on this device).

## Round 3

Guillaume noticed the stair-stepped edges on the softer Low picture. Low and Medium draw without antialiasing (only High and Ultra multisample), and the edges show more at fewer pixels. What antialiasing costs this device is unknown, so `&aa=1` turns it on for the test ([0154](../../decisions/0154-automatic-device-benchmark.md), pictures in the project files). After the release, repeat the benchmark on the same device twice and paste both Copy reports; the second report's first line says "antialias forced on".

1. https://djguiaume.github.io/fair-winds-trading/?bench&map=stress (Low at the new 400 000-pixel cap; expect about 37 fps, no hitches)
2. https://djguiaume.github.io/fair-winds-trading/?bench&map=stress&aa=1 (the same with antialiasing)

If antialiasing costs little (about 33 fps or better with no hitches), Low and Medium get the `antialias` flag in `quality.ts`; if it costs a lot, Low stays as is, or its cap goes up a little instead.

## Round 2 links (used)

1. https://djguiaume.github.io/fair-winds-trading/?bench (today's sea)
2. https://djguiaume.github.io/fair-winds-trading/?bench&map=stress (stress sea)

For comparison, headless desktop Chromium with a software GPU (not a device result) at 800×1280, level High: full 11.6 fps, 0.7 → 18.0, 0.5 → 25.0 on today's sea.
