# v1.12 brief: Light and water

Order accepted by Guillaume on 2026-11-13 (#568, [review](../reviews/whole-game-v1.9/README.md)). Goal: the follow cam is a view worth sailing in: one atmosphere in both views, light with depth, a sea that moves, and a frame budget that guards it. Milestone "v1.12 Light and water". The issues are the plan; no plan file.

Every part: data driven (0093), CLI plus editor for authoring changes (0153), inside `budget.json`, an ADR when it decides something, both cameras judged, desktop plus phone landscape, all three difficulty levels untouched. Carry-overs from v1.11: flat morning light in the follow cam (parts 2 and 3), device round #377 with Low (part 1). #531 stays parked behind `graphics.title.live`.

| Order | Issues | Goal | Files | Done when | Effort | Visual | Model |
|---|---|---|---|---|---|---|---|
| 1 | #558, #557, #549, #377 | **Budgets first.** Scenarios for the follow cam and for Low/Medium/Ultra; Ultra code and QR reader out of the first download, CI size budget; Auto quality scales resolution first and climbs back; per-pass cost switches incl. Low `?bench` | `tools/performance/*`, `budget.json`, `bench-budget.yml`, `view.ts`, `quality.ts`, `graphicsSettings.ts`, `vite.config` | CI fails when a budget breaks; Vite prints no `INEFFECTIVE_DYNAMIC_IMPORT`; Auto holds frame rate then steps up; numbers for each Ultra pass | medium | no | Sonnet |
| 2 | #573 | **One atmosphere in both views**: same sun, sea colour, haze distance and night from above and behind; the view changes the camera, not the weather | `atmosphere.ts` (`setView`), `skyLight.ts`, `oceanShader.ts`, `graphics.json` sky, palette | Side-by-side sheet of the same place, hour and weather in both views, day, dusk, night, reads as one world | high | yes | Opus high |
| 3 | #550, then #547 | **Light with depth**: shadows tuned for the follow cam, contact shade, sun glitter and path; then night: moonlit land, moon path, lantern pools. Starts after part 2 merges | `src/render/shadows*`, `skyLight.ts`, `oceanShader.ts`, `lanterns.ts`, `graphics.json` | Trees, houses, quay and boat visibly stand in the scene on High and Ultra; night land has form; `?bench` flat on High | high | yes | Opus high |
| 4 | #551, #546 | **Water**: swell and crests seen from the follow cam (finer sea ring round the boat, chop in the lee, crest foam), then life on the open sea from above (cloud shadows, whitecaps, swell lines). Wave comfort setting kept | `oceanWaves.ts`, `seaWaves.ts`, `oceanShader.ts`, `seaGusts.ts` | Sea reads as moving at 8-12 kn; harbours not mirrors; open sea from above no longer flat; draw calls and `?bench` inside budget on all levels | high | yes | Opus high |
| 5 | #552 | **A richer sky**: layered clouds, sun disc, squall band, haze line by hour. Starts after part 2 merges | `skyDome.ts`, `skyShader.ts`, `skyClouds.ts`, `stormClouds.ts` | Sky carries the mood and the weather in both views, moon back on Ultra (#526 follow-up) | medium | yes | Opus high (shader) |
| 6 | bugs | **Bug checklist** (one issue): anything Guillaume names, open `bug` issues, #569 style leftovers | see issue | each item ticked | low | maybe | Sonnet |

**Waves:** wave 1 = parts 1 and 2 (no shared files). Wave 2 = parts 3, 4, 5 after part 2 merges; 3 and 5 both touch sky and light files, so 5 follows 3 if they collide (the build threads say so in the issue). Part 6 any time.

**Size:** five parts, nine issues, three high-effort (2, 3, 4) plus the sky. This is above the two-high-effort rule. Recommendation: keep it, because parts 2 to 4 are one picture (light and water), but move **#552 sky** to v1.13 if Guillaume wants a smaller release. Not in the order and left out: #545 God-eye closer view (v1.13 candidate).

**Roles:** art director (v1.12) asked once: what "one atmosphere" means (reference hour and palette), shadow strength, sun and moon path look, water and sky picks, from sheets. Storyteller (v1.12) asked once: nothing needed unless a part adds a word; confirm.

**Review:** one combined visual round at the end, sheets in `docs/reviews/v1.12/`, to the art director and Guillaume together. Merge rule as v1.10 and v1.11 (Guillaume 2026-11-15): build threads auto-merge their own PRs (CI green, branch current, nothing open, `automerge` label only, no `visual` label); Guillaume reviews once at the end, before the release.

**Not in v1.12:** softness and richness (v1.13), the stranger playtest, racing.
