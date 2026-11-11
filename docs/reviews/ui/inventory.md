# UI inventory (2026-11-01)

Input for the UI review ("feel like a real game"). Facts from the code at `main` (170a0b8), found with graphify plus targeted greps. Counts are approximate. Line counts are for `src/ui/` unless noted.

## 1. How the UI is built

- Vanilla TypeScript and DOM, no framework. Static markup lives in `index.html` (1966 lines, 45 SVG sprite symbols, 194 `data-i18n` attributes); panels with dynamic content are built with template strings (`innerHTML`, 29 places) in `src/ui/*.ts`.
- Screens are shown by toggling `hidden` (sheets, menu) or `<dialog>.showModal()` (chart, cards, confirm). `src/main.ts` (2173 lines) owns the open/close functions and `padScreen()`.
- CSS: 11 plain global files, about 6960 lines, no CSS modules or preprocessor. Seven are linked from `index.html` (hud, sea-hud, port-screen, home, sea-chart, menus, quests); the others are imported by their TS file. `theme.css` is imported last (from `levelCards.ts`) and overrides the older files.
- Order of authority: `theme.css` repaints, the older files "keep the layout" (comment in theme.css). So one screen's look is split across two or three files. `!important` is used 16 times (menus 11).

## 2. Screens and panels

| Screen | TS (lines) | CSS | Opened by | Pad | Touch |
|---|---|---|---|---|---|
| Splash / loading | splash.ts 26 | splash.css 60 | on boot, `#splash` | n/a | n/a |
| Title / pause menu (`#menu`, side + sheet) | in main.ts `showMenu` | menus.css 1501 | start, Menu button | yes (`padScreen`) | yes |
| New voyage (difficulty cards) | levelCards.ts 102 | menus.css | menu, `openNewVoyage` | yes | yes |
| Settings (`#settings` sheet) | settings.ts 156, graphicsSettings.ts 109 | menus.css, graphicsSettings.css 12 | menu / pause | yes | yes |
| Help / how to play | in main.ts | menus.css | menu, `openHelp` | yes | yes |
| Save transfer (QR) | transferPanel.ts 239, qr.ts, qrScanner.ts | menus.css | menu | yes | yes |
| Tutorial offer dialog + coach marks | tutorial.ts 413 | menus.css, quests.css | first start, menu | dialog: yes; coach: points at targets | yes |
| Sea HUD: stats, speed log, wind compass, sail buttons, tiller, toast, objective | hud.ts 769, windFeedback.ts, viewSwitches.ts, seaSwitches.ts | hud.css 1025, sea-hud.css 1123 | always at sea | pad button hints only | yes |
| Camera controls | cameraControls.ts 95, compassCamera.ts | camera.css 48 | sea | yes | yes |
| Port labels / boat labels | portLabels.ts 255, boatLabels.ts | hud.css | at sea | no | tap |
| Port screen (trade, ship, upgrades) | tradePanel.ts 1380 | port-screen.css 798, theme.css | dock, `openHarbour` | yes (`padFocus` in tradePanel) | yes |
| Home island panel | homePanel.ts 356 | home.css 287 | home island | yes | yes |
| Sea chart (map, journal, hold, market, legend) | seaChart.ts 1720, chartMarks.ts, seaLines.ts, seaOutline.ts | sea-chart.css 872 | Chart button | tabs yes, map uses the cross | yes (pinch, zoom) |
| Quest card (dialog), quest note, quest view | questCard.ts 248, questNote.ts 87, questView.ts 915 | quests.css 908 | quest engine | dialog: yes | yes |
| Portraits | portraits.ts 565 | quests.css, port-screen.css | cards and port | n/a | n/a |
| Regatta view | regattaView.ts 212 | port-screen.css | club, race | via port screen | yes |
| Club board | clubBoard.ts 73, clubBoardView.ts 38 | club.css 65 | club building | yes | yes |
| Boat looks (cosmetics) | boatLooks/ 5 files, 790 | boatLooks.css 362, Small 135 | menu / port | yes (dialog) | yes |
| Free Sailing setup | freeSailing/ 4 files, 370 | freeSailing.css 158 | menu | yes | yes |
| Confirm dialog | confirmDialog.ts 30 | menus.css | anywhere | yes | yes |
| Hazard marker, test badge, quest test bar, FPS, pad log | hazardMarker.ts 118, testSeaBadge.ts, questTestBar.ts, padLog.ts | sea-hud.css | sea, dev flags | n/a | n/a |

Pad support is central: `padFocus.ts` (531) moves focus inside whichever screen `padScreen()` in main.ts returns, and shows glyphs from `padGlyphs.ts` (Xbox/PlayStation/etc.). A new screen needs a branch in `padScreen()` or to be a `<dialog>`.

## 3. Theme and tokens (`theme.css`, 265 lines)

- About 60 colour tokens in four families: HUD "navy" (actually dark teal, `--navy` #17404f), brass/gold, paper (`--paper*`, `--paper-ink*`), leather (`--leather*`, plank texture), plus teal, sail, danger. Night variant for paper only (`:root[data-night]`).
- Context swap: a long selector list (`.on-paper, .port-screen .trade-content, .chart-sheet, .menu-side, ...`) re-maps `--ink`, `--brass`, `--navy` etc. for paper surfaces. So `--brass` means gold on dark and teal on paper. This is confusing and fragile.
- Type scale: 12 size tokens (11 to 44 px) used in 400+ rules. Three families: Fraunces (serif titles), Barlow Condensed (display), Barlow (body); all subset WOFF2 in `src/ui/fonts/` (OFL, README there). Font loading is `swap`.
- Missing tokens: spacing (none), radius (115 literal radii: 6px x25, 8px x17, 10px x13, 12px x11, 50% x16), shadows (46 `box-shadow` rules, mostly literal), motion/easing, z-index, touch target size, breakpoints.
- Literal hex still outside theme.css: sea-chart.css 51, hud.css 25, sea-hud.css 13, quests.css 5, home.css 4, menus.css 4, port-screen.css 3, splash.css 3, and 47 in TS files (chart drawing, icons).
- Tokens use the old name `--navy` for the teal plate and `--brass` for roles that are teal on paper. Names no longer match the style E colours.

## 4. Icons

- Inline SVG sprite in `index.html` (45 `<symbol id="i-...">`), used through `icon(id)` in `icons.ts` (15 lines). Coloured goods, coin, hull, anchor plus line icons. `crateIcon()` draws a fill-level crate inline with hardcoded colours.
- Pad glyphs are separate (`padGlyphs.ts`). Chart and map symbols are drawn on canvas in `seaChart.ts`.
- No icon style guide: mix of filled and outline icons, and the sprite sits inside the 1966-line HTML file.

## 5. Shared components vs one-offs

Shared (by class, not by code):
- `.d-btn` (20 CSS rules, 37 uses) with `.brass`, `.red`, `.big`; `.port-btn` (17 / 14) is a second button family doing nearly the same job, plus `.ship-btn`, `.upgrade-btn`, `.sell-all-btn`, `.lot-btn` restyled together in theme.css.
- `.sheet` / `.sheet-head` / `.sheet-body` for the full screens (settings, new voyage, transfer, help).
- `.menu-row`, `.seg` (segmented control), `.switch` toggles, `.d-dialog`, `.panel` (HUD plate), `.toast`, `.chart-chip`.
- Only `icon()`, `confirmDialog.ts` and `padFocus` are real TS components; there is no shared panel, card, tab, list-row or modal helper.

One-offs and near duplicates:
- Tabs: port screen tabs, chart tabs, boat looks tabs, settings graphics tabs are each styled separately.
- Cards: difficulty cards, quest card, tutorial offer, look cards, free-sailing preset cards, regatta cards.
- Three "paper" containers (menu-side, trade-content, chart-sheet) all re-skinned by the selector list in theme.css.
- Close buttons, back rows and headers repeat per screen (`sheet-head` vs `port-name` header vs chart top).
- `homePanel.ts` and `tradePanel.ts` share the `.port-screen` markup through `.home-screen .trade-modal.port-screen` overrides in home.css.
- Responsive: 55 `@media` rules, only 2 use pointer/hover queries, 11 CSS rules key off `html[data-input='pad']`. Layout is mostly handled per screen; no shared breakpoints.
- Motion: 5 `@keyframes` in total and 4 `prefers-reduced-motion` blocks. Little animation or feedback beyond toasts.

## 6. Data driven vs hardcoded

- Text: all UI strings go through i18n (`src/i18n/en.json`, `fr.json`, `t()`; 475 `t('` calls in `src/ui`). No untranslated string literals found by grep. Good.
- Data driven already: quests, goods, ships, towns, buildings, cosmetics, free sailing presets, controls (`src/data/controls.json`, pad), graphics switches (`graphics-switches.json`), tutorial steps.
- Hardcoded: the theme itself (all in CSS, not a data file); `index.html` layout of the HUD, menu and settings; menu item list and order; Settings rows (about 215 lines of markup in `index.html`); chart legend (about 110 lines of HTML); chart colours in `seaChart.ts`; panel sizes, radii and shadows. No UI layout or theme data file, and no editor or `npm run` tool for the UI look (relevant to decision 0153 if the redesign keeps looks tunable).

## 7. Size and structure flags (400-line rule)

Over 400 lines: `seaChart.ts` 1720, `tradePanel.ts` 1380, `questView.ts` 915, `hud.ts` 769, `portraits.ts` 565, `padFocus.ts` 531, `tutorial.ts` 413, `main.ts` 2173, `index.html` 1966. CSS over 400: menus 1501, sea-hud 1123, hud 1025, quests 908, sea-chart 872, port-screen 798, boatLooks 362 (close). `menus.css` holds menu, settings, help, transfer, new voyage, dialogs and the tutorial: eight screens in one file. `hud.css` still styles port, chart and dialogs as well as the HUD (per the comment at the top of sea-hud.css).

## 8. Test coverage

About 186 test files in `tests/`; UI-related logic is covered, rendering is not.
- Covered by unit tests: tradePanel (9 files), questView (21), settings (5), seaChart (5), questCard (3), regattaView (3), portraits (3), padFocus (2), tutorial (several), hud (2), levelCards (2), portLabels (2), clubBoard, boatLooks.
- No tests import: homePanel, transferPanel, freeSailing UI, graphicsSettings, confirmDialog, splash, cameraControls, chartMarks, hazardMarker, questNote.
- No visual regression tests. Screenshots come from `npm run shots` and the CI screenshot sheet on game PRs (decision 0224), reviewed by hand.

## 9. Findings that matter for the redesign

1. No design system: tokens cover colour and type only. Spacing, radius, shadow, motion and z-index are literals, so one visual language needs these tokens first.
2. Token names and role-swapping (`--brass` is teal on paper) make restyling risky; rename or restructure before a new look.
3. Layered CSS (old file layout plus theme.css repaint, `!important`) means a screen cannot be restyled in one place.
4. Two button families, four tab styles and several card styles are the main source of "no cohesion". One component set (button, tab, card, panel, row, dialog) would remove most of it.
5. Screens are wired by hand in `main.ts` and `padScreen()`; there is no screen stack or router, so pause / title / settings flow changes touch main.ts and the pad code.
6. Sea HUD markup is static in `index.html`; showing less at sea (a stated goal) is mostly CSS and `hud.ts` visibility logic, which are well separated.
7. Little motion and feedback code exists (5 keyframes, toast only), so "juicy" feedback is new work, and it must respect the old-tablet budget and the reduced-motion setting.
8. Strengths to keep: full i18n, pad focus and glyph system, light inline-SVG icons, no backdrop blur, data-driven content.
