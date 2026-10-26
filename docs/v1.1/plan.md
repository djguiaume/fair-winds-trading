# v1.1 — "The Sailing Club" (potential plan)

Status: **potential plan**, not scheduled. Nothing here starts before v1.0 ships, and it does not
change the Phase 5 plan ([brief](../phase-5/brief.md)). Written from Guillaume's notes of
2026-10-25.

## The idea

The first update after v1.0 is **bug fixes plus new races**.

- **Name: "The Sailing Club"** (« Le Club de voile »), picked over "Gotta go fast" because it
  fits the game's calm tone, and confirmed by the Head storyteller on 2026-10-25.
- **Pitch** (storyteller): "Wren opens a sailing club at Saltmere: new courses round the islands,
  a few with a squall to sail around, and a club board for your best times." / « Wren ouvre un
  club de voile à Saltmere : de nouveaux parcours autour des îles, certains avec un grain à
  contourner, et un tableau du club pour vos meilleurs temps. »
- It builds on the Saltmere Regatta ([0217](../decisions/0217-the-saltmere-regatta.md)): Wren
  Tally, *Kestrel*, races as quests with a `raced` goal, pars set by the balance bots on all three
  levels, `npm run race`.

## What is in it

1. **Bug fixes** gathered from v1.0 play (playtests, the old-tablet test, reports).
2. **New races**, as quests like today's eight, with their words from the storyteller and their
   pars written by the bots (`npm run race -- --all --pars --write`).
3. **Fixed storm positions in races** (below), so a storm to dodge gives a course its character.
4. **A game-like UI skin, "style E"** (below, decision
   [0220](../decisions/0220-a-game-like-ui-skin-style-e.md)), so the interface stops reading as
   AI-made. Added by Guillaume on 2026-10-26.

## Fixed storms in races

**Today:** storms are generated from the voyage's seed and drift across the sea
(`src/sim/storms.ts`). A quest can only switch them off with `storms: false`
(`src/sim/quests.ts`), and every race does, so the pars stay fair.

**Planned:** a race file lists its own storms instead.

- Each storm has a **position**, a **size**, a **strength** and an optional **slow drift**.
- They are the **same on every run**, so the bots sail around them when they set the pars, and
  each level stays fair.
- The race's storms replace the seeded ones while it runs (seeded storms stay held, as today).
- Placed by **dragging in the quest builder**, or with the CLI:
  `npm run race -- <id> --storm --at x,y` (with size, strength and drift options, and a way to
  move or remove one), matching the editors-plus-CLI rule.
- The **Settings › Storms** switch still turns them off; the pars must then still make sense
  (the bots set pars with and without the storms, or the race keeps one set of pars that holds
  either way: to decide when it is built).
- The quest checks (`npm run check`) check the storms: inside the sea, not on the start, finish or
  a mark, and the course still sailable round them.
- **Story rule** (storyteller): no race text may depend on a storm. With Storms off the course
  still runs, and the lines mention "weather" or "squall" only as flavour, as Elias does with the
  Stormbreak.
- Needs its own decision (ADR) when it is built.

**When:** saved for the new v1.1 races. If Guillaume wants it in one of today's races sooner, it
can be built then.

## UI reskin: a game-like look (style E)

Decision [0220](../decisions/0220-a-game-like-ui-skin-style-e.md) (Proposed). Added by Guillaume on
2026-10-26, after a coworker opened v1.0 cold and said "wow, that's made by Claude" from the look
alone.

### Why

The 3D world reads as a game. The interface around it reads as a generic dark-mode web dashboard,
the look AI tools tend to make. A review of v1.0.254 (live game, `src/ui/*.css`, the harbour
header, quest card, chart and sea HUD screenshots) found these traits, strongest first:

| # | Trait | Where it shows | How loud |
| --- | --- | --- | --- |
| 1 | Navy glass panels, gold accent, rounded boxes with a thin low-contrast border | Title menu, port screen, quest cards, HUD chips. `--navy`, `--brass-line`; `border-radius` 6 to 12 px about 90 times | Very: the first screen |
| 2 | Small all-caps labels with wide letter spacing | "THE" over the title, "BEST ELSEWHERE", "HOLD", "LOT", tabs, tags. `uppercase` ~70 times, `letter-spacing` ~85 | Very |
| 3 | Thin outline icons plus a green note on the right of a menu row | Title menu: compass, book, gear, transfer icons; "9 short steps", "QR code or file" | Very: reads as a settings page |
| 4 | Tag pills, count badges and "·" chains | Port header tags (HOME PORT, MAKES, WANTS, VILLAGE · 0%), tab badges; 48 strings with "·" in `en.json` ("BREEZE E · 13 KN", "TRADING & SHIPYARD · 1.0") | Strong |
| 5 | A pricing-page layout | New voyage screen: three equal cards, bullet lists, "STANDARD" badge and gold ring on the middle one | Strong |
| 6 | Large flat empty navy areas | Port screen under the market rows, Quay tab, new voyage screen | Medium |
| 7 | Wording habits | Two-beat taglines ("Read the wind. Deliver the goods."), arrows inside sentences ("would like a word → Quay") | Light |

**Keep as they are** (they already read as a game): the chart (parchment, teal sea, sand
islands), the low-poly portraits, the full-colour goods icons, the wind compass and speed log,
the chunky pressed buttons, the 3D harbour view at the top of the port screen.

### The rule: reskin, not rebuild

- **Nothing moves.** Every screen, tab, button, its order and its place stay (decisions 0049,
  0061, 0211). Menu navigation stays the same everywhere (Guillaume's rule).
- **Nothing breaks for pads and touch.** The pad focus ring (0203), `data-pad-focus`, the Xbox
  glyphs, touch target sizes (44 px minimum) and the portrait layouts stay; the focus ring gets
  the new style but stays as visible.
- **Old tablet first** (0006): no `backdrop-filter`, no big PNG textures, no new web requests.
  Materials are small SVG frames and CSS gradients; check `?bench` before merging.
- **Offline** (0039): new fonts are self-hosted WOFF2 in `src/ui/fonts/`, SIL OFL, latin subset.
- **Both languages**: every text change goes to the storyteller first, in English and French.

### The changes, screen by screen

**1. Materials instead of navy glass** (biggest win)

- Four materials, each a small SVG frame used through CSS `border-image` (9-slice) with a flat
  fill colour behind, drawn in code like the rest of the art:
  - **Painted wood** (dark teal-blue painted planks, worn brass corners): HUD panels, port screen
    header and action bar.
  - **Sailcloth** (warm off-white canvas, a stitched seam at the edge): dialogs, quest cards,
    toasts, the coach-mark bubbles.
  - **Logbook paper** (the chart's parchment, ruled lines, ink text): the title menu, Settings,
    How to play, the journal.
  - **Brass** (kept for the main action buttons and the compass ring).
- Corners: square or chamfered with a brass corner piece, not round. Remove almost every
  `border-radius` over 4 px (keep circles: compass, coin, portraits).
- No more thin 1 px semi-transparent borders: an edge is either a real frame (rope, brass,
  stitched seam) or nothing.

**2. Type**

- Add **one display font with character** for titles and screen names: a free OFL nautical
  serif or slab (candidates to mock up: *Alegreya SC*, *Vollkorn SC*, *Bitter*, *Zilla Slab*;
  not a pirate font). About 20 to 40 KB.
- Keep **Barlow Condensed for numbers only** (prices, knots, degrees, counts), where it reads
  like an instrument. Body text stays Barlow.
- **Cut the spaced capitals:** labels become sentence case or small caps at normal spacing.
  Target: under 15 `text-transform: uppercase` in `src/ui/*.css` (today ~70), letter spacing
  only on the title and the compass points.
- Drop micro "eyebrow" labels where the content says it already ("THE" above the title,
  "HOLD" under a count that has the crate icon).

**3. Title menu**

- The left panel becomes an **open logbook page** (or a hanging painted signboard, mockup both):
  the game name in the new display font, a hand-drawn emblem, menu entries as ink lines.
- Remove the outline icons on menu rows, and the green notes on the right ("9 short steps",
  "QR code or file"). Put the hint under the entry in small ink text, or drop it.
- The version line moves into Settings › About, or stays as one tiny ink line at the foot.
- Same entries, same order, same pad focus.

**4. New voyage (difficulty) screen**

- Replace the three equal cards with **three pennants or flags hanging from a line** (calm green
  swallowtail, captain's brass, storm red), each with its name and two or three short lines.
- No "STANDARD" badge: Captain is pre-selected and its flag is raised higher.
- Keep the note "The boat sails the same at every level" and the Set sail button.

**5. Pills, badges and "·" chains**

- Port header tags (Home port, Makes, Wants, town level) become **painted signs or luggage tags
  on a rope** with icons, not outlined pills.
- Tab count badges become a small wax seal or a pinned note.
- Replace "·" chains with layout (two lines, or label above value). Target: under 10 strings
  with "·" in `en.json`/`fr.json` (today 48), each checked by the storyteller.
- Remove arrows inside sentences ("would like a word → Quay" becomes "Kit Marlow would like a
  word on the Quay").

**6. Icons**

- Redraw the UI icons in the sprite (`i-compass`, `i-book`, `i-gear`, `i-transfer`, `i-map`,
  `i-menu`, `i-anchor`, `i-home`, `i-eye`, `i-fullscreen`, `i-close`) as **filled two-tone
  icons** in the same style as the goods icons (dark outline, colour fill), not thin outlines.

**7. Empty areas**

- Port screen: the space under the market rows shows the material (wood grain or the quay view
  extended), and the harbourmaster card sits on it like a notice pinned to a board.
- Quay tab: people's cards as notices pinned to a harbour board; an empty board says so in one
  line of the storyteller's words.
- New voyage screen: the sea scene behind the flags, not flat navy.

**8. Colours**

- Move all UI colour tokens from `src/ui/sea-hud.css` `:root` into one theme file
  (`src/ui/theme.css`), loaded first, so the skin is changed in one place. Remove the last
  style-B leftovers (`'Trebuchet MS'` in `hud.css`).
- Navy stays as the deep colour but is warmed (towards teal-blue paint), and paper and canvas
  bring warm light tones. Green and red stay for Sell and Repair/close, but brighter "app"
  green (`--green-ink` notes) is no longer used for hints.
- Contrast stays at WCAG AA for text on every material (check with the Design plugin's
  accessibility review if installed).

**9. HUD at sea**

- Same instruments and places. The chips and the speed log get the painted-wood frame with a
  brass rim; the sail lever looks like a wooden lever in a brass slot; the Map button stays
  brass.

### How it is done

1. **Art bible section** (art director): a "UI" chapter in `docs/art/art-bible.md` with the four
   materials, the font, the colours, corner pieces and the do/don't list from the table above.
2. **Reference board** in `docs/reference/ui/`: screenshots of game UIs sailing fans know (for
   example Sailwind, Dredge, Windbound, Overboard!, Islanders, Sea of Thieves menus), each with
   one line on what to take from it. References only, nothing copied.
3. **Static mockups** drawn in the real game with `npm run shots -- --style a.css --script a.js`
   (0163), for: title menu, new voyage, sea HUD, port Market tab, Quay tab, chart, a quest card,
   Settings. Desktop, landscape and portrait, day and night, and one Xbox shot with the focus
   ring. Two directions side by side ("logbook" and "painted wood"). Art director first, then
   **Guillaume sees every screen** before anything is built.
4. **Build** in one thread, one PR per step, same order as style D: theme file and fonts, Sea
   HUD, port screen, chart, menus and cards, then text changes. Each PR with before/after shots.
5. **Checks per PR:** `npm test`, `npm run check -- --only controls`, a pad walk through every
   screen (`npm run shots -- --pad …`), `?bench` on the old-tablet profile, both languages,
   portrait.

### Tools and skills

- `npm run shots` already takes mockups and before/after shots; no new tool needed. If the
  theme needs tuning, the tokens can be added to the editors later, but the skin itself is CSS
  and SVG, not data.
- Plugins worth installing before the mockup step (offered to Guillaume on 2026-10-26):
  **frontend-design** (Anthropic; steers away from the generic AI look) and **Design**
  (Anthropic; design-critique, design-system, ux-copy, accessibility-review). Neither is made for
  games, so they work with the reference board above.

### Size

Mockups: one thread, about a day. Build: one thread, about four to six PRs, similar to the
style D redesign (0049, 0061). Every UI screenshot in the docs goes stale and is retaken.

### Done when

- Someone who has never seen the game no longer says "made by AI" from the first screen (test
  it with two or three new people, like the coworker).
- Every screen passes the pad walk and the touch and portrait checks, `?bench` is unchanged
  within noise, and Guillaume has approved the shots.

## Open questions

- How many new races, and where (the storyteller and the map).
- The club board for best times: where it lives (Saltmere's Quay, or a board of its own) and
  what it shows.

## Candidate: a camera the player can turn

Guillaume asked on 2026-10-25 whether the camera could be moved: the right stick on a controller
(click it to reset), right-click drag on a PC, and something that works on a phone. This is a
**feasibility check only**: nothing is built, and it is a candidate for v1.1, not a commitment.

**Verdict: feasible, medium size.** The camera is one small piece of code: `src/render/view.ts`
`render()` places it at a fixed pitch (`CAMERA_PITCH` 58°) and distance (`BASE_DISTANCE` 110 ×
zoom), always looking north, easing after a target a little ahead of the boat. Turning it means
adding a **yaw** (round the boat) and a limited **tilt** to that one placement. The sim, the
steering and the saves do not care where the camera looks.

### Controls

| Device | Turn the camera | Reset | Clashes today |
| --- | --- | --- | --- |
| Controller | Right stick left/right turns round the boat | Click the right stick (RS) | The right stick's up/down is zoom (`controls.json` › `sea.zoomAxis: "ry"`); keep it. RS is free at sea (the chart uses it for "fit", a different context). Port screens use the right stick to scroll, but only while a menu is open. |
| PC | Right-button drag (left/right turns, up/down tilts) | Double right-click, or a key such as Home | Left drag steers and the wheel zooms (`src/input/input.ts`); the right button is ignored today, so it is free. The canvas must block the browser's context menu. |
| Phone / tablet | **Two-finger drag** sideways turns, two fingers up/down tilt; a pinch zooms | A small "reset view" button that shows only while the camera is turned | One finger anywhere steers (`input.ts` drag). When a second finger lands, the steering drag is dropped (rudder back to 0) and the gesture becomes the camera; it never steers again until all fingers lift. Phones have no zoom gesture today, so the pinch is a bonus. |

The touch choice keeps one finger = steer, which every player already knows. Its one rough edge:
the first finger steers for the moment before the second lands. That blip is short (the rudder
eases), and it can be hidden by holding the rudder for ~80 ms after a touch starts if playtests
show it.

### What assumes a north-up camera today

- **Wind compass** in the HUD (`src/ui/hud.ts`): drawn north-up; it must turn with the camera
  (or show a small north mark), or the player reads the wind wrong.
- **Rain** (`src/render/rain.ts`) spreads its drops for a camera looking north; it needs the yaw.
- **Focus views** (Skerry's plots with `PLOT_CAMERA`, harbour approach, quest `--look` shots)
  shift the target with north-up maths: the turned camera resets (eases back) while one of these
  is active.
- Quest arrows, port labels and pier positions already project through the camera
  (`screenBearing`, `project`), so they keep working.
- The far plane and fog are set from the camera distance, so yaw changes nothing there; **tilt**
  does, because a flatter camera sees farther.

### Performance on the old tablet

Turning (yaw) costs nothing: the same amount of sea is on screen, the ocean grid and the
140-unit shadow box follow the target and are square. **Tilt** is the risk: looking flatter
shows more islands, towns and sky, and the tablet is fill-rate bound (ADR 0005/0115). So the tilt
range stays narrow (about 50° to 70°, data-driven) and the far plane still stops at the fog. Check
with `?bench` at both tilt limits before merging; if the tablet drops, ship yaw only.

### Settings

- **Settings › Camera › "Turn the camera"** (on by default): off keeps today's fixed view and
  ignores the right stick's sideways, right-drag and two-finger drag, for players who like the
  map-like north-up view.
- **"Camera comes back by itself"** (off by default): eases back behind north after a few seconds
  without camera input.

### Data, editor and CLI (ADR 0093, editors-plus-CLI rule)

- The camera numbers move out of `view.ts` into data: default pitch, tilt range, distance, zoom
  range (today `clamp(zoom, 0.6, 1.7)`), turn speed per stick, degrees per pixel for mouse and
  touch, the ease time and the reset ease. They sit in the tuning data with `tuning-meta`
  entries, so the editors' Tuning page and `?tune` edit them.
- The controller axis and reset button go in `controls.json` › `sea` (`orbitAxis: "rx"`,
  `actions.resetCamera: ["rs"]`), edited on the editors' Controls page and checked by
  `npm run check -- --only controls`.
- CLI: `npm run shots -- --yaw 40 --tilt 52` takes screenshots from a turned camera, and
  `npm run shots -- --pad "rx=0.8:800,rs:100"` already fakes the stick and the reset.

### Size

About **one build thread and one PR**: camera placement and easing in `view.ts`, the three
inputs in `input.ts`/`gamepad.ts`, the compass and rain fixes, the Settings rows, the data and
meta entries, the `shots` options, tests, and an ADR. Then Guillaume's playtest on the Xbox, a
phone and the old tablet. Similar in size to the harbour screen header (ADR 0211).
