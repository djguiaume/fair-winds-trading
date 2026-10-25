# 0174. Event panel for big story events

**Status:** Proposed (2026-10-25): an idea kept for later, **not to be built yet**. Needs its own mockups and Guillaume's pick before it is accepted.

## Context

Phase 4 brings a few big moments that a quest card alone tells poorly: an eruption in the west sea, Cinder Isle rising after the eruption quest ([0147](0147-phase-4-story.md), [0166](0166-land-that-rises-or-clears-after-a-quest.md)), the pack ice opening Snowberry Isle's cove in the north. Today a quest step can only speak through the quest cards ([0141](0141-quay-tab-and-arrival-card.md)) and change the map.

Guillaume's idea (2026-10-25): for big events, a quest-style panel in the middle of the screen, with an animation on top, in the quest UI and NPC art style ([0124](0124-characters-look.md), [0141](0141-quay-tab-and-arrival-card.md)), and the text at the bottom.

All art is built in code and no paid tools are used (Scenario credits are not spent), so hand-drawn GIFs are not an option.

## Decision

Keep the idea, with the coordinator's suggestion for making the animations (Guillaume asked to save both together):

- **The panel**: centred, framed like the quest cards, an animation at the top and one or more text cards below (long text split into several cards in a row, like dialogue).
- **The animation is the real game**: the event is staged in the real 3D game (the eruption, the island rising) and captured with the shots tool (`npm run shots`, [0153](0153-command-line-tools-for-agents.md)) into a short looping video or sprite sheet per event.
- **Stored as data**: each event's clip and its capture settings (sea, place, camera, time of day, which tags are on) live in a data file, so a clip can be captured again whenever the look changes (the art bible, [0165](0165-art-bible-and-the-phase-4-biome-looks.md)), with one command.
- **A quest step type**: the panel is opened by a quest step (quest engine, [0125](0125-quest-engine.md)) like any other, editable in the quest builder ([0142](0142-quest-builder.md)) and checked by `npm run quest -- check`.
- **Only a few major events** (an eruption, an island rising, the ice opening), to keep the download size and the capture work small.

## Consequences

- Nothing is built now. When it is picked up: mockups of the panel on desktop, landscape and portrait first, then the step type, the clip format and a shots option to record a clip.
- Open questions for then: video (WebM/MP4) or sprite sheet (size on the old tablet, autoplay on phones); how long a clip is; whether the game pauses while the panel is open; whether a Settings switch can skip the clips; whether French text needs its own clip (it should not: text stays in the cards).
