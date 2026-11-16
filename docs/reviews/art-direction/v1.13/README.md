# v1.13 "Soft and rich": art director conditions (2026-11-16)

Docs only. Given once to the release lead before any build thread starts. Picks from sheets come later, in one message per build thread. Nothing here is built until Guillaume OKs the brief.

## #572 Softness, detail, texture (sheet first)

The sheet shows one house, the sloop, a quay and a sail, today against three strengths, from the follow cam and from above, day and golden hour.

- **Strengths:** A = soft edges only (AA, soft shadow edge, rounded edges, land/water fade), no patterns. B = A plus patterns at low contrast (planks, sail seams, plaster grain, roof tiles). C = A plus patterns at medium contrast. No stronger option: past C it turns into Saltline's grime.
- **Pattern rules:** pattern is a lightness shift of the face colour (about ±6% for B, ±10% for C), never a new hue; shadows stay blue, not grey. Scale is chunky: one plank is wider than a hand. Fades out between 1.5x and 3x the follow-cam distance, so the top view is exactly as clean as today (judge it first). No visible tiling on a flat wall.
- **Gates for the sheet:** follow-cam sea dE stays at most 5 (§14); `?bench` shown per level; Low and Ultra-low have no patterns.
- **My lean (not a pick):** B for walls and roofs, C for hull planks and sail seams, because the boat is on screen every second. I pick on the sheet.
- After the pick I write art bible rule 1 (PR, docs only).

## #629 Boat preview look

What I see in the shipyard shot: a flat teal plane under a flat pale-blue wall, a hard ruler horizon, no light on the water, no shadow or foam under the hull, and the camera too close, so the mast and flag are cut at the top.

Ruling: the preview is a small window into the real game, not a studio.
- Same day sea, depth ramp, glitter and blue air (§14, day horizon `#7fc0e6`, zenith `#3f8ed6`) as the follow cam. The horizon is the soft fog line, with a few soft cumulus (one layer is enough).
- The hull sits in the water: waterline foam ring and a small wake, a gentle swell bob. No flat plane.
- Same sun direction and colour as the game; the Boat looks screen has a day and a night toggle (night: moon, blue shadows, lantern glow). Golden hour is optional.
- Framing: the whole boat fits with the mast top and flag inside the frame and room above it; slow turntable stays.
- Cost: on Low use a cheaper sea (no reflection, no glitter) but the same colours. Reduced motion stops the bob.
- Done when a preview shot beside a follow-cam shot at the same time of day reads as one world; both go on the sheet, desktop and phone landscape, day and night.

## #553 Boat up close

- The sloop first, two detail options on a model sheet and in the follow cam (more than two is wasted tokens).
- Priorities, in order: sail belly that reads from behind; helmsman and tiller; sheets and stays as thin lines; deck detail. If the triangle budget bites, drop deck detail first, keep the sail and helmsman.
- The helmsman wears the boat-look colours from #418 (a sailor in the shipyard palette, no face detail). Hull and sail keep the surface patterns from #572 once picked.
- Follow cam first, then from above; the far model stays as today.

## #554 Spray

- Spray is opaque low-poly bits in the sea-foam colour (smoke rules, §6), never white `#fff` (max `#f6f9fb`), no transparency.
- Scale: nothing under 3 kn, a small bow curl at 4 to 5 kn, a clear bow spray and longer wake at 7 kn; heel splash to leeward only when a gust heels her.
- Camera lean: at most 3 degrees, slow, never faster than the heel; reduced motion switches the lean and the wave lift off (spray stays).
- Show 3 kn, 5 kn and 7 kn in both views on one sheet.

## #630 Free Sailing setup layout (from the shot)

- The "Où et quand" card is a narrow column: one word per line, a heading cut by its card, scrollbars on both sides. Give it the width of a normal card and one card per setting, nothing may touch a border.
- Boat type list (Sloop, Cotre, Goélette, Clipper, Heu, Flûte, Vaisseau des Indes): even chips in a wrapping grid with equal widths, the active one filled as today. The "Apparence du bateau" button stays the first item.
- Keep the chart-table UI of §11. Check FR and EN, desktop and phone landscape.

## #631 Wind icon over the compass (phone)

HUD rule (§13): the wind icon and the compass never overlap. On phone landscape put the wind icon beside the compass (not on it), keep both fully visible, and do not move them into the middle of the view. Sheet on phone landscape, day and night.

## Review order and sheets

Everything lands in `docs/reviews/v1.13/` as one combined sheet round for Guillaume: desktop first, phone landscape for #629, #630, #631. Open items from the v1.12 handover are not part of this round.
