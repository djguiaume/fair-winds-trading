# Style E: reference analysis and 3 directions (issue #261)

Caveat: written from what I know of the four games plus web search results that returned no screenshots. Please correct me where your memory of a game differs.

## What each game does

| Game | UI idea | Steal | Avoid |
| --- | --- | --- | --- |
| Skull and Bones | Dense AAA HUD, dark panels, gold trim, many numbers | Ship ledger / upgrade-tree clarity, strong ship silhouettes in menus | Clutter: it became a meme for it. Same "dark glass + gold" trap we are leaving |
| Sea of Thieves | Almost no HUD; menus are objects: planks, rope, parchment, brass, chalk and ink drawings | Materials you can touch, hand-drawn icons, warm palette, menus placed in the world (table, map, lantern) | Too rustic for text-heavy trade tables |
| Seafarer: The Ship Sim | Sim instrument look: real gauges, plotter, calm sans text, translucent panels | Honest numbers, real chart/instrument shapes, restraint. Fits sailing fans | Cold, flat, little personality |
| Pokemon Legends Z-A | Bright flat colour-coded panels, bold type, big icons, pad-first wheel menus | Instant readability, colour = meaning, big focus states, short labels | Candy look can fight our low-poly sea tone |

## The 3 directions (all keep layouts, pad focus, touch sizes, old-tablet limits)

**A. Logbook** (Sea of Thieves + Seafarer). Paper, ink, a nautical serif for titles, ruled lines, pressed-in stamps. Title menu, Settings, quest cards are pages of a log; port tables are ledger pages. Diegetic and calm. Risk: low contrast at night on a phone.

**B. Painted wood and brass** (Sea of Thieves + Skull and Bones). Teal-blue painted planks, brass corners and rivets, sailcloth cards for dialogs and quests, rope dividers. Chunkiest, most "game". Risk: heaviest art to draw; keep to small SVG 9-slice frames.

**C. Signal flags and enamel** (Pokemon Z-A + Seafarer). Flat enamel plates, bold sans, marine signal-flag and pennant colour coding (goods, difficulty, status), big icons, little chrome. Best for pad and phone readability and the "Sailing Club" tone. Risk: least "pirate", can feel modern if the type is not chosen carefully.

My pick to lead with: B for the HUD and port, A for menus and cards, C's colour coding and focus states borrowed into both. But I will draw all three as asked.

## Mockup plan (per direction)
Screens: title menu, new voyage, sea HUD, port Market + Quay, chart, quest card, Settings. Desktop + portrait, day + night, one Xbox focus shot. 1 contact sheet per direction (JPG, max 1280 px), drawn by injecting CSS/SVG into the live game with Playwright (as in the style D mockups). Then one combined round with the art director and you. No build until you approve.

## Update 11:20Z: from Guillaume's 9 screenshots (real UI, replaces my from-memory notes)

- **Sea of Thieves** (reputation + play menu): torn-parchment cards in ochre/teal, serif titles on ribbon banners, round roped medallion icons, cream-and-black card borders, big illustrated art, teal button pills with pad glyphs, blurred 3D scene behind. Tab titles are plain serif text with small LB/RB glyphs, no boxes.
- **Seafarer** (TRSG): steel blue-grey, angled top tab bar, thin white focus outline, yellow chevron pickers, key-cap glyphs on every action, faint compass-rose watermark, sim HUD (top compass strip, objective box, round minimap). Clean but cold.
- **Skull and Bones** (map): open-book parchment map, black engraved side panel, condensed bold caps, rule lines with centred headings, red ribbon "Journal" banner. Good map and ledger layout; the HUD around it is stern.
- **Pokemon Z-A** (menu, outfit): frosted blue gradient, one white highlighted row with a lime arrow marker, huge wide title with glow, rounded rows, circular level ring, button legend bottom right. Selected state is unmissable.

Changes to the plan:
- **A Logbook** now: Skull and Bones map/journal pages + Sea of Thieves parchment cards, with ribbon banner titles.
- **B Painted wood and brass**: Sea of Thieves frame, ribbon banners, medallion icons, teal button pills.
- **C Enamel and signal flags**: Z-A white selected row with a coloured marker, Seafarer key-cap legend, flat plates. No blur: old tablet rules out backdrop-filter, so flat gradients instead of frosted glass.
- All three: round medallion icons, one unmissable focus style, pad glyph legend on every screen.
