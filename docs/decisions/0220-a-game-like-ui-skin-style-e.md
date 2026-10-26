# 0220. A game-like UI skin (style E)

**Status:** Proposed (2026-10-26). Part of the v1.1 plan ([plan](../v1.1/plan.md#ui-reskin-a-game-like-look-style-e)); built in v1.1 after mockups are approved.

## Context

A coworker of Guillaume opened v1.0 with no knowledge of the game and said at once "wow, that's made by Claude", from the look alone. A read-only review on 2026-10-26 (live game v1.0.254, the UI CSS, and the screenshots of the harbour header, quest cards, chart and sea HUD) agreed: the 3D world reads as a game, but the interface around it reads as a generic dark-mode web dashboard, the look AI tools tend to produce.

The traits, strongest first:

1. **Navy glass panels with a gold accent and rounded boxes with a thin low-contrast border** everywhere (`--navy`, `--brass-line`; `border-radius` 6 to 12 px about 90 times in `src/ui/*.css`).
2. **Small all-caps labels with wide letter spacing** on almost everything (`text-transform: uppercase` about 70 times, `letter-spacing` about 85): "THE" over the title, "BEST ELSEWHERE", "HOLD", "LOT".
3. **Thin outline icons** in the title menu (`i-compass`, `i-book`, `i-gear`, `i-transfer`) and a **green note on the right of a menu row** ("9 short steps", "QR code or file"): a settings-page pattern.
4. **Tag pills and "·" chains**: HOME PORT / MAKES / WANTS / VILLAGE · 0% chips, count badges, and 48 strings with "·" in `src/i18n/en.json` ("BREEZE E · 13 KN", "TRADING & SHIPYARD · 1.0").
5. **The new voyage screen looks like a pricing page**: three equal cards, bullet lists, a "STANDARD" badge and a gold ring on the middle one.
6. **Large flat empty navy areas** (port screen under the market rows, Quay tab, new voyage screen) with no material or texture.
7. **Wording habits**: two-beat taglines ("Read the wind. Deliver the goods."), arrows inside sentences ("would like a word → Quay").

What already reads as a game and stays: the chart (parchment, teal sea, sand islands), the low-poly portraits ([0124](0124-characters-look.md)), the full-colour goods icons, the wind compass and speed log, the chunky pressed buttons, the 3D harbour view in the port header ([0211](0211-the-port-in-the-harbour-screen.md)).

## Decision

Plan a **reskin, not a rebuild**, as a v1.1 part: **style E**, the successor of style D ([0049](0049-ui-instrument-style.md)).

- **Keep:** every layout, screen, tab, the navigation and menu order ([0061](0061-menus-and-coach-marks.md)), pad focus and the Xbox ring ([0203](0203-pad-focus-ring-without-the-browsers-focus.md)), touch sizes, portrait layouts, the HUD's information and its placement, the no-blur rule for old tablets ([0006](0006-desktop-and-mobile.md)), self-hosted fonts and the inline SVG sprite.
- **Change the skin:** materials instead of navy glass (painted wood, sailcloth, logbook paper, brass fittings), drawn as small SVG frames used through `border-image`; a nautical serif or slab font for titles; far fewer spaced capitals, pills and "·" chains; a logbook-page title menu; pennants for the three difficulty levels; filled two-tone icons; the empty areas filled with material and a scene.
- **Order:** art bible section and static mockups first (art director, then Guillaume sees every screen), then one build thread screen by screen, the same order as style D: Sea HUD, port screen, chart, menus and cards.
- The full brief, screen by screen, with tokens, checks and sizes, is in the [v1.1 plan](../v1.1/plan.md#ui-reskin-a-game-like-look-style-e).

## Consequences

- The UI tokens move from `src/ui/sea-hud.css` `:root` into one theme file so the skin is changed in one place; `hud.css` loses its last style-B leftovers (`'Trebuchet MS'` body font).
- One more font (~20 to 40 KB WOFF2, SIL OFL, latin subset) and a handful of small SVG frames; checked with `?bench` on the old tablet.
- Every screenshot in the docs that shows the UI goes stale; the mockup and build threads retake them with `npm run shots`.
- Text changes (fewer "·" and arrows) go through the storyteller for both languages.
- Accepted when Guillaume picks a mockup direction; this ADR is then updated with the chosen font, colours and frames.
