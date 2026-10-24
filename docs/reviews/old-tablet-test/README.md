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

Round 2 checks the fill-rate guess with the `?perf` test aids (0148): `scale` lowers the drawing resolution, `fps` caps the frame rate. If `scale=0.7` brings the average near 50–60 fps, fill rate is the limit and the fix is a lower level ("Very low" with a smaller pixel cap) and/or a steady 30 fps cap on weak devices.

Links for round 2 (sail at least 2 minutes each, no card open, then Copy):

1. https://djguiaume.github.io/fair-winds-trading/?perf (today's sea again)
2. https://djguiaume.github.io/fair-winds-trading/?perf&scale=0.7
3. https://djguiaume.github.io/fair-winds-trading/?perf&scale=0.5
4. https://djguiaume.github.io/fair-winds-trading/?perf&fps=30
