# v1.13 brief: Soft and rich

Order accepted by Guillaume on 2026-11-13 (#568). Goal: what is near the camera feels soft, detailed and textured (Guillaume's biggest miss against Saltline), and the screens that show the boat share the game's real sea and sky. Milestone "v1.13 Soft and rich".

Every part: data driven (0093), CLI plus editor for authoring changes (0153), inside `budget.json`, an ADR when it decides something, both cameras judged, desktop plus phone landscape, all three levels untouched. Texture must not push the follow-cam sea dE past 5 (art bible §14).

| Order | Issues | Goal | Files | Done when | Effort | Visual | Model |
|---|---|---|---|---|---|---|---|
| 1 | #572 | **Softness, detail, texture.** A sheet of 2-3 variants first (art director picks), then procedural surface patterns near the camera (sea, ground, hulls, roofs); art bible rule 1 updated | `src/render/*` materials, `graphics.json`, art bible | Sheet picked; near-camera surfaces read soft and detailed in both views; `?bench` inside budget on all levels; sea dE ≤ 5 | high | yes | Opus high |
| 2 | #553, #554 | **Boat up close.** Helmsman, tiller, sheets, bellied sail; bow spray, heel splash, small camera lean | `playerBoat.ts`, `src/render/models/*`, wake/spray modules | Follow cam shows a sailed boat, not a model; spray scales with speed; Settings can switch lean off | high | yes | Opus high |
| 3 | new (preview scene) | **Real sea and sky in boat previews.** Free Sailing setup and Boat looks preview share the game's sea, sky, light and haze (today flat blue and flat sky) | `src/render/boatPreview.ts`, atmosphere/ocean modules, `boat-preview.json` | Preview next to a real-game shot reads as the same world, day and night; no big cost on Low | high | yes | Opus high |
| 4 | new (setup layout) | **Fix the Free Sailing setup (boat choice) layout.** "Où et quand" card is cramped (one word per line, text over its border); boat type list is uneven; check FR/EN, desktop and phone landscape | `src/ui/freeSailing/*`, its CSS, theme tokens | No overflow or one-word lines in either language; type list even; sheet checked | low | yes | Sonnet |
| 5 | #555 | **Follow cam sound**: hull, sail, rigging closer | `sound` modules, `npm run sound` | Follow cam sounds near; tool renders it | medium | no | Sonnet |
| 6 | bug checklist | Mobile: the wind icon sits over the wind compass and hides part of the view (Guillaume 2026-11-16) | `src/ui/hud/*` | Phone landscape: no overlap, checked on phone sheet | low | yes | Sonnet |

**Waves:** parts 1 and 2 first (rendering, shared materials); part 3 after 1 merges if they share materials; parts 4, 5, 6 any time.

**Size:** six parts, three high-effort (1, 2, 3), above the two-high rule. Recommendation: keep, because 1 and 3 are the one "same world, softer" picture; 2 could move to v1.14 if Guillaume wants smaller. Not in the order (candidates, Guillaume decides): #545 God eye closer view, #531 live title, #492 split builder.ts. #377 device bench stays open.

**Roles:** art director asked once (texture sheet picks, preview look, boat-up-close, spray). Storyteller asked once: nothing expected; confirm.

**Review:** Guillaume validates once, at the end, sheets in `docs/reviews/v1.13/`. Merge rule as v1.10 to v1.12: build threads auto-merge their own PRs (CI green, current, nothing open, `automerge` label only, no `visual`).
