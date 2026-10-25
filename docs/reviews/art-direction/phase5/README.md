# Art section for the Phase 5 brief (the living sea)

The art director's input to the Phase 5 brief (2026-10-25), after Guillaume picked option B: the living sea, no pirates, story regattas, Phase 5 ends at v1.0. Pirates, warships and the "cozy fight" rules stay on file for a later extension sea ([whole-game art view](../whole-game/README.md)). Every rule of the [art bible](../../../art/art-bible.md) holds; Guillaume sees every screenshot before anything merges.

## 1. The living sea's boats

Three kinds, each one recipe in data, coloured from `palette.json` by the sea's style:

| Kind | Model | Where | Look per sea |
|---|---|---|---|
| **Fishing boat** | the existing `fishingBoat` prop (already moored off town beaches), given a small lug sail and a wake | near every port and fishing grounds, short loops | hull and sail colours from the port's style: tropic white and teal in the south, tarred black with red sail in the east and west, bright painted in the north |
| **Coaster** | one new small model: a two-mast trading ketch-sized hull built from the shared boat parts, about the hoy's size | port-to-port lanes, carries the port's goods as deck cargo (crates, sacks, timber) | the home port's colours on the band and flag |
| **Far-sea visitor** | reuse the player's fluyt, indiaman and schooner models at a far level of detail, in a visitor livery (a foreign band colour, a pennant) | the ring's port towns and the outer seas' main ports, rare | one livery per sea it comes from, so a Rimewick visitor in Saltmere reads as "from the north" |

Rules:

- **Same storybook D style** (decision 0012/0035): medium proportions, bellied sails, one colour band. They sail by the same wind as the player (sails trimmed to the wind, heel, no-go zone respected), so they also show the wind.
- **Never confused with the player:** the player keeps the only brass pennant and the selection ring; traffic has no HUD label until you pass close.
- **Solid or not:** traffic gives way and never rams; a collision is a soft bump, no damage either way.
- **At night:** a stern lantern (lit-window material) and a masthead light; no new real lights.
- **Budget** (to confirm with a `?bench` run on the old tablet): fishing boat about 350 triangles, coaster about 900, a visitor's far model about 1,500. Visible at once: **Low 3, Medium 6, High 10**, about 3,000 / 6,000 / 10,000 triangles; one instanced draw per kind. Beyond the camera's far band they are not drawn.

## 2. Regatta looks

- **Course marks:** big round **yellow racing buoys** with a numbered flag (yellow is free: red is the edge buoys, amber means storm). Rounding side shown by a small arrow on the buoy's flag.
- **Start and finish line:** two flagged marks with a dotted white line on the water between them (the wind-streak shader's dash, no transparency), checkered flag on the finish.
- **Committee boat:** yes, an anchored coaster with bunting and a signal mast that shows the countdown flags (5, 4, 1, go) as big shapes, and fires a white puff for the start (the decision 0178 puff).
- **Rivals:** the coaster and schooner models in race liveries, one bold colour and a sail number each; the NPC host's colours on the committee boat.
- **The port during a regatta:** bunting on the quay and a few anchored spectator boats (fishing boats). All as props with `during:` tags, so they come and go with the event.
- **Chart:** the course drawn in yellow with numbered marks.

## 3. Ring catch-up pass

Order: **Westholm and Saltmere first** (the first ports every player sees), then Stonehaven, Abbey Head, Port Calda, Skerry's surroundings and the small islands (Watchman Key, Lantern Rock, Bell Rock, Gull Hook, Teeth Rock, Greyback Ridge, South Cay), then open water.

Checklist per island, at the same cameras as Sunreach (town `--zoom 1.4`, overview 2–4, `--night`), at town level 1 and level 4:

1. **Shape:** ragged outlines, offset tiers, bays and headlands; no stacked octagons or straight extruded ridges.
2. **Ground:** cliff colour bands and face jitter; beaches with a shelf colour; no one-tone sandstone.
3. **No empty planes:** woods (not lone ball trees), fields, walls, gardens, boats at the shore.
4. **Towns:** houses packed along lanes, lamp posts, every house recipe with lit windows.
5. **Signature:** one landmark you can name from the sea, agreed with the storyteller (Saltmere and Port Calda still need theirs).
6. **Reefs** read as reef (rock clusters with surf), not scattered pebbles.
7. **Budget:** 6,000 triangles per port until a `?bench` run allows 7,500 for the main ports.

## 4. Skerry: the Island tab and staked plots

- A harbour-screen **Island** tab at Skerry (same style D, same navigation as the other tabs): the free plots, the buildings you have earned and what each gives.
- Picking a plot drops the panel to half height and turns the camera to that plot on the island, highlighted with a soft ring, so you see where it goes.
- On the island the numbered UI circles become **staked plots**: four corner stakes, a string line and a small sign board; built plots show the building. Visible from the sea, no special mode.
- Docking at Skerry opens the Island tab when something can be built; an arc reward ends with "Build it at Skerry" (the storyteller words it).

## 5. Port screen header

- A band across the top of the port screen with a **small rendered view of the port at its current level** (one snapshot from a fixed camera per port, taken when the screen opens or the town grows, cached), the port's name and its house palette as an accent line.
- The empty space under the Market rows holds the **keeper's portrait** (the decision 0124 portraits) with one line of talk, the town's level and its next growth.
- On the Quay tab, the empty state shows the quay itself (the header view) and a line such as "Nobody waiting. Come back after the next tide."
- Portrait layout: the header shrinks to a strip with the name and palette accent.

## 6. Visible hull damage

Guillaume's note of 2026-10-19, now for crashes and reef strikes:

- **On impact:** a white splash, a few floating planks (shared instanced debris, they drift and sink in a few seconds), a crash sound.
- **Every 25% of hull lost**, the model changes: 75% scuffed paint (darker band patches); 50% a patched sail and a missing rail section; 25% torn sail, a list of a few degrees, a pump spout of water at the side. Repair clears it.
- Parts swap by data in each ship's model file, not new models; no transparency, no particles beyond the shared ones.
- The hull bar on the HUD keeps its colour steps in step with the model.

## 7. Sounds

- **A bed per sea:** ring gulls and surf; south palms and lagoon lap; north ice creak and wind; west lava hiss and distant rumble; east sheep, foghorn, rain on the deck.
- **Harbour:** a bell when you dock, crowd murmur at level 3–4 towns.
- **Ship:** sail flap when trimming, luff when in irons, hull thud on a crash, planks.
- **Regattas:** the committee boat's countdown horn and start gun, a cheer at the finish.
- One music theme per sea (variations on the main theme), and a regatta theme. Hazard switches mute their sounds too.

## Answers to the build threads (2026-10-25)

- **Sounds of the sea:** palette agreed; north adds far glacier calving and a few seabirds near Rimewick, west a lava-meets-sea hiss at the river mouth and a rumble tied to the eruption timer (never a sustained drone), east sheep near Fogwatch and rain inside the Stormbreak, Fogwatch's own foghorn. Hazard switches mute their sounds. **One bell sound, pitched per port as data** (bigger towns lower, outposts a handbell, Skerry the smallest and brightest).
- **Hull damage:** keep the class band and racing stripe (patches over it); splash in foam colour, never pure white; planks in `plank`; scuffs warm darker hull colour, never grey; list 4°, 6° if it doesn't read on a phone; the pump spout is 3–4 pulsing foam chunks, dropped if it reads as litter; HUD bar brass `#e8c46a` below 75%, red below 50%, deeper red below 25% (not storm amber); nothing glows at night.
- **Skerry's Island tab:** stakes in `post` with a `flag` ribbon (locked plots without ribbon or sign), `cream` string, a `plank` sign with the number in `post`; selection ring in brass `#e8c46a` on the ground, opaque, no glow; the old "+" circles go; the tab matches the Market tab in style D, navigation and controller focus.
- **Ships at sea:** ring boats in B2 red and blue with cream sails; never pure white sails; visitor bands north oxblood `#a8403a`, south jade `#2a8f6e`, west dark ember `#8a3a2a`, east tar `#2f3035` with a red stripe `#b8433a`; no amber (storm) or yellow (regatta) on traffic; fishing boat 0.45× the sloop, 0.55× if lost on a phone; a visitor's far mesh leans on the right tack; smaller wakes than the player's.
- **Port header:** three cached states (day, dusk, night); no fog but the east's look tint kept; accent line in the port's signature colour, as data; navy gradient to ~45% width; default cameras keep the signature in frame (Sunreach tea house, Fogwatch's stacks and foghorn tower, Emberhold's glassworks chimney, Rimewick's fjord houses), `headerView` editable in the island builder and CLI; a ~60 px slice of the picture in portrait.
