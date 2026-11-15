# v1.11 brief: Welcome aboard

Order accepted by Guillaume on 2026-11-13 (#568, [review](../reviews/whole-game-v1.9/README.md)). Goal: a stranger's first minute. One click from the title to a moving boat, over a view worth looking at, a short lesson, and a follow cam you can play the whole game in. No plan file exists; the issues are the plan.

Every part: data driven (0093), CLI plus editor for authoring changes (0153), inside `budget.json`, an ADR when it decides something, both cameras judged, desktop and phone landscape. Milestone "v1.11 Welcome aboard".

| Order | Issues | Goal | Files | Done when | Effort | Visual | Model |
|---|---|---|---|---|---|---|---|
| 1 | #535, then #560 | **Follow-cam HUD and remembered view**: one full HUD in both views, view button and Settings choice kept in the save. Then the **compact phone-landscape HUD** (2-3 static mockups first, then the pick) | `src/ui/hud/*`, `cameraControls.ts`, `portLabels.ts`, `settings/display.ts`, `theme.json` | A full quest plays in the follow cam; view survives reload; boat clear on 844x390; 44 px targets | medium | yes | Sonnet |
| 2 | #536, #537 | **Follow-cam orbit and framing**: drag, stick and two fingers look round the boat; boat in the lower third, camera pulls back with speed, cards keep clear (2-3 framings shown) | `chaseView.ts`, `cameraRig.ts`, `cameraOrbit.ts`, `touchCamera.ts`, `gamepad.ts`, `camera.json` | Orbit with all three inputs, test for limits; pier visible past the boat at 5 kn; `?bench&chase=1` draw calls flat | medium | yes | Opus high (engine) |
| 3 | #532, #534 | **One click to sailing and a short first voyage**: New voyage starts on Captain, no tutorial question, title keeps three rows; first voyage at most six steps, no "n of 14" | `title.ts`, `newVoyage.ts`, `tutorialOffer.ts`, `tutorial.ts`, `first-voyage.json`, `sailing-lessons.json`, i18n | Fresh browser reaches a moving boat with one click; all 14 lessons still reachable; quest check and bots pass on all 3 levels; `npm run balance` | medium | small | Sonnet, storyteller for the words |
| 4 | #531, #533 | **Live title and an opening worth looking at**: title shows the real sea behind the menu; the first voyage opens in the follow cam, morning light, land ahead. Starts after parts 2 and 3 merge (same camera and start files) | `title.ts`, `title.css`, `chaseView.ts`, `first-voyage.json`, `camera.json` | Live scene on Medium and up, a still on Low; first frame shows boat, land and sky; menu readable day and night | medium | yes | Sonnet |
| 5 | #569, #548 | **Bugs**: merged PRs leave issues open (#569); Low quality smooth upscale and no square water tiles (#548). Add the bugs Guillaume names | see issues | each issue's done-when | low to medium | #548 yes | Sonnet |

**Waves:** wave 1 = parts 1, 2, 3, 5 (files do not overlap, except `title.ts`/start files in 3 versus 4, and HUD files in 1). Part 4 after 2 and 3 merge.

**Size:** five parts, ten issues; no part is high effort except the camera one.

**Roles:** art director (v1.11) asked once: HUD, framing and title-look picks. Storyteller (v1.11) asked once: the one line that replaces the tutorial offer, the six lesson beats, the hint wording.

**Review:** one combined visual round at the end of each wave, sheets in `docs/reviews/v1.11/`, to the art director and Guillaume together. Merge rule as v1.10 once Guillaume says it: threads auto-merge when CI is green and nothing is open; `visual` label, `automerge` only per his OK.

**Not in v1.11:** light and water (v1.12), softness and richness (v1.13), the stranger playtest, racing.
