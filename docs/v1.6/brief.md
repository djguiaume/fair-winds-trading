# v1.6 brief: "The far seas' story"

Milestone: [v1.6 The far seas' story](https://github.com/djguiaume/fair-winds-trading/milestone/7). Plan: [plan.md](plan.md). Story review that shaped it: [v1.6-review](../story/v1.6-review.md) (PR #472). Data and text only, except #469/#470. Storyteller (v1.6) writes every line; nothing can fail; balance on all three levels; hazard steps finish with hazards off.

| Order | Issue | Goal | Files | Done when | Effort | Visual | Model |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | #362 | Ness wants a word: line on Ada's done card or a news line, chart flag on Watchman Key | `src/data/quests/`, `src/i18n` | A player finishing any arc is pointed to Watchman Key | low | chart flag | Sonnet |
| 2 | #363 | Wren's standing order moves to Abbey Head; Quay line ties club and regatta | standing orders data | Order offered at Abbey Head only | low | no | Sonnet |
| 3 | #359 | One hazard event per sea as the sea's turn (south doldrums, east Stormbreak lull, north ice lead, west ash wind); outposts cut to one card; reunions shown on screen (Kit/Nell etc.); one washed-up oddity per sea pointing past the Stormbreak; Wren appears in each sea | quests data, i18n | Each step finishes with its hazard on and off; `npm run quest` check | medium-high | no | Opus |
| 4 | #360 | Re-scoped: cross-sea far-goods asks (standing orders only), settlers stop asking timber three times | standing orders, quests, i18n | Four cross-sea asks play; no trade automation (0120); `npm run balance` x3 | medium | no | Sonnet |
| 5 | #361 | Short chapter after Four Winds: mystery (what lies past the Stormbreak) then homecoming (the family on Skerry); Skerry grows. Option 2 of the storyteller, OK'd by Guillaume 2026-11-04: about 25-35 cards, 2-3 new quests | quests, i18n, Skerry data | Chapter plays end to end, nothing can fail | high | maybe | Opus |
| 6 | #469 | Chase camera: bright sky and blue sea | render | Chase view matches the other cameras' colours | medium | yes | Opus high |
| 7 | #470 | Sky dome for low views: gradient, sun, moon, clouds | render | Low views show a real sky, `?bench` within budget | high | yes | Opus high |

Also free in the same pass: vary the four "Rook will want that in the book" closers (in #359/#360).
Threads: #362+#363 can share one thread; #469+#470 are one engine thread (same sky code), run after #361's decision. Max 4 at a time; #359 and #361 share the story arc, so one story thread after the other (#361 builds on #359's oddities). Guillaume allows Fable or Opus for story threads where better.
Not in v1.6: pirates, new sea, store ports. Stranger playtest #364 stays before the store build.
