# 0151. The tutorial as ordinary quest steps

**Status:** Implemented (2026-10-24). Guillaume: "ok for 3, 4, 5" (item 4: pay the debt of [0142](0142-quest-builder.md)). Builds on the quest engine [0125](0125-quest-engine.md), the gentler prologue [0139](0139-gentler-prologue-and-quest-cards.md) and the quest cards [0141](0141-quay-tab-and-arrival-card.md); replaces the tutorial's own lesson format of [0113](0113-levels-tutorial-and-music-as-data.md) and [0127](0127-prologue-rescue-tutorial.md).

## Context

[0142](0142-quest-builder.md) kept the tutorial out of the quest builder because `first-voyage.json` had its own format (`on` events, `mark`, `continue`, `picks`, `pointer`, `passenger`…) run by its own engine, `src/sim/tutorial.ts`. Guillaume's rule is that everything is data in the quest engine, so the tutorial had to become an ordinary quest: editable in the builder, playable from any step, with no tutorial-only code.

What the tutorial needed that quests could not say: harbours and a cargo picked during play (where you buy, where you sell, what you carry), going back a step when the player undoes something (clears the course, sails off, loses the cargo), a Continue button next to a goal, a button shown only when something holds, the chart being open, a course set, a good bought, a coach bubble pointing at the game's buttons, starting when the player asks for it, and holding storms.

## Decision

The quest engine gains generic step data; the tutorial is rewritten with it. Any quest can use these fields.

1. **Quests the game asks for:** `start: { "is": "asked" }` starts only from `QuestBook.ask(id)` (the menu's tutorial button, a fresh voyage that takes the tutorial), and again each time. `QuestBook.drop(id)` (Skip) counts it as done, unpaid, so `quest-done first-voyage` still means "finished or skipped".
2. **Lessons:** `lesson: true` shows the coach bubble (step number on the main line, Hide, Skip, the step's buttons) instead of a quest card; it is always the tracked quest while it runs, and other quests' cards wait. `storms: false` holds storms while the quest runs.
3. **Vars:** `vars: { "name": "port" | "good" }`, filled in play by a step's `set` (`course`, `docked`, `aboard`, `home`, a port or good id, or another `$var`), applied when the step ends. Conditions, `port` and `coach` read them as `$name`. They are saved with the quest's progress and in the FW2 code. Text can say `{name}` (port name or good), `{nameMakes}` (what that port makes) and `{nameBuyer}` (who buys that good).
4. **Ways back:** `unless: [{ "if": <condition>, "to": <step>, "set"?: … }]` on a step. The goal is tested first, then the ways back in order, one per check.
5. **A goal with buttons:** a step can have both `goal` and `choose`, and one option is enough. An option's `if` shows it only while the condition holds (the market's Continue appears once there is cargo aboard).
6. **New conditions:** `asked` (start only), `course` (a course set, optionally to `port`), `screen` (`sea`, `chart` or `market` on screen), `bought` (`port`, optional `good`, `qty` since the step began) and `sails-practised` (lowered and raised the sails, steered, got under way). `docked` without a port means any harbour; `has-cargo` without `good`/`qty` means anything aboard.
7. **Map places by name:** `"wreck"` in `reach` points or `compass` is the map's prologue wreck. A step naming a place the map does not have is passed by (a map without a prologue skips the rescue).
8. **Coach marks as step data:** `coach: { sea, chart, market, port, good, action }` names the game element to ring per screen and the bubble's button; `port` can be a port, `home`, `$var`, `nearest` or `buyer:$var`, `good` a good, `$var` or `makes:$var`.
9. `clean` also restarts when the hull grinds on a reef (0139's rule for the wreck approach, now for every `clean` step).
10. **Old saves:** a tutorial in progress in the old format is picked up at the same step with its vars (`QuestBook.restore`). The tutorial's offered/skipped/completed choice stays per map in local storage.

`src/sim/tutorial.ts` is deleted. `src/ui/tutorial.ts` only draws the coach bubble from the tracked lesson's step (`lessonFor` in `questView.ts`). The lesson's text keys stay under `lesson.*`; `lesson.<step>.continue` became the option's `lesson.<step>.continue.title`.

## Consequences

- The tutorial opens in the quest builder like any quest (tag `lesson`), with its places on the chart, and can be played from any step. Fields without a form yet (`unless`, `set`, `coach`, `lesson`, `storms`, `vars`) are edited as JSON in the builder; options get a "Shown when" condition and a step can be "goal + buttons".
- 0139 behaviour is kept: calm 8 kn wind, foghorn every 9 s, the wreck marker and sea arrow, the clean slow approach; 0141 cards wait while the lesson runs.
- Rook's thanks starts when the tutorial reaches `island` (Rook brought home), when it is skipped, or on a voyage that never started it (`not quest-at first-voyage sails`), with no tutorial-only event. The tutorial offer runs no quest checks, so it cannot start early.
- A new kind of lesson (reefing in a gale, say) is still one new condition in `questLibrary.ts`, then data. Conditions that need more than the world (the screen, the helm) come through `QuestBookOptions` and `QuestBook.update`.
- The plays-the-same fingerprint was retaken: the tutorial's steps now run in the quest book's order.
