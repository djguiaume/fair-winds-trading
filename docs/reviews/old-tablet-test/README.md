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

Guillaume asked for a test that plays itself, so round 2 uses the automatic benchmark (decision 0153) instead of free sailing. It sails the same route three times (full, 0.7 and 0.5 resolution). If the 0.7 and 0.5 passes run clearly faster, fill rate is the limit and the fix is a lower level ("Very low" with a smaller pixel cap) and/or a steady 30 fps cap on weak devices.

## Round 2 links

Open each link, keep the tablet awake and don't touch it for about 4 minutes, then press **Copy** and paste the report:

1. https://djguiaume.github.io/fair-winds-trading/?bench (today's sea)
2. https://djguiaume.github.io/fair-winds-trading/?bench&map=stress (stress sea)

For comparison, headless desktop Chromium with a software GPU (not a device result) at 800×1280, level High: full 11.6 fps, 0.7 → 18.0, 0.5 → 25.0 on today's sea.
