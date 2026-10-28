# Style E, refined: a captain's working book on a painted boat

*2026-10-28, issue #261. Mockups only. Nothing is built, approved or merged; this is for Guillaume's assessment.*

Base: direction 1 (paper menu) with B's painted instrument mounts, as asked. Sheets: `sheets/refined-*.jpg`,
comparisons `sheets/compare-d1-b-refined-*.jpg`. Sources: `css/e-refined.css` (+ `e-night.css`, `e-pennants.css`),
`js/strip.js`, `js/rules.js`; redraw with `shots.sh e-refined` and `extra.sh`. Drawn over real game captures.

## Commitments checked, and where this departs (flagged, not decided)

| Source | Says | In this mockup |
| --- | --- | --- |
| #261, plan | Reskin, not rebuild; layouts, order, pad focus, touch sizes, no blur, old tablet first | Kept. Only CSS and small shapes; no `backdrop-filter`, no filters, no textures |
| ADR 0220 / plan | Corners square or chamfered, almost no radius over 4 px | **Departs on purpose:** action buttons are pills (your brief); everything else is 3 to 8 px. Plan and ADR text would need the change |
| Plan | Sailcloth for dialogs and quest cards | **Departs:** paper notices on painted backing (your brief). Sailcloth is dropped |
| Plan | Brass for the main action buttons | **Partly:** main action is teal on paper, brass on paint, because an action must contrast with its surface. Map button stays brass |
| Plan | Filled two-tone UI icons | **Not drawn.** Today's outline icons remain in the mockup; redraw is a build step |
| Plan | Remove green notes on menu rows | **Kept** as small italic ink notes under the entry ("9 short steps", "QR code or file"), as you asked to keep useful labels |
| Plan | Pennants for difficulty | Shown as a focused comparison below, not chosen |
| Plan | Font candidates Alegreya SC, Vollkorn SC, Bitter, Zilla Slab | **Departs:** Fraunces (OFL), already used in the earlier rounds. Barlow Condensed stays for figures |
| Art bible / handover | Red only for edge buoys; yellow = regatta; amber = storm; brass `#e8c46a` = HUD; no pure white (`#f6f9fb` max) | No red buttons. Danger `#8f2f1c` only on New game. Storm pennant is oxblood `#a8403a`, not buoy red (**flag**). Cream `#f4ecd6` is the lightest tone. No yellow, no amber |
| Art bible UI row | "Instrument style D" | Stale if this is accepted; a UI chapter is still to be written (plan step 1) |
| Wording | Storyteller owns text; `·` and arrow clean-up is a text task | No wording changed. The "→ Quay" arrow and `·` chains are still there; CSS cannot fix them |

## Retained, changed, why

- **Retained from direction 1:** paper column, compact masthead, ribbon, entries divided by a hairline, pill actions, paper ledger, no red.
- **Retained from B:** flat painted teal as structure, painted HUD mounts, brass rim and screws on the two big instruments, the notice-on-backing idea.
- **Dropped from B:** plank seams, rivets on every plate, double borders (dark line plus brass inset). A plate has one brass rim.
- **Changed:**
  - Menu: the paper column is bound to the sea by a painted edge. Hints are italic notes under the entries.
  - HUD: the compass is an enamel face in a brass ring (one purposeful exception to "paint carries structure"). The speed is a big condensed figure; heading and point of sail are sentence case.
  - Market: one continuous ledger. The rows are divided by a dotted rule, names in Fraunces, every figure condensed and bigger. The harbourmaster and orders are notes with a painted spine. A tab bar of painted bookmarks leads into the page; the open tab is the page.
  - Quay and quest card: a paper notice on a 6 px painted frame (one border, no inner outline). The objective is a painted strip, so dialogue, objective, reward and actions read as four things.
  - Chart: the map is untouched. Header, tabs and goods tags only. Goods tags are luggage tags, as in the port.
  - Settings: group headings with one rule each, no boxes round rows; segmented controls are the only framed control.
- **One shape per job:** pills are actions, bookmarks are tabs, stamped squares are amounts, luggage tags are information, plates are instruments. Nothing is interchangeable now.

## Rules (also on the sheet `sheets/refined-rules.jpg`)

- **Paint** `#2a5a7c` (hull blue, lighter than the first teal) structure, flat. **Brass** `#e8c46a` fittings, compass ring, focus halo, main action on paint. **Paper** `#f1e6c8` records and people, flat with a soft page edge and **no ruled lines**; notes `#e6d7ae`; ink `#2e2217`; action on paper `#366d94`.
- **Type:** Fraunces 900 titles, 700 names and actions, italic for notes. Barlow body (15 px minimum). Barlow Condensed for every figure. Sentence case; no tracking.
- **States** (strip: `sheets/refined-component-strip.jpg`): normal, pressed (drops 3 px), selected (filled), unavailable (dashed outline, dim), focused (dark line plus brass halo). Selected and focus never look alike.
- **Night:** a second token set, not a filter. Paper takes a lamp tone (`#dccba1`), paint gets a brighter text and rim, the focus ring is unchanged.

## New voyage: cards or pennants (the one open choice)

- **Cards** (default sheet): paper cards, the chosen one lifted with a teal border and a tick; no badge, no gold ring.
- **Pennants** (last tile): three swallowtail flags on a line, moss / brass / oxblood, the chosen one longer and ticked. More character; the portrait layout is the weak spot (flags stack as three wide bars) and the text-heavy flags are tall.

## Checked and not checked

- **Contrast computed from the hex values** (WCAG): ink on paper 12.4, dim ink on paper 5.3, dim ink on note 4.7, cream on paint 6.2, paper on blue button 4.5 (bold 17 px and up only), blue ink on paper 5.9, ink on brass 9.2, brass on paint 4.4 (icons and large text only), night ink on night paper 10.8, night cream on night paint 8.0. The brass focus halo alone is 1.3 on paper; the dark line (12.1) carries the focus there, so both are needed.
- **Looked at:** every screen in desktop and portrait, day and night (sea, Market), and one pad-focus view. Visual assessment only.
- **Not tested:** `?bench` on the old tablet, a real controller, English and French wrapping beyond the English strings shown, touch targets measured in a browser. The CSS uses no filter and no blur, but nothing here is a performance measurement.

## Trade-offs still open

- The mockup CSS is `!important` everywhere to win over today's rules; a build would move tokens to `theme.css` and rewrite the rules cleanly.
- Outline icons remain; mixed with the new type they look thin on paint. The two-tone redraw matters.
- Fraunces TTFs are about 70 KB each; a WOFF2 latin subset is not measured.
- Phone: the port title is clipped by the gold and cargo chips (also true today); the pennants stack badly; long French strings are untested.
- Brass main action on the paint footer and Map button is the only strong gold; if that reads as "default" to you, the footer action can become cream paper instead.

## Flagged risk: teal paint with brass can read as "default blue and gold"

Guillaume rejected C and D2 for that look. Refined uses flat teal paint with brass fittings, which is closer to it than it should be.
A **warm alternative** is drawn from the same rules with tokens only (`css/e-warm.css`): tar-brown paint `#3b2d23`, deep green
actions and headings `#2f5a3a`, brass unchanged. Sheet: `sheets/refined-warm-alternative.jpg` (menu, sea HUD, Market, quest card,
refined next to warm). Other warm options not drawn: oxblood paint (clashes with the red reservation) and deep green paint.
Not decided; Guillaume to judge.

## Update 14:40Z (Guillaume's feedback)

- **Ruled lines removed from every background** (menu, Settings, New voyage, quest card). Paper is now flat with one soft inset edge shade (a static box-shadow, no gradient fill). Dotted rules stay only as row dividers in the Market ledger and a rule under Settings group headings, where they separate things.
- **Blue changed:** the green-leaning teal (`#1f4c58` / `#1f5a66`) became a lighter hull blue: paint `#2a5a7c`, actions `#366d94`. Brass is unchanged.
- The warm alternative sheet (`sheets/refined-warm-alternative.jpg`) was drawn before this change and still shows ruled lines and the old teal; its tokens file `css/e-warm.css` still applies on top of the new rules.
