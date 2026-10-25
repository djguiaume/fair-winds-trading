# Volcano smoke and eruptions: review 1

Decision [0178](../../decisions/0178-volcano-smoke-and-eruptions.md). Shots from the real game on the Phase 4 sea, retaken with
`npm run shots -- --list docs/reviews/volcano/shots.json --out shots/volcano`.

| Shot | What it shows |
| --- | --- |
| `1-smoulder-plume-*` | The Smoulder's quiet plume from the sailing view (desktop, landscape, portrait) |
| `2-eruption-day-*` | An eruption seen from further out: ash puffs, lava bombs on arcs, brighter lava |
| `3-eruption-night-*` | The same at night |
| `4-eruption-sailing-*` | An eruption from the sailing view |
| `5-emberhold-vent-desktop` | Emberhold's small vent: a small plume, never erupts |
| `6-settings-*`, `7-settings-fr-desktop` | Settings › Eruptions, EN and FR |

Cost (headless, Low quality, at The Smoulder): two extra draw calls, at most about 2k extra triangles mid-eruption, 0.06 to 0.1 ms of CPU per frame, nothing when no crater is in sight.

Open for the art director: the puffs are flat-shaded icosahedrons in one opaque batch (art bible rule 8), and they can read as grey rocks close to the camera; the colours, sizes, rise and drift are all in `weather.json` › `volcano`.
