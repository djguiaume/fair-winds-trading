# v1.11 #560: compact phone-landscape HUD (844x390)

Three static mockups on the real game, built by restyling the live HUD (`src/*.css` and `src/*.js` here; not wired).
`sheet.jpg` shows today, then A, B and C at native size.

Shared by all three (art bible section 13): knots, heading, point of sail and the wind compass always visible; one slim
vertical sail lever (Full on top, 44 px rows) with the knots and heading above it, on the right edge; Map, Cargo and Menu
as 44 px icons; the quest line folded to one line (the second line opens on tap); compass a size smaller (84 px)
with the breeze words shown only when they change; the view button (#535) under the compass. Nothing sits
over the middle 40% of the width except the heading strip at the very top; the lower third stays free.

| Mockup | Lever | Icons | Compass and status |
|---|---|---|---|
| A | right edge | bottom left | status top left, compass top right |
| B | right edge | top strip, left of the compass | as A |
| C | left edge (a Settings option, left-handed) | bottom right | status top right, compass top left |

Build notes: the lever's drag reads vertical position instead of horizontal; the point of sail goes on the compass plate
(no unbacked text); the quest card opens clear of the lever, compass and quest line.

## Picks

| Round | Pick | Notes |
|---|---|---|
| 1 | pending | Guillaume and the art director: one of A or B, and whether C ships as the left-handed option |
