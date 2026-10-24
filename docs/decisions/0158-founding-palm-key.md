# 0158. Founding Palm Key: the south sea's third arc

**Status:** Implemented (2026-10-24). Written by the head storyteller. It completes the south sea story of [0155](0155-south-sea-story.md) on the founding of [0157](0157-founding-an-outpost.md), with the text drafted and agreed in the [review](../reviews/south-story/README.md). Guillaume approved Tam's look with 0155, and Palm Key's look with 0157.

## Context

The brief's Phase 4 section ([0147](0147-phase-4-story.md)) gives every sea three arcs. The south had two (Ness's chart and Juno's tea house). The third, founding the outpost with the relative, waited for founding goods, sites and the `found` reward, which are now merged.

## Decision

1. **`outpost-south`**, "Palm Key": offered by Juno at Sunreach once `sunreach-tea` is done.
   - `supplies` (Juno, worried): land 10 timber and 6 planks at Palm Key's landing spot, under 2 kn (`all` of two `landed`). A short load lands what it can and the rest comes on the next call. Gold 300.
   - `settler` (Tam speaks, card at Watchman Key): carry Tam (space 0) from Watchman Key to the same spot. Gold 450.
   - Reward `found: ["palm-key"]`. The flagpole and name board already stand on Palm Key from level 1, the day it is founded.
2. **The done card is Tam's**, through a new quest field `doneSpeaker` (a person id, checked like `giver`). It shows on Sunreach's Quay, where the quest lives. Tam has come over in the skiff with the first basket and says where the raw goods go ("Bring what we gather to Juno here"). That is how the story explains "no raw goods, no craft" (0146).
3. Every step can be done in any ship: the deep channel reaches Palm Key (0152).

## Consequences

- The south sea's story is complete: chart, keeper's arc and outpost. The west, north and east follow the same pattern from the brief.
- `doneSpeaker` is generic, so any later arc's done card can be spoken by someone other than its giver.
- Rewards are placeholders for the Phase 4 balance pass.
