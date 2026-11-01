# v1.6 identity mockups: three directions (2026-11-01)

Static mockups only, nothing built. Asked by the [v1.6 brief](../../v1.6/brief.md) ("Identity first") and the [UI review](../../reviews/ui/review.md). Each direction is a full identity (logo, signature colour, type pair, motif, materials) on the same screens over the real game: title, sea HUD at night (plus day with the arrival banner and a storm with the storm warning), harbour Market and chart, desktop 1280 × 800 and phone landscape 844 × 390.

Sheets (one per direction, JPG, 1280 px wide) and every screen at full size: project files `ui-review/mockups/`.

The layout is the same in all three (the brief's screen rules and the useful parts of Guillaume's ChatGPT images): one hero per screen; the HUD in three clusters (status top left, heading strip and destination top centre, one big-number instrument bottom right, Map, Cargo and Menu bottom left); a harbour with the 3D port left visible between a Market pane (goods list and a detail pane with the price trend) and a people pane; a chart with book tabs. Only the identity changes.

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

## Redraw

```sh
sh docs/ui-refactor/v1.6/setup.sh            # backgrounds, chart, portraits, fonts (from the real game)
node docs/ui-refactor/v1.6/render.mjs        # every screen, all three directions, into out/
python3 docs/ui-refactor/v1.6/sheet.py docs/ui-refactor/v1.6/out <dir>   # contact sheets
```

`mock.html?d=chart|club|harbour&s=title|hud|harbour|chart|identity&z=desktop|phone&t=night|day|storm` shows one screen in a browser (serve the folder). `screens.js` holds the shared markup, `art.js` the drawn parts (icons, goods, instruments, logos, chart overlay), `base.css` the shared layout and `chart.css`, `club.css`, `harbour.css` the three identities.
