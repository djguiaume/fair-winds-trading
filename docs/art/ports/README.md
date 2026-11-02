# Port banner art: the prompt pack

The port screen's banner (decision [0280](../../decisions/0280-port-screen-island-banner-over-a-full-opaque-ledger.md)) shows the docked port. Today it is the game's own render, graded like the title's key art. A painted picture per port can replace it. This page has everything an image tool needs to paint one: the style, the references, one prompt per port, the size and the file name.

Claude cannot paint pictures itself. ChatGPT or Scenario can, from these prompts.

## What to give the tool

1. **The style reference:** the title's key art, [`src/ui/screens/art/title-key.jpg`](../../../src/ui/screens/art/title-key.jpg). Every banner must look like it belongs next to it.
2. **The port's in-game picture:** `ref/<port>.jpg` in this folder, the game's render from the banner camera. It shows what the island really looks like: its shape, its town, its colours.
3. **The shared prompt** below, with the port's lines added at the end.

## The shared prompt

> A wide panoramic picture of a small island harbour seen from the sea, for the game Fair Winds Trading Co. Style: a bright, low-poly storybook sea, smooth-shaded land and depth-blue water under flat-shaded houses, boats and trees, in clear sunny colours (match the first attached image exactly: same low-poly 3D look, same blue sea, soft warm afternoon light from above, coloured blue shadows, never grim, no pure white or black). The island is the one in the second attached image: keep its shape, its town and its landmarks. Camera low over the water from a boat offshore, the whole island in view. Composition: very wide; the island and its town in the centre and right; open sea and sky on the left third; everything that matters inside the middle horizontal band (the top and bottom quarters will be cropped). No boat in the foreground, no people close up, no text, no logo, no frame, no border.

If the tool can, ask it next to **widen the picture to about 16:3 by extending the sea and sky on both sides**.

## Size, crop and file name

- **Final file:** `public/art/ports/<port>.jpg`, **1920 × 340**, JPG quality about 82, under 300 KB. This is the shape the game renders its own picture at.
- **What shows:** the banner fills the screen's width and is at most 170 px high on a desktop (56 px on a phone), centred at 55% of the picture's height. So on a desktop only the middle half of the 340 px is seen, and on a phone a thin band. The port's name, gold and hold sit over the left third on a dark wash, so keep that part quiet.
- **Hook it up:** `npm run island -- <island> view --art art/ports/<port>.jpg` (or the island builder's **Banner art** field). The island id is the port id except Stonehaven, whose island is `south-cay`.
- **Easiest:** post the raw image in the port screen thread (or drop it in `docs/art/ports/raw/`); a thread crops it, saves it and hooks it up.
- **Night:** the same picture shows at night for now; a night version per port is a follow-up.
- Any port with no art keeps the graded render, so the art can arrive one port at a time.

## Cost

- **ChatGPT:** no Scenario credits.
- **Scenario:** about 26 credit units (CU) an image with Gemini 3.1, so about 364 CU for all 14 ports out of the 693 left, plus 26 per retry. Run one port as a test first, and only after Guillaume's OK for that batch.

## One prompt per port

Add the port's lines to the shared prompt.

| Port (file) | Sea | Add to the prompt |
|---|---|---|
| Port Calda (`calda`) | Windward Ring | A timber port: sandstone tiers with bright grass caps, pine woods, red and blue roofs, a busy wooden quay. Its landmark is the slipway with a ship's hull on it. |
| Saltmere (`saltmere`) | Windward Ring | A fishing port: a row of smokehouses with smoking chimneys, a green with nets drying, the harbourmaster's office facing the quay, broadleaf trees, small fishing boats pulled up on the beach, red and blue roofs. |
| Westholm (`westholm`) | Windward Ring | A grain port: golden wheat fields on the slopes, broadleaf trees, a bakehouse by the quay. Its landmark is the windmill on the hill. |
| Stonehaven (`stonehaven`, island `south-cay`) | Windward Ring | A stone port on a rocky cay: grey stone cliffs with steps cut into them, a quarry with cut blocks, stone houses, fir trees. Its landmark is the lighthouse. |
| Watchman Key (`watchman-key`) | Windward Ring | A small round green hill with the keeper's lighthouse on top, a few houses with blue and red roofs, a flag on the pier, a small shipyard slip. |
| Abbey Head (`abbey-head`) | Windward Ring | A small young settlement on a green headland with sandy shores: a few new houses, a boat shed and a shipyard slip by a short pier. |
| Sunreach (`sunreach`) | South (tropical) | A crater-rim island around a pale turquoise lagoon: white coral beaches, palms, tea-garden terraces on warm ochre and red-brown cliffs, white and peach houses with thatch and terracotta roofs. Its landmark is the tea house with a jade-green roof; small lighthouses on the arm tips. |
| Palm Key (`palm-key`) | South (tropical) | A small tropical island: a bare ochre volcanic cone striped in bands, jungle and palms round its foot, a white beach, a small pier with a flag. |
| Emberhold (`emberhold`) | West (fire, Iceland) | Warm charcoal basalt cliffs and hexagonal basalt columns, black-sand beach, bright moss on old lava, thin glowing red cracks, steaming vents. Houses of black tarred timber and white walls with red and green roofs, old turf-roofed houses. Its landmark is the glassworks with a tall furnace chimney. |
| Cinder Isle (`cinder-isle`) | West (fire, Iceland) | New dark volcanic ground still steaming from the sea: black sand, black rocks, ash, thin red cracks, a few white steam puffs, the first small houses of a new settlement. No game render yet (the port has no pier until it is founded): use `ref/emberhold.jpg` as the second image. |
| Fogwatch (`fogwatch`) | East (fog, Faroe and Scotland) | Layered basalt cliffs with thin green ledges, an even turf green, almost no trees, a waterfall stepping down into the bay, sheep. Houses of black tar and whitewash with turf roofs and red frames, a white church with a black roof. Its landmark is the two tall sea stacks and the foghorn tower. Light: a soft grey-gold, still sunny. |
| Amber Strand (`amber-strand`) | East (fog, Faroe and Scotland) | A long low island of pale dunes with marram grass and honey-gold amber pieces on the beach, a few turf-roofed houses and drying sheds, a short pier. |
| Rimewick (`rimewick`) | North (ice, Greenland) | Snowy slate hills and snow-covered fir trees above a fjord town of bright wooden houses (oxblood, mustard, slate blue, moss green) with white trim and snowy near-black roofs, a red wooden church with a small bell tower. Its landmark is the jam house with copper pots and steam. Small icebergs in the water. |
| Snowberry Isle (`snowberry-isle`) | North (ice, Greenland) | Snowy hills, pack-ice floes in the cove, a small green moor with red-orange cloudberries by a steaming warm spring, an old shuttered weather station, a glasshouse and a flagpole by the new houses. |
