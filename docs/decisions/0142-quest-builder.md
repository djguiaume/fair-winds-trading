# 0142. A quest builder in the editor

**Status:** Accepted (2026-10-24). Guillaume: "1 go, 2 don't care, you build it and merge it, in the order you want and as parallel as you want, 3 keep [the tutorial] out for the moment but it must use the same quest format as everything is data, 4 new tab". [Mockup and plan](../quest-builder/README.md). **Part 1 built** (2026-10-24, [how to use](../quest-builder/builder/README.md)): the Quests page with editing, card and text, story, checks and export. **Part 2 built** (2026-10-24): play from a step in a new tab. Builds on the quest engine [0125](0125-quest-engine.md), the step data of [0139](0139-gentler-prologue-and-quest-cards.md) and the cards of [0141](0141-quay-tab-and-arrival-card.md); the third authoring tool after the map editor [0095](0095-map-editor.md) and the island builder [0105](0105-island-builder-props.md).

## Context

Guillaume asked whether there should be a quest editor or builder. Quests are data ([0125](0125-quest-engine.md)): one JSON file per quest in `src/data/quests/`, conditions and rewards from the code library `src/sim/questLibrary.ts`, text keys in `src/i18n/en.json` and `fr.json`. Writing one by hand means typing map coordinates, remembering each condition's parameters and the text key pattern, and the card and the places at sea are only seen in the game, after playing the steps before. The data-first rule ([0093](0093-data-driven-content-and-authoring-tools.md), Guillaume 2026-10-24: "everything data driven, in the quest engine") makes a tool worth it: every new mechanic becomes step data, so a builder that reads the library covers it.

## Decision

1. **A Quests mode in `editor.html`**, next to Map and Islands: quest list, steps as cards, the real chart with the step's places, a step panel (Goal, Card, Sea, Reward), checks. Static mockups first: [steps](../quest-builder/steps.png), [card and text](../quest-builder/card.png), [story](../quest-builder/story.png), [play from a step](../quest-builder/play.png), [phone landscape](../quest-builder/sea.png), [portrait](../quest-builder/portrait.png), [portrait card](../quest-builder/portrait-card.png).
2. **Forms from the library**: each condition and reward kind describes its parameters (type, list, optional) next to its check, so the builder's fields and the checks never drift, and a new kind appears in the builder without builder code.
3. **Places on the chart**: `reach` points, `via`, cargo spots, `compass` and `chart` circles drawn and dragged on the map editor's chart; other steps faded; "after the quest" marks shown.
4. **Cards live, text side by side**: the game's own card component previews the step in English or French; ask and speech edited side by side and saved to `en.json` and `fr.json`.
5. **Story view**: every quest linked by its start conditions; the quest's own fields beside it.
6. **Play from a step** in a new tab on the editor's own save, set up for the chosen step, with a quest test bar (restart, skip, close).
7. **Checks are the tests'** (`checkQuests`, `checkQuestHooks`, map clear-water checks), live; **export** gives the quest file and both text files formatted like the repo.
8. Built in two parts (Guillaume let the order be chosen): first the page with editing, card and text, story, checks and export; then play from a step.
9. **The tutorial stays out of the builder for now**, but it must move to the same quest format as the other quests (everything is data), so it can later open in the builder too. That conversion is its own step after the builder.

## Consequences

- Adding a quest no longer needs a thread or hand-typed coordinates; the review of its text and places happens in the tool.
- The condition and reward kinds gain parameter descriptions (small code change in `questLibrary.ts`), shared by the builder and the checks.
- The game learns a test start (`?map=edited&quest=…&step=…`) on a fresh voyage kept in memory (see As built, part 2).
- The tutorial's own lesson format (`first-voyage.json`: `coach`, `on`, `mark`, `continue`) is now a debt: it must become ordinary quest steps. **Paid** in [0151](0151-tutorial-as-ordinary-quest-steps.md).

## As built (part 1)

- A **Quests** button in the map editor's top bar opens the builder over the editor, like the island builder; the map editor's Map/Islands/Quests tabs of the mockup became the views **Chart · Card & text · Story** inside the builder.
- Condition fields come from each kind's `params` (exported `Param`/`ParamSpec`), and the kind picker reads `CONDITION_ABOUT` in `questLibrary.ts`; a test fails if a kind has no line there.
- Quest files export byte for byte like the repo: `formatQuestJson` keeps objects on one line where they fit, and a file written with objects open (`fair-winds.json`) keeps the plain `formatJson`.
- Not built from the mockup: dragging between quests in the story view to link them (the start condition is edited on the right instead), and the portrait quest/step pickers (portrait stacks the lists, the chart and the fields).

## As built (part 2): play from a step

- **▶ Play from step…** in the builder's top bar: pick a step of the open quest and a start, **docked at a port** (default the step's `port`, else the quest's) or **at sea** about 30 short of the step's first place, heading for it. The game opens in a new tab: `?map=edited&quest=<id>&step=<id>` with `&port=<id>` or `&x=…&y=…&h=…`.
- The test is a **fresh Captain voyage kept in memory only** (not the editor's play-test save the plan named), so a test never leaves a save behind and Restart is a reload. The tutorial is skipped (since [0151](0151-tutorial-as-ordinary-quest-steps.md) it is a quest like the others).
- `QuestBook.testStart` finishes the quests the start condition names (`quest-done`, `chose` through the named option, `quest-at` up to that step; the first member of an `any`), paying their rewards, then pays the quest's own earlier steps on the way to the step (`routeTo` finds the way through choices). Other start conditions (gold, a town level) are not made true: the quest is simply entered.
- At sea she starts off the wind when the heading asked for points into it (`sailableHeading`); docked, `testBerth` finds clear water in docking range by the pier.
- A **quest test bar** (bottom; under the quest note in portrait) shows the quest and step, with **↺ Restart**, **⏭ Skip step** (`QuestBook.skipStep`; a choice takes its first option) and **✕ Editor**. Editor-only English, like the map editor.
- `?map=edited` now also plays the builder's quests and text (`editedQuests`, `useEditedQuests`, `useTextEdits`), for Play this map too: the edited quests replace the shipped ones for that page only.
