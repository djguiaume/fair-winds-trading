# 0142. A quest builder in the editor

**Status:** Proposed (2026-10-24), awaiting Guillaume's answers. [Mockup and plan](../quest-builder/README.md). Builds on the quest engine [0125](0125-quest-engine.md), the step data of [0139](0139-gentler-prologue-and-quest-cards.md) and the cards of [0141](0141-quay-tab-and-arrival-card.md); the third authoring tool after the map editor [0095](0095-map-editor.md) and the island builder [0105](0105-island-builder-props.md).

## Context

Guillaume asked whether there should be a quest editor or builder. Quests are data ([0125](0125-quest-engine.md)): one JSON file per quest in `src/data/quests/`, conditions and rewards from the code library `src/sim/questLibrary.ts`, text keys in `src/i18n/en.json` and `fr.json`. Writing one by hand means typing map coordinates, remembering each condition's parameters and the text key pattern, and the card and the places at sea are only seen in the game, after playing the steps before. The data-first rule ([0093](0093-data-driven-content-and-authoring-tools.md), Guillaume 2026-10-24: "everything data driven, in the quest engine") makes a tool worth it: every new mechanic becomes step data, so a builder that reads the library covers it.

## Decision (proposed)

1. **A Quests mode in `editor.html`**, next to Map and Islands: quest list, steps as cards, the real chart with the step's places, a step panel (Goal, Card, Sea, Reward), checks. Static mockups first: [steps](../quest-builder/steps.png), [card and text](../quest-builder/card.png), [story](../quest-builder/story.png), [play from a step](../quest-builder/play.png), [phone landscape](../quest-builder/sea.png), [portrait](../quest-builder/portrait.png), [portrait card](../quest-builder/portrait-card.png).
2. **Forms from the library**: each condition and reward kind describes its parameters (type, list, optional) next to its check, so the builder's fields and the checks never drift, and a new kind appears in the builder without builder code.
3. **Places on the chart**: `reach` points, `via`, cargo spots, `compass` and `chart` circles drawn and dragged on the map editor's chart; other steps faded; "after the quest" marks shown.
4. **Cards live, text side by side**: the game's own card component previews the step in English or French; ask and speech edited side by side and saved to `en.json` and `fr.json`.
5. **Story view**: every quest linked by its start conditions; the quest's own fields beside it.
6. **Play from a step** in a new tab on the editor's own save, set up for the chosen step, with a quest test bar (restart, skip, close).
7. **Checks are the tests'** (`checkQuests`, `checkQuestHooks`, map clear-water checks), live; **export** gives the quest file and both text files formatted like the repo.
8. Built in three PRs: read and show, edit and export, play from a step. The tutorial's lessons stay out at first.

## Consequences

- Adding a quest no longer needs a thread or hand-typed coordinates; the review of its text and places happens in the tool.
- The condition and reward kinds gain parameter descriptions (small code change in `questLibrary.ts`), shared by the builder and the checks.
- The game learns a test start (`?map=edited&quest=…&step=…`) on the editor's isolated save.
- Open questions (Guillaume): go or not now; story view in the first PR; tutorial lessons later or never; play-test in a new tab or inside the editor.
