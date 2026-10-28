# Look rules: the other boats (v1.2, issue #331)

Art director, 2026-10-28. Input for the build thread of [#331](https://github.com/djguiaume/fair-winds-trading/issues/331). Rules come from the [art bible](../../../art/art-bible.md) and the [new-look guide](README.md); the traffic notes of [phase 5](../phase5/README.md) still hold. Today's boats (decision [0215](../../../decisions/0215-other-boats-on-the-sea.md)) are 76 triangles (fishing) and 252 (coaster). Guillaume (2026-10-28): the whole point of the redesign is better, richer boats, and the old tablet is not a constraint for now. So the budgets below replace the Phase 5 ones (350 / 900 / 1,500); the on-screen caps stay (Low 3, Medium 6, High 10). Re-measure with `?bench` before the old-tablet question comes back.

## 1. What stays, what changes

- **Stays faceted.** Boats, sails and deck cargo keep flat shading and vertex colours (bible rule 1). Only terrain and water go smooth in v1.2, so a boat is the crisp low-poly thing on a soft sea. Do not smooth hulls to match the water.
- **Changes: shape.** The old traffic hulls are wedges. Give them the player's D storybook language: a curved sheer (bow and stern lifted), a rounded stern, a visible keel line, one band colour along the rail.
- **Never confused with the player.** Only the player has the brass pennant and the selection ring. Traffic is always smaller and simpler.

## 2. Shapes (read at the game camera, silhouette first)

| Boat | Rule | Triangles |
|---|---|---|
| Fishing boat | 0.45x the sloop (0.55x if lost on a phone). Open hull, one short mast, lug sail (a four-sided sail, high at the front), a stern cabin box, a crate or two of nets on deck. Reads as "small and working". | about 1,500 |
| Coaster | About the hoy's size. Two masts: tall main, short mizzen, both fore-and-aft. Square stern, low deckhouse, a hatch. Carries the deck cargo (section 4). | about 3,500 |
| Visitor | The player's fluyt, indiaman or schooner plus a livery. Leans on the right tack. Only the hull band, a pennant and a stern flag differ from the player's ship. | about 4,000 (the player's model at near detail, no far LOD) |

Sails are softly bellied like the player's, never flat triangles. Rigging is one thin line at most and goes away at Low. With the richer budget add what reads: planking steps on the hull, a rail, a tiller, hatches, a small figure at the helm on the coaster. Still no cabin windows or rope detail: they turn into noise at 0.45x.

## 3. Colours (all by name in `palette.json`)

- **Hull:** painted by the home port's `style`, as 0215 already does. New look: slightly less saturated than the sea so boats do not glow on the new blue water; darks are warm charcoal, never `#000`.
- **Sails:** cream `#f4ead2` family, never pure white. Fishing sails may take one patched panel in a second warm cream or rust.
- **Band and flag:** one bold band colour on the rail, one on the flag, from the home port. Visitor bands: north oxblood `#a8403a`, south jade `#2a8f6e`, west dark ember `#8a3a2a`, east tar `#2f3035` with a red stripe `#b8433a`.
- **Reserved, never on traffic:** brass `#e8c46a` (the player and the HUD), yellow (regatta marks), amber `#ffb36b` (storm warning), red buoy red (edge buoys). Rivals in a regatta get their own bold livery from the regatta data, not from traffic.
- **Check on the water that is there now.** Flag any colour that only works on today's turquoise (the new water is #274, the haze is #276); they are retuned once, at the end of v1.2 (#277). Build with the hull value and the water value apart so only the palette changes.
- **Night:** the small warm lamp of 0215 stays (lit-window material); hulls stay deep blue under moonlight, never black.

## 4. Deck cargo by home good

The coaster's cargo is data: one entry per good, a small prop on the deck (2 to 4 pieces, about 150 triangles in all).

- Fish: stacked cream crates with a blue net.
- Grain: tied sacks in sand and cream.
- Timber: a stack of pale logs, ends lighter.
- Wool or cloth: bundled bales in the port's band colour.
- Ore, glass, spice and other goods: pick a chunky readable shape in the good's own colour from `goods`; at most 3 colours per cargo.

A coaster with no cargo sails with an empty deck (a tarp). Cargo is a separate small mesh so one hull draw is still instanced.

## 5. Wakes

- Smaller than the player's: about 60% of its length and width, one short V and no foam trail beyond the stern.
- Same foam white as the player's (`#f6f9fb` at most), same dash style, no transparency.
- A fishing boat under sail leaves a wake; one drifting or at anchor leaves none.
- The wake colour comes from data, so it can follow the depth-coloured water later.

## 6. Done means

Day and night shots, desktop, one combined round with Guillaume: one frame of fishing boat, coaster and each visitor livery next to the player's sloop at the same camera, plus a chart of a lane with traffic. Phone only if the layout changes. My check: silhouettes tell fishing, coaster and visitor apart at game zoom; none is mistaken for the player; no reserved colour; cargo readable; wakes clearly smaller. Must fix / good / nice to have list back in the thread.
