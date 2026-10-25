# Volcano smoke and eruptions: review 2

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

Round 2 applies the art director's round-1 notes: the puffs are self-lit (0.6) so the facets barely show, quiet steam is `#ece8e1` and eruption ash `#5f5953`; each puff starts small at the vent, grows as it drifts and shrinks away at the end (±35 %, squashed to 0.8); the plume rises about 20 units above the rim and then leans downwind as one column; puffs shrink out 12 units under the camera; at night the lower eruption ash mixes 40 % toward `#ff7a3a` over the first third of its life; bombs come in bursts of 8 to 12 and land on the upper cone within about 1.2 crater radii; Emberhold's vent is smaller and half as long. All of it is in `weather.json` › `volcano`.
