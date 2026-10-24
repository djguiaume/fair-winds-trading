# 0159. Show the home island after Rook's thanks

**Status:** Proposed (2026-10-24), waiting on Guillaume's look at the screenshots.

## Context

Guillaume played the tutorial and finished on Rook's thanks card ("There's an old island near
here... It's yours"). He could not tell where the island was, whether he had it, what it was for,
or what to do next. In the game, `rooks-thanks.json` paid `homeIsland` and ended. Skerry (decisions
0126, 0128) was his from that moment, but nothing said so: no step sent him there, the chart showed
Skerry as a quiet italic name (hidden behind Ada's portrait at Stonehaven), and the four plots
only open when the arcs end.

## Decision

All of it is quest data or generic code that other quests can use too (the data-first rule of 0139):

- **Rook's thanks has two steps.** `home` (dock at Saltmere) now pays `homeIsland` as a step
  reward, then `skerry` asks the captain to moor at the island (`moored`, no port). Its card is
  Rook at Saltmere: *"There's an old island just west of Saltmere, Skerry... Go and have a look:
  moor at its pier and see what's there."* Its title, "Sail to Skerry", shows in the journal and on
  the sea's objective panel.
- **Rook explains the island on first mooring** (Guillaume, 20:45Z; storyteller the same), in two
  cards one after the other so neither is crowded (Guillaume, 21:02Z): the quest has no `port`, so
  its cards show where it is, at Skerry's pier. Step `plots` (a choice step with one option, "What
  are they for?"): *"Bare plots and a sound pier, captain. Help the people of the islands, Kit,
  Ines, Maren and Ada, and each will give you a plot, with a building of your choice for it."* Then
  the thanks card: *"Each building makes life at sea easier: cheaper repairs, room to keep cargo, a
  look at the wind ahead. Come back once you've helped someone, and choose."* Guillaume chose to
  tell the player now, lightly, that the buildings help (21:02Z); arc offers also read "a building
  for your island, with a lasting perk". No building is named (the plots reveal them), no new
  characters.
- **The arcs open as soon as the island is hers**: their start is `quest-at rooks-thanks skerry`
  (it holds once the step is reached or the quest is done), so seeing Skerry first is never a gate.
- **A `moored` step leads the chart and the sea to its island**: `questTarget` returns the island
  for a `moored` goal, so the chart draws the dashed route and ring and the sea's objective arrow
  points there (the epilogue's last step gains it too).
- **Her islands are marked on the chart**: a brass house badge on the island and its name in port
  style with "your island" / "votre île" underneath, for every owned island without a port
  (`chart.yourIsland`, symbol `#i-home`).
- Rook's tutorial line names Skerry and its side ("just west of Saltmere"; Skerry is due west).
- `npm run shots` gains `--quest id:step` (a quest started at a step, earlier rewards paid),
  `--moor island` (moored at one of her islands' piers, owned first) and `--click selector`; `fwt.moor()` and
  `testBerth()` accept an island id.

Wording: Head storyteller thread, within its lines (dry Rook, no urgency, vous, non-breaking space
before `: ; ! ?`). "Six bare plots" became "Bare plots" because only the four arc plots show.

## Consequences

- Saves keep working: a finished Rook's thanks stays finished; a voyage still at `home` moves on
  to `skerry` at its next Saltmere dock. Accepting an arc does not take the tracking away from
  "Sail to Skerry"; the captain picks another quest in the journal.
- The random tutorial hash in `plays-the-same.test.ts` is retaken (the island lesson's text).
- Screenshots: [docs/reviews/home-island-clear](../reviews/home-island-clear/README.md).
- Not done: a sea label over Skerry outside the step (the "Skerry · your island" banner shows while
  moored, the HUD arrow while the step runs), and setting a course to Skerry from the chart.
