# v1.2 "A new look" — brief

Milestone: [v1.2 A new look](https://github.com/djguiaume/fair-winds-trading/milestone/2), tracker [#267](https://github.com/djguiaume/fair-winds-trading/issues/267). Scope: [0230](../decisions/0230-v12-scope-terrain-sculpting-and-the-ocean-moves-to-v13.md); build guide [plan.md](plan.md). Each part is one issue ("Fixes #N"). Ocean waves are v1.3.

Guillaume's order: other boats first.

| # | Part | Effort | Visual | Model | Wave |
| --- | --- | --- | --- | --- | --- |
| #331 | Redesign the other boats (shapes, data colours, wakes, deck cargo) | med | yes | Sonnet | 1 |
| #268 | Shared height field and island-builder split (`?look=v2`) | high | no | Opus | 1 |
| #269 | Smooth ground, biome palettes, faceted shapes | high | yes | Opus | 2 (after #268) |
| #270 | Deterministic sculpting operations and saved edits | high | no | Opus | 2 (after #268; not the same files as #269) |
| #274 | Depth-coloured water from the height field | med | yes | Opus | 3 (after #268) |
| #271 | Terrain brushes in the island editor | high | yes | Sonnet | 3 (after #270) |
| #272 | Terrain CLI parity, import/export, checks | med | no | Sonnet | 3 (after #270) |
| #273 | Coast, grounding, terrace and harbour checks | med | no | Sonnet | 3 (after #269) |
| #275 | Instanced forests and biome recipes | high | yes | Opus | 4 |
| #276 | Per-sea haze, sky, night | low | yes | Sonnet | 4 (after #269, #274) |
| #277 | Island-by-island art acceptance (ring first) | med | yes | Sonnet | 5 |
| #278 | Performance and device gates, `?bench` | med | no | Sonnet | 5 |

Carried from v1.1, one low-effort Sonnet thread alongside wave 1 (UI files only, no overlap): #326 night dimming of paper screens, #319 Style E text audit. The bug fixes (#255) moved to the next release, v1.3, by Guillaume on 2026-10-28; new bugs become `bug` issues for it.

At most 3 to 5 threads at once; I start the next part as soon as one merges. Role questions (one message each, when their wave starts): storyteller has none for v1.2 so far; art director gives boat look rules for #331 first, then biome tables for #269 and #275.

Guillaume's rules (2026-10-28):
- **Island and town size:** no blanket growth. A bigger island moves things apart and can change sailing times and balance, so each change is made only where it makes sense, one island at a time, with a chart and `npm run balance` on all three levels. The ring ports already grew to radius 34 to 36 in [0216](../decisions/0216-windward-ring-catch-up-pass.md); the old handover item "grow ring towns" is closed.
- **Budgets:** the old-tablet triangle limit is lifted for now, but every budget raise is a conscious, argued choice each time (what it buys, what it costs on Low), never a default.

The Abbey Head club-house art follow-ups are noted for v1.2.
