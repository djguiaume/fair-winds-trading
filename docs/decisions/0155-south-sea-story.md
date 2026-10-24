# 0155. The south sea story: Ness's chart and Juno's idle tea house

**Status:** Implemented for review (2026-10-24). Wave 1 of Phase 4 (Guillaume: "Go wave one"). Written by the head storyteller from the [brief's Phase 4 section](../story/storyteller-brief.md#phase-4-the-four-seas) ([0147](0147-phase-4-story.md)) on the south sea of [0152](0152-south-sea-sunreach-layout.md). The new people and the tea garden change wait for Guillaume's OK on the [screenshots](../reviews/south-story/README.md).

## Context

The south sea is laid out (0152), but nothing in the story leads there. The brief says each sea has three arcs: a letter or chart from the ring, the keeper's arc at the main port, and founding the outpost. Founding is still being built by another thread.

## Decision

1. **Two quests now, as data:** `watchman-passage` (Old Ness hands over his chart at Watchman Key once the epilogue is done; docking at Sunreach ends it) and `sunreach-tea` (Juno Reyes, three steps: 8 bread, a slow look at Palm Key's west beach, 10 planks). The goods are ones the ring is sure to make once its four arcs are done (bread from Westholm's town level, planks from Calda's slipway arc), not honey, which only Abbey Head makes from level 2. Gold 300, then 250 / 400 / 600.
2. **They run only where their ports exist:** `questsFor` already skips a quest whose ports a map lacks, so the shipped ring never sees them, and `?map=phase4` plays them. The tests that checked every shipped quest on the ring now check the ring's own quests there and every quest on the grown sea, which still catches a misspelled port. The quest builder checks the quests its map can run.
3. **New people as data:** Juno Reyes (tea blender, Sunreach) and Tam Ness (settler, Watchman Key) in `characters.json`, with babble voices in `audio.json` and roles in both languages.
4. **The port's look after Juno's arc:** two more `tea-garden` rows and three `drying-rack`s on Sunreach's south arm, tagged `after:sunreach-tea` (0130's hook). Existing props only.
5. **`outpost-south` is drafted** in the [review](../reviews/south-story/README.md) on the founding thread's fields (`site`, `landed`, `found`). It goes in once founding is merged. Ness's chart will lift its chart areas with fog of war's step field `charts` once that is merged.

## Consequences

- Sunreach South's golden hash in `tests/island-files.test.ts` changes on purpose.
- The brief's Phase 4 section now says where each relative lives: Tam at Watchman Key, and the other three at their sea's main port, where the founding quest picks them up.
- Guillaume's answers on the other seas went into the brief's Phase 4 section: the layout stays as it is, the hazards of each sea, eruptions as a spectacle in the west, Cinder Isle born in an eruption after Bram's arc, and Snowberry Isle's cove freed from pack ice after Sigrun's arc, with an old weather station to rebuild (no whaling station), with islands that appear and ice that goes after a quest (`"after"` / `"before"` on island and terrain entries).
- Rewards are placeholders for the Phase 4 balance pass, in the quest files.
