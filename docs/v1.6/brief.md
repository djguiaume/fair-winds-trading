# v1.6 "A real game" (UI rebuild) — brief

Status: **proposed**, waiting for Guillaume's OK in his own words (then the milestone and issues are created, start-a-release skill). Why: [UI review](../reviews/ui/review.md), [UI inventory](../reviews/ui/inventory.md). Decision: 0268. Runs after v1.4.1 (#357) and may run **alongside v1.5** (data only: quests and text, no shared files).

Guillaume's "done when" (2026-11-01): one visual language on every screen; a proper title, pause and settings flow; juicy feedback (sounds, animations, toasts); less on screen at sea; a clear identity (logo, type, signature colour). Everything may move or be redesigned. Phone **landscape** only, portrait is no longer required. Keep: sailing numbers visible by default, hazards off in Settings, everything data driven, no backdrop blur, the phone budget, no blue/teal plus gold "AI look", no lines on paper.

## The direction in one sentence

**One captain's instrument, not a website.** Every screen has one hero (the boat, the harbour, the chart, the sea), a few big choices, large type, one signature, and something moves whenever the game answers you.

## Identity first: the mockup round (before any build)

An Opus thread draws **three directions as static images** (Guillaume prefers mockups over demos), each a complete identity: wordmark or logo, signature colour on a neutral base, type pairing, one motif (a pennant, wind lines, a rope, a compass rose), materials. Each direction shows the same four screens, desktop and phone landscape, day and night where it matters: title screen, sea HUD, harbour screen, chart. One contact sheet per direction, JPG, at most 1280 px wide. Guillaume and the art director see them in one round.

| Direction | Idea | Feeds from |
| --- | --- | --- |
| **1. The chart table** | Ink and paper: engraved chart, a captain's ledger, brass instruments; a drawn wordmark with a swallow-tail pennant | Skull and Bones pages, Sea of Thieves materials |
| **2. The sailing club** | Sportive and bold: condensed type, big numbers, flat sailcloth white and dark slate, a burgee (club pennant) as logo and a single accent colour | Forza Horizon, Seafarer instruments |
| **3. The painted harbour** | Cosy and illustrated: painted wood and sailcloth, chunky rounded buttons, a hand-lettered logo, warm palette, colour-coded goods | Sea of Thieves, Zombie Assault Resurgence readability |

Each direction names its signature colour; none uses blue or teal with gold as the pair. Lines on paper stay banned; a plank or canvas texture is fine on backgrounds. The mockup thread is told Guillaume's past rejections (red confirm buttons, plank seams, teal-and-brass menus).

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
| 0 (v1.4.1 or now) | Phone landscape bugs: clipped titles, port tab content cut off, pause sheet taller than the screen, quest card over the chip, settings scroll (#433) | low | yes | Sonnet |
| M | Three identity mockups, one review round, identity chosen and recorded (art bible UI section rewritten) | med | yes | Opus |
| 1 | UI foundation: tokens (colour, type, space, radius, elevation, motion, z) in `src/data/ui/theme.json`, components (button, tab bar, card, panel, list row, dialog, toast, screen header), a screen stack with transitions replacing the `hidden` wiring in `main.ts`, pad focus kept; theme editable in the editors and `npm run theme` (0153) | high | no | Opus |
| 1 | Identity assets: logo, wordmark, pennant motif, icon style pass on the sprite (one weight), fonts | med | yes | Sonnet |
| 1 | Title, pause, settings and New voyage on the foundation | med | yes | Sonnet |
| 2 | Sea HUD regroup, quiet HUD setting, idle fade, port labels, race and quest chips | high | yes | Opus |
| 2 | Moments and feedback: arrival banner, trade ticks, quest stamp, race horn and board, UI sounds (`npm run sound`) | med | yes | Sonnet |
| 2 | Close chase camera (#432) | med | yes | Sonnet |
| 3 | Harbour screen rebuild (market, quay, shipyard, home island) | high | yes | Opus |
| 3 | Chart rebuild (paper chart, book tabs, course in ink) | high | yes | Opus |
| 4 | Free Sailing, Boat looks, club board and regatta screens on the components; tutorial coach marks; remove the old CSS files; release notes and ADR acceptance | med | yes | Sonnet |

Not in scope: portrait layouts (dropped), the Xbox store work, any gameplay change. Prices, text and story stay with the storyteller.

## Done when

Every screen uses the components and the theme file (no per-screen CSS families left), the five worst screens are rebuilt and approved by Guillaume, the sea HUD has three clusters and a quiet mode, feedback moments exist with sound, phone landscape has no clipped or cut content, `?bench` on a phone is within budget, and the art bible's UI line points to the new identity.

## Role questions

Art director (one message): review the three mockup directions with Guillaume; after the pick, write the UI section of the art bible with the mockup thread. Storyteller: taglines for the arrival banners and the title screen (EN and FR), when wave 2 starts.
