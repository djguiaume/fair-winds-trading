# v1.5 "A real game" (UI rebuild) — brief

Status: **approved** by Guillaume on 2026-11-01 16:00Z ("Ok to create all issue with lots of details and start"); milestone [v1.5 A real game](https://github.com/djguiaume/fair-winds-trading/milestone/8), tracker #446. Why: [UI review](../reviews/ui/review.md), [UI inventory](../reviews/ui/inventory.md). Decision: 0268. Runs after v1.4.1 (#357) and may run **alongside v1.6** "The far seas' story" (data only: quests and text, no shared files). Numbers swapped by Guillaume on 2026-11-01: the UI rebuild ships first as v1.5, the story follows as v1.6.

Guillaume's "done when" (2026-11-01): one visual language on every screen; a proper title, pause and settings flow; juicy feedback (sounds, animations, toasts); less on screen at sea; a clear identity (logo, type, signature colour). Everything may move or be redesigned. Phone **landscape** only, portrait is no longer required. Keep: sailing numbers visible by default, hazards off in Settings, everything data driven, no backdrop blur, the phone budget, no blue/teal plus gold "AI look", no lines on paper.

## The direction in one sentence

**One captain's instrument, not a website.** Every screen has one hero (the boat, the harbour, the chart, the sea), a few big choices, large type, one signature, and something moves whenever the game answers you.

## Identity: chosen on 2026-11-01 (three mockup rounds)

**Direction 1, "the chart table", round 3 D** (Guillaume, 2026-11-01 15:06Z; the art director agreed). Sheets and kit: project files `ui-review/mockups/` and [docs/ui-refactor/v1.5/](../ui-refactor/v1.5/) (PR #435). Ink on paper: sage `#4a6d41` as the signature on paper `#efe6d1` (night paper `#b9ab8a` at 80%), ink `#23303a`, IM Fell English for titles with Alegreya Sans for text, a compass rose with a banderole as the logo, torn paper edges as 9-slice images. Minimal at sea and on the title (text and marks on the scene with a hard 1 px ink halo, no boxes); framed paper in the harbour, Boat looks and the chart. Dropped: 2 "the sailing club" (round 1), 3 "the painted harbour" (round 2).

Rules fixed during the rounds (Guillaume unless noted):
- The **wind compass with the no-go zone** is its own dial, **top right**, never folded into another instrument; at least 96 px on desktop and 72 px on the phone; the no-go wedge solid at about 55% ink, hatched, crisp, never red; a thick wind arrow; the point-of-sail word beside it. It may be switched off on the hardest level.
- The speed in knots stays the biggest number on screen. The instrument always has a faint ink backing (40%) and never sits over land unbacked (art director).
- Harbour: Market and Quay as **one ledger across about 90%** of the width with the port as a strip above (round 3 D); Shipyard and Boat looks keep the boat visible (round 3 C) with the 3D preview area the biggest element and Buy below it. Rows about 64 px, names 18 px, prices 20 px, big Buy and Sell; the ledger fills down to the legend bar, never a blank lower half.
- Status text at sea at full ink with a halo, 14 px or more on desktop; phone text 12 px minimum.
- Title screen (round 4, Guillaume 2026-11-01 15:33Z): **the logbook page**, a full-height torn page on the left with the stacked logo and the menu (Continue as the one sage row, the other rows the same size), the key art on the right graded toward the game's sea and sand, with the torn edge kept where the page meets the art. The art director's condition: the key art is the real game (a golden-hour render at the Saltmere quay) or the cover graded to it; the tagline is confirmed by the storyteller.
- Chart legend shows the wind and the no-go wedge (art director).

## Guillaume's ChatGPT mockups (2026-11-01)

Twelve images in the project files (`ui-review/references-chatgpt/`, notes there). Guillaume: propositions only, not reviewed or agreed; each has good and bad parts. They are input for the mockup thread, not a bar: take what works (a goods list with a detail pane, illustrated goods, portraits on the quay, a pad legend, a HUD in clusters) and leave the rest. Their palettes happen to sit near the three directions.

## Screen rules (apply to the chosen direction)

- **Title screen.** A staged scene (the player's boat at anchor at golden hour, or the home port), the logo large, four actions: Continue (or Set sail), New voyage, Free Sailing, Settings. Help, tutorial and save transfer move to a secondary row or into Settings. Shown once, with a short fade and a sting.
- **Pause.** A small centred card over the dimmed sea: Resume, Chart, Settings, Quit to title. Never the title sheet.
- **Settings.** Tabs: Game (difficulty, hazards, tutorial), Display (quality, camera, motion), Sound, Controls (pad glyphs). Each tab fits a phone landscape screen without scrolling where possible. New game lives under Game with a confirm.
- **New voyage.** The three levels as three big choices over the scene, with the boat shown; one line each, Set sail as the single big action.
- **Sea HUD.** Three clusters instead of nine boxes: status (gold, hold, quest step) top-left; one combined instrument (compass, wind, speed, heading, point of sail) top-right; actions (sails, dock, chart, menu) bottom. Plates lose their borders; secondary text fades after a few seconds of no change; a "quiet HUD" setting shows only the instrument. The sailing numbers stay visible by default. Port labels move off the shoreline. The close chase camera (#432) is an optional view with the quiet HUD.
- **Harbour screen.** The 3D port stays the backdrop (not a cropped banner). Left: the port card (who is here, wants, makes) with the people as portraits you tap. Centre: the market as goods cards or a ledger page with big buy and sell controls and the price trend shown, not a table. Right: your boat (hold, upgrades, looks). Set sail is the one big action. The phone gets the same three panes as swipeable pages.
- **Chart.** A paper chart with a compass rose, engraved coast, ink labels; journal, cargo and prices as book tabs on the side. The player's boat and course drawn in ink.
- **Cards and moments.** Quest card keeps its shape but never covers the quest chip or the whole phone screen. New moments: arrival banner ("Saltmere" with its tagline), sale and purchase ticks (coins roll, a sound), quest step stamp, race horn and finish board, day to night.
- **Feedback and motion.** One motion system: 150 to 250 ms screen transitions, pressed buttons, number rolls, toasts that slide; every animation honours reduced motion and costs nothing per frame when idle.

## Waves and parts

Same pause rule as v1.4: Guillaume checks token use between waves and says go. At most 3 to 5 threads at once. Every visual part: `visual` label, Guillaume's `visual-ok` before merge.

| Wave | Part | Effort | Visual | Model |
| --- | --- | --- | --- | --- |
| 0 | #433 Phone landscape bugs: clipped titles, port tab content cut off, pause sheet taller than the screen, quest card over the chip, settings scroll (#433) | low | yes | Sonnet |
| M (done) | Identity mockups, three rounds, direction 1 round 3 D chosen; the art bible UI section is rewritten from the kit's README in wave 1 | med | yes | Opus |
| 1 | #438 UI foundation: tokens (colour, type, space, radius, elevation, motion, z) in `src/data/ui/theme.json`, components (button, tab bar, card, panel, list row, dialog, toast, screen header), a screen stack with transitions replacing the `hidden` wiring in `main.ts`, pad focus kept; theme editable in the editors and `npm run theme` (0153) | high | no | Opus |
| 1 | #439 Identity assets: logo, wordmark, pennant motif, icon style pass on the sprite (one weight), fonts | med | yes | Sonnet |
| 1 | #440 Title, pause, settings and New voyage on the foundation | med | yes | Sonnet |
| 2 | #441 Sea HUD regroup, quiet HUD setting, idle fade, port labels, race and quest chips | high | yes | Opus |
| 2 | #442 Moments and feedback: arrival banner, trade ticks, quest stamp, race horn and board, UI sounds (`npm run sound`) | med | yes | Sonnet |
| 2 | #432 Close chase camera | med | yes | Sonnet |
| 3 | #443 Harbour screen rebuild (market, quay, shipyard, home island) | high | yes | Opus |
| 3 | #444 Chart rebuild (paper chart, book tabs, course in ink) | high | yes | Opus |
| 4 | #445 Free Sailing, Boat looks, club board and regatta screens on the components; tutorial coach marks; remove the old CSS files; release notes and ADR acceptance | med | yes | Sonnet |

Not in scope: portrait layouts (dropped), the Xbox store work, any gameplay change. Prices, text and story stay with the storyteller.

## Done when

Every screen uses the components and the theme file (no per-screen CSS families left), the five worst screens are rebuilt and approved by Guillaume, the sea HUD has three clusters and a quiet mode, feedback moments exist with sound, phone landscape has no clipped or cut content, `?bench` on a phone is within budget, and the art bible's UI line points to the new identity.

## Role questions

Art director (one message): review the three mockup directions with Guillaume; after the pick, write the UI section of the art bible with the mockup thread. Storyteller: taglines for the arrival banners and the title screen (EN and FR), when wave 2 starts.
