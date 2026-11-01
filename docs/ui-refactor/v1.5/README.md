# v1.5 identity mockups: four rounds to the chart table (2026-11-01)

Static mockups only, nothing built. Asked by the [v1.5 brief](../../v1.5/brief.md) ("Identity first") and the [UI review](../../reviews/ui/review.md). Each direction is a full identity (logo, signature colour, type pair, motif, materials) on the same screens over the real game: title, sea HUD at night (plus day with the arrival banner and a storm with the storm warning), harbour Market and chart, desktop 1280 × 800 and phone landscape 844 × 390.

Sheets (one per direction, JPG, 1280 px wide) and every screen at full size: project files `ui-review/mockups/`.

The layout is the same in all three (the brief's screen rules and the useful parts of Guillaume's ChatGPT images): one hero per screen; the HUD in three clusters (status top left, heading strip and destination top centre, one big-number instrument bottom right, Map, Cargo and Menu bottom left); a harbour with the 3D port left visible between a Market pane (goods list and a detail pane with the price trend) and a people pane; a chart with book tabs. Only the identity changes.

## Where we are

**Pick (Guillaume, 2026-11-01): direction 1, the chart table, as round 3 D, with title 6.** Minimal at sea and on the title, paper in the harbour, Boat looks and the chart; the harbour is one ledger across about 90% of the width with the port as a strip above; the title is the logbook page beside painted key art (the README cover graded to the game's colours) with the torn page edge. Every proposition is kept below and in [sheets/](sheets/) (each sheet cut into pages at most 1900 px tall).

## Every round

| Round | Proposition | Sheets | Outcome |
| --- | --- | --- | --- |
| 1 | **1 The chart table**: ink on paper, sage | [round1/chart-table-*](sheets/round1/) | Kept for round 2 |
| 1 | **2 The sailing club**: slate, burgee pink, condensed type | [round1/sailing-club-*](sheets/round1/) | Dropped; its big-number instrument went into every direction |
| 1 | **3 The painted harbour**: painted wood, bottle green | [round1/painted-harbour-*](sheets/round1/) | Kept for round 2 |
| 2 | 1 and 3, each **A framed** and **B minimal** | [round2/](sheets/round2/) | 1 chosen as a mix (minimal at sea and on the title, paper in the harbour); 3 dropped, its goods colour coding and chunky Buy and Sell kept |
| 3 | 1 as the mix, **C** panes at 65% | [round3/chart-table-C-*](sheets/round3/) | Not chosen |
| 3 | 1 as the mix, **D** a ledger across 90% | [round3/chart-table-D-*](sheets/round3/) | **Chosen** ("Round 3 D is the winner"); its minimal title "still bad" |
| 4 | Titles **1 Ledger**, **2 Chart table**, **3 Logbook page**, **4 Live harbour** | [round4-title/titles-*](sheets/round4-title/) | 3 recommended by this thread and the art director, 2 by the UI lead |
| 4 | Title **5**: 3 with the cover graded to the game and a straight inked edge (art director's terms) | same sheet | Edge not chosen |
| 4 | Title **6**: 5 with 3's torn page edge | same sheet, [pick-title-6-*](sheets/round4-title/) | **Chosen** ("Go with the last one but with the torn edge of 3") |

| Build | **Identity assets** (#439): logo, icon pass, fonts, favicon and PWA icons, built from the pick | [identity/](sheets/identity/) | Awaiting Guillaume's `visual-ok` |

## Rules learned from Guillaume's feedback (keep for later rounds)

- The wind compass is its own dial, top right, with the no-go zone hatched (never red); the speed stays the biggest number.
- Text on the scene gets a hard 1 px ink halo or a faint ink plate, never blur; the instrument always has a backing.
- The harbour may cover most of the screen (a ledger) if the port stays visible as a strip.
- Title art may be generated in the game's style (not only game frames), graded to the game's colours.
- Torn paper edges stay, over straight inked edges. Menu rows are large plain rows, the same as Continue.

## 1. The chart table

| | |
| --- | --- |
| Idea | Ink on paper: an engraved compass rose, a drawn serif, torn chart pages |
| Signature | **Sage** `#557a4b` (wash `#cfdcbc`, dark `#3f5e37`) |
| Base | Paper `#efe6d1`, paper at night `#dccfb1`, ink `#23303a`, muted ink `#5b6670` |
| Type | IM Fell English (titles, wordmark, port names) + Alegreya Sans (UI and numbers) |
| Motif | Compass rose with a sage banderole ("Trading Company"); torn paper edge |
| Materials | Plain paper with a fine grain and a torn edge. No leather, no brass, no lines on paper |
| Takes from | Skull and Bones (pages, ledger), Sea of Thieves (one material language), ChatGPT 01/02/11/12 (cream, navy ink, sage selection) |

## 2. The sailing club

| | |
| --- | --- |
| Idea | Sportive and bold: slate and sailcloth, condensed type, big numbers, slanted tiles |
| Signature | **Burgee pink** `#ff5a8f` (dark `#c93d6d`) |
| Base | Slate `#161e25` (panels at 90%), slate 2 `#24303a`, slate 3 `#33424d`, sailcloth `#f2f4ef`, muted `#8f9ea9` |
| Type | Saira Condensed (titles, numbers) + Barlow (body, already in the game) |
| Motif | The club burgee (pink, a sailcloth wind cut) and the slant |
| Materials | Flat colour, square corners, no texture |
| Takes from | Forza Horizon (one wordmark, one accent, big numbers, slanted tiles), Seafarer (calm instrument), ChatGPT 04/08 (dark, condensed) |

## 3. The painted harbour

| | |
| --- | --- |
| Idea | Cosy and illustrated: painted wood and sailcloth, a hand-lettered hanging sign, colour-coded goods |
| Signature | **Bottle green** `#2f6d4f` (dark `#20503a`, wash `#d3e3cf`, on wood `#9fd3b2`) |
| Base | Painted wood `#3e2b20`, sailcloth `#f3ead6` / `#e5d6b4`, ink `#2c211a` |
| Goods | Fish `#4f86ad`, grain `#d29a2e`, timber `#9c6236`, stone `#858d94` |
| Type | Caprasimo (sign, titles, speed) + Nunito Sans (UI) |
| Motif | The harbour sign; brushed paint edges |
| Materials | Canvas grain on wood (no seams), cream sailcloth cards, 10 px radius, one darker lip, no bevels |
| Takes from | Sea of Thieves (painted objects, hand lettering), Zombie Assault Resurgence (big tap targets, colour coding), ChatGPT 05/07/09 (painted banner, cream panels) without their teal |

## Rules checked on every direction

- Signature colours avoid the reserved ones: red (edge buoys), amber `#ffb36b` (storm warning, shown on the storm tile), yellow (regatta marks), brass `#e8c46a` (player pennant, HUD). No blue or teal with gold.
- Never pure white: the lightest colour is sailcloth `#f3ead6` or `#f2f4ef`, under the `#f6f9fb` limit. Coins are ink, sailcloth or copper, never brass. Phone text 11 px at least, sentence case, no tracking, no backdrop blur.
- The logo pennants do not match `flags.json`: sage banderole (1), pink burgee (2; the club and Kestrel burgees are navy and red), no flag (3).
- Pad glyphs have their own neutral colour (ink, sailcloth), never the reserved red or yellow.
- The harbour panes leave the boat and the quay visible; the arrival banner sits at the top centre, off the shoreline.
- Paper and dark panels read on the real sea by day, at night and in the Stormbreak.

## Not real yet

- The title light: the game's dusk at Saltmere is grey, so the title has a warm grade drawn over it (a mockup layer; the build would need a real golden-hour scene).
- Torn and brushed edges are SVG filters here; the build would use 9-slice images (no per-frame filters, phone budget).
- Port tagline "Home port" is a placeholder for the storyteller. The Boat looks screen's cream cards and bark tabs are not drawn; directions 1 and 3 absorb them naturally (paper, wood), direction 2 would repaint them slate.
- No `?bench`, no French text, no real controller.

## Round 2 (2026-11-01): chart table and painted harbour, framed and minimal

Direction 2 (sailing club) is dropped. Sheets: project files `ui-review/mockups/round2/` (`1-chart-table-r2.jpg`, `3-painted-harbour-r2.jpg`), each with **A. Framed** (paper or paint plates) and **B. Minimal** (text and marks straight on the scene, nothing framed, after Guillaume's ChatGPT images 03, 06 and 10) side by side: title, sea by day, sea at night and harbour market, desktop and phone landscape.

What changed, from Guillaume and the art director:

- **Wind compass, its own dial** (next to the speed, never folded into it): boat up, the card turns with the heading, the wind arrow, and the **no-go zone** (45° each side of the wind) shaded with a dashed edge, not red. It could be switched off on the hardest level.
- **Big-number instrument** in both: speed, point of sail, heading, sails (Down, Half, Full with LT and RT).
- **Market** at about 62% of the width (790 px desktop, 540 px phone) with the boat and the quay visible to its right. Rows 56 px (42 px on phone), goods names 24 to 26 px, prices 22 px, Buy and Sell 64 px tall. Price trend in the detail pane.
- **Goods colour coding** (fish, grain, timber, stone) and chunky Buy and Sell now in both directions. The chart table softens the colours to washes (`#8fb0c6`, `#ddb860`, `#bf8f66`, `#aeb1ad`).
- **Night plates** are dimmer: night paper `#cbbd9c` and night sailcloth `#d6c9ad`, both at 90% opacity.
- **No filters.** Torn paper and brushed paint are 9-slice PNGs made by `slices.py` (192 px at 2x, slice 40, the shadow baked in). The minimal variant uses text shadows and under-strokes for legibility.
- **Sage contrast** (chart table): the signature is darker, `#4a6d41`, so paper text on it is 5.1:1 (it was 4.2). Sage text on paper uses `#36532f` (7:1). On the sea the minimal HUD uses `#cfe0bf`.
- **Bigger title**: logo 128 px, Continue 42 px, menu 34 px on desktop. The painted harbour sign is 620 px wide.

Redraw round 2: `node docs/ui-refactor/v1.5/render.mjs --r2`, then `python3 docs/ui-refactor/v1.5/sheet_r2.py docs/ui-refactor/v1.5/out-r2 <dir>`. In a browser, add `&v=framed` or `&v=minimal` (loads `chart-r2.css` or `harbour-r2.css`).

## Round 3 (2026-11-01): the chart table as the mix, variants C and D

Guillaume's pick: direction 1 only, minimal at sea and on the title, paper in the harbour, Boat looks and the chart. Two previews with every fix applied; they differ only in how much of the screen the harbour panes cover. Sheets: project files `ui-review/mockups/round3/` (`1-chart-table-r3-C.jpg`, `1-chart-table-r3-D.jpg`), each with sea by day, sea at night, harbour Market, Quay and Shipyard, Boat looks, chart and title, desktop beside phone landscape.

- **C:** the panes at about 65% of the width (820 px desktop, 548 px phone), the boat and the quay visible on the right.
- **D:** one ledger across about 90% of the width (1140 px desktop, 764 px phone) with the port as a strip above it. The wider ledger adds each good's trend and best price elsewhere to the market, the upgrades sit side by side, and the 3D preview area is bigger.

What changed since round 2:

- **Wind compass top right**, its own dial, 176 px desktop and 104 px phone (round 2: 150 and 92, bottom right), with the point of sail ("Beam reach") and the breeze beside it. The no-go wedge is solid ink at 55% with light hatching and crisp solid edges, never red; the wind arrow is 8 px thick with a big head.
- **Speed stays the biggest number** (96 px desktop, 58 px phone). The instrument always sits on a faint backing (ink at 40%, no blur) so it never lies bare on land.
- **Text on the scene** has a hard 1 px ink halo, no blur (the build would use a text stroke). The title menu is light with the same halo.
- **Night paper** is dimmer and more see-through: `#b9ab8a` at 80% (round 2: `#cbbd9c` at 90%), with darker muted ink `#3f4850` so small text holds. The Quay is drawn at night to show it.
- **Market:** names 26 px, prices 22 px, rows 56 px (66 px in D), Buy and Sell 64 px tall.
- **Phone:** status and labels 12 px (11 px is the floor), a roomier title menu (items 24 px, Continue 30 px, 8 px apart).
- **New screens:** the Quay (who is on the quay, the quest card with a big portrait, the step and the goal, Take the job and Not now); the Shipyard with a **reserved, empty area for the 3D model preview** (dashed, labelled, no painted render) beside the ship's numbers and Buy; Boat looks (#299's Wardrobe layout: slots, the real boat, the item grid, Use) on paper. On phone the Shipyard leaves the fleet list out (it would get its own tab).

Redraw round 3: `node docs/ui-refactor/v1.5/render.mjs --r3`, then `python3 docs/ui-refactor/v1.5/sheet_r3.py docs/ui-refactor/v1.5/out-r3 <dir>`. In a browser: `mock.html?r=3&w=c|d&s=title|hud|market|quay|shipyard|looks|chart&z=desktop|phone&t=day|night` (`screens-r3.js`, `chart-r3.css` for the sea and the title, `chart-r3-port.css` for the harbour, Boat looks and the chart). New backgrounds in `bg.json`: the harbour at night (`hn-*`) and the docked sloop for Boat looks (`lk`).

## Round 4 (2026-11-01): four title screens in the chart table style

Guillaume picked round 3 D and found the title still weak. Four title screens, staged differently, one sheet: project files `ui-review/mockups/round4-title/1-chart-table-titles.jpg`. Guillaume said the title art may be generated rather than taken from the game, so 1 and 3 use the README cover (generated in the game's style, `docs/images/readme/cover.png`) as painted key art; 4 shows the live game for comparison.

1. **Ledger:** the painted key art as a strip across the top, one torn ledger below with the logo and tagline on the left and the menu on the right (the same frame as the D harbour).
2. **The chart table:** no picture, the chart itself; the logo is the chart's cartouche at the top, the menu a paper card in the middle, the rose bottom left.
3. **Logbook page:** a full-height torn page on the left with the logo stacked (rose, wordmark, banderole) and the menu; the painted key art fills the right.
4. **Live harbour:** the real game (Saltmere, day) behind, the logo on a cartouche, the menu as a row of four big torn tiles; Continue is the sage tile (`slices/chart-sage.png`).

All four: the menu rows are large plain rows with the same height and type as Continue (art director), Continue selected in sage with the save line; phone landscape drops the pad bar (touch first) and keeps rows at 34 to 36 px. The cover is bright teal sea; a painting made only for the title could match the chart table palette better (not made: no paid credits spent).

**Picks (2026-11-01):** the art director recommends 3, on four conditions: key art that matches the game (a golden-hour render at the Saltmere quay, or the cover graded to the game's colours), a straight edge with a thin ink line between the art and the page, Continue as the only sage row, and a tagline the storyteller confirms. The UI lead prefers 2 (the player's boat as the ink mark) and accepts 3 on those terms. Drawn as **5** on the same sheet, then **6** (Guillaume's pick: 5 with 3's torn edge): title 3 with the cover graded by `grade_cover.py` (the teal sea pulled to the game's blue and quieted, a warm light from the top, baked into the image) and a straight inked page edge; the tagline "Read the wind, carry the cargo, find a home." is a placeholder for the storyteller. The game itself cannot light Saltmere at golden hour yet (its dusk is grey).

Redraw round 4: `node docs/ui-refactor/v1.5/render.mjs --r4`, then `python3 docs/ui-refactor/v1.5/sheet_r3.py --titles docs/ui-refactor/v1.5/out-r4 <dir>`. In a browser: `mock.html?r=3&s=title&k=1..6&z=desktop|phone` (`titles-r3.js`, `chart-r3-title.css`).

## Redraw

The sheets in [sheets/](sheets/) are cut from the contact sheets by `archive.py` (pages at most 1900 px tall and 500 KB, cut only between rows).

```sh
sh docs/ui-refactor/v1.5/setup.sh            # backgrounds, chart, portraits, fonts (from the real game)
node docs/ui-refactor/v1.5/render.mjs        # every screen, all three directions, into out/
python3 docs/ui-refactor/v1.5/sheet.py docs/ui-refactor/v1.5/out <dir>   # contact sheets
```

`mock.html?d=chart|club|harbour&s=title|hud|harbour|chart|identity&z=desktop|phone&t=night|day|storm` shows one screen in a browser (serve the folder). `screens.js` holds the shared markup, `art.js` the drawn parts (icons, goods, instruments, logos, chart overlay), `base.css` the shared layout and `chart.css`, `club.css`, `harbour.css` the three identities.
