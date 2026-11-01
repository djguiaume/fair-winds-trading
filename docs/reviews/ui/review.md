# UI review: why it does not feel like a real game yet (2026-11-01)

Lead review for Guillaume's ask (pain points: too basic, no cohesion, not good enough for a game, too cluttered, no identity). Inputs: the five screen sheets in the project files (`ui-review/screens/`, game v1.4.55), the [UI inventory](inventory.md), the [art bible](../../art/art-bible.md), the style E work ([0220](../../decisions/0220-a-game-like-ui-skin-style-e.md), [mockups](../../ui-refactor/style-e/README.md)) and Guillaume's references: Sea of Thieves, Skull and Bones, Seafarer, Forza Horizon, Zombie Assault Resurgence (mobile).

The proposal that follows from this review is the [v1.6 brief](../../v1.6/brief.md) and its decision.

## 1. The one-line diagnosis

Style E changed the paint, not the architecture. Every screen is still a **web page**: a form with toggles, a table with buy and sell buttons, a tab bar, a close cross in the corner, small text in boxes on a cream sheet with empty space around it. A game screen is built the other way round: one hero element (the boat, the harbour, the chart), a few big choices, large type, and motion when anything happens. The second problem is that nothing is shared. The inventory counts two button families, four tab styles, six card styles and no spacing, radius, shadow or motion tokens, so each screen was styled on its own and the whole reads as five apps.

## 2. What the screens show

**Title menu (01).** A cream side sheet over the live game, a compass emblem and a serif title. It is a settings drawer, not a title screen: no staged scene, no logo moment, and the list puts "Learn to sail", "How to play", "Move your voyage" (a save transfer) and "Free Sailing" at the same level as "Set sail". The pause menu (12) is the same sheet with "Resume", so pausing looks like leaving the game. On the phone the logo and title overlap and the sheet is taller than the screen.

**New voyage (02).** Three small cards float in a large beige void (desktop: the cards cover a third of the screen). The difficulty choice reads as a pricing page. Nothing shows what you are choosing (a boat, a sea). The title is clipped at the top on both sizes.

**Settings (03).** About twenty-five rows in two columns with toggles: a form. On the phone only three rows fit; Difficulty and New game are a long scroll away. No grouping into Game, Display, Sound, Controls, and a red "New game" button inside the form.

**Sea HUD (04, 05).** Nine boxes of the same weight: gold, hold, destination, speed plate, compass, wind text, port label with a stats row, sails lever, menu and map buttons, plus the quest chip, toasts and the race chip when they come. Every box has a border and a plate, so the frame is as loud as the content. The port label ("Saltmere, Wants, Makes") sits on the shoreline. Nothing fades when idle. The sea itself, the one thing that looks like a game, is boxed in. This is the "cluttered" pain point.

**Port screen (06 to 08, 13).** A cropped banner with the port title half hidden, a chip row (Home port, Makes, Wants, Village 0%), browser tabs, a market **table** (goods, "best elsewhere" in 9 px, hold count, Buy, Sell) and a side column of notes. "Set sail" is a small button bottom right, the pad hints compete with it, "Kit Marlow would like a word" is a footer line. The quay quest card is a text box. Abbey Head shows a picture of an empty island and one line. On the phone the tab content is cut by the bottom bar and the quay buttons are hidden. This is the "too basic" pain point: the most-used screen is a spreadsheet.

**Chart (09).** A cream disc on a flat teal field, goods chips top-left, zoom buttons bottom-right, tabs Journal, Cargo, Prices, Legend. The idea of one book is right; the look is a web map widget. No compass rose, no paper, no ink. The chart is where a sailing game shows its identity most.

**Quest card (11), race chip (14).** The card is good (portrait, name, a step, one button) but on the phone it covers the whole view and overlaps the quest chip. The race start reads as three unrelated boxes ("Horn in 10", the quest chip, a toast).

**Free Sailing (16), Shipyard (08).** Different card and pill styles again. The boat preview in Free Sailing is the best "game" moment in the whole UI, because the boat is the hero.

## 3. Against the references

| Reference | What it does that we do not |
| --- | --- |
| Sea of Thieves | Menus are objects on a scene, the player's ship is always behind them; one material language; big serif titles on banners; hand-drawn icons |
| Skull and Bones | Chart and ledger as paper pages with engraved rules, strong condensed type; a dense HUD we should **not** copy |
| Seafarer | Honest instruments: one combined dial, calm numbers, the HUD stays out of the view |
| Forza Horizon | A bold identity (one wordmark, one accent colour), big numbers, animated feedback on every event, a hub screen with the car as hero |
| Zombie Assault Resurgence | Mobile readability: chunky buttons, large tap targets, one clear action per screen, strong colour coding |

Common to all five and missing here: **one hero per screen, one signature, big type, feedback on every event, and the frame getting out of the way at sea.**

## 4. Root causes (from the inventory)

1. No design system: tokens for colour and type only; 115 literal radii, 46 shadows, 5 keyframes in total. One look cannot be enforced.
2. Token roles swap by context (`--brass` is teal on paper), and `theme.css` repaints older files with `!important`, so a screen's look lives in three places.
3. No components in code: only `icon()`, `confirmDialog` and pad focus are shared. Tabs, cards, headers and close buttons are re-made per screen.
4. No screen stack or transition system: screens are `hidden` toggles wired by hand in `main.ts` (2,173 lines) and `padScreen()`.
5. The theme and layouts are not data: no theme file, no editor page, no `npm run` tool (rule 0153).
6. Portrait layouts were a constraint until today and cost space on every screen. Guillaume dropped the portrait requirement (2026-11-01): phone landscape only.

## 5. What already works and must stay

Full i18n, the pad focus and glyph system, the inline SVG icon sprite, no backdrop blur, content as data, the paper-and-wood materials and type (Fraunces, Barlow) as a base, sailing numbers visible by default, hazards switchable in Settings, and the quest card shape.

## 6. Recommendation

Not a third skin. Build the UI as a game system once (tokens, components, screen stack, motion, theme as data), decide the identity from static mockups first, then rebuild the screens on it in waves. Details and the parts: [v1.6 brief](../../v1.6/brief.md).
