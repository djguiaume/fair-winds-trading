# v1.4 "Visible upgrades" (Your Own Boat) — brief

Milestone: v1.4 Visible upgrades. Tracker [#294](https://github.com/djguiaume/fair-winds-trading/issues/294); scope approved by Guillaume 2026-10-28. Each part is one issue ("Fixes #N"). Upgrade effects (speed, capacity, prices) do not change. Excluded and kept as ideas: #302 to #306. v1.4.1 (#357) follows with cosmetics beyond this set and the rest of Free Sailing polish; v1.5 is the story.

Design first: nothing fleet-wide starts until Guillaume has approved the #295 prototype (base, middle, max for one swift boat and one large hauler, day, night, phone).

| # | Part | Effort | Visual | Model | Wave |
| --- | --- | --- | --- | --- | --- |
| #295 | Visual direction, upgrade identity, cosmetic slots and compatibility; prototype for approval | med | yes | Sonnet | 1 |
| #315 | Quest engine: ship reward and "series won" start (carried from v1.2) | low | no | Sonnet | 1 |
| #319 | Style E text audit and shared type tokens (carried) | low | yes | Sonnet | 1 |
| #296 | Visible sail, hull and hold upgrades across the fleet | high | yes | Opus | 2 (after #295 approved) |
| #297 | Cosmetic catalogue, validator, editor and CLI | med | no | Sonnet | 2 (after #295 schema) |
| #326 | Dim paper screens at night (carried; after #319, same files) | low | yes | Sonnet | 2 |
| #298 | Per-ship appearance persistence and save migration | med | no | Sonnet | 3 (after #297) |
| #299 | Customisation screen "Boat looks" (own screen, opened from the shipyard; spec docs/v1.4/customisation.md) | high | yes | Opus | 3 (after #296, #297) |
| #418 | Sail logos, more patterns, racing number on the cloth, wake styles (Guillaume, 2026-10-31) | high | yes | Opus | 3 (after #296, #297) |
| #300 | Isolated Free Sailing sessions and presets | med | yes | Sonnet | 4 (after #298, #299) |
| #301 | Cosmetic and figurehead collection, fleet review, acceptance, release | med | yes | Sonnet | 4 (last) |

Not scheduled: #405 (phone fluidity reference, a short research note to play before any phone perf pass; Guillaume to say if he wants it in wave 1), #377 and #291 (device runs, Guillaume's devices), #392 (split index.html). Bugs: none open as `bug`; Guillaume may add some.

Pauses: Guillaume checks token usage before each next wave. The lead starts a wave only after his OK. At most 3 to 5 threads at once.

Role questions (one message each): the storyteller names figureheads and flag texts (EN and FR) for #297 and #301; the art director sets the look rules for #295 first, then reviews #296 and #301 with Guillaume.

Rules: boats stay recognizable at sailing camera; every upgrade, cosmetic and damage combination reads; old saves keep their meaning; Free Sailing never touches voyage saves; budgets are argued, not raised by default; EN and FR; touch, keyboard and pad.

Ruling (Guillaume, 2026-10-31): sail colours and patterns are free; figureheads and pennants are earned through story or regatta wins; no coin prices; the Tern stays a single gift. Pick-one club prizes (#315) are later story content.

Ruling (Guillaume, 2026-11-01): sail variant B (ADR 0259), to be reshaped by logos and patterns (#418); everything free for now. Customisation spec: [customisation.md](customisation.md); logo set and screen words from the storyteller in project files `story/v1.4-customisation.md`.
