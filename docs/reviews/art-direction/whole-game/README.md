# Art view for the whole-game review (after v0.4)

The new art director's answers to the thread "Review the whole game and the roadmap" (2026-10-25), before the Phase 5 brief. Nothing here is built until Guillaume picks a Phase 5 direction. Rules: [art bible](../../../art/art-bible.md); open items from the [handover](../../../art/handover.md).

Screenshots (v0.5.0 main, desktop, default level, `npm run shots --look … --zoom 1.4`):

- [sheet-towns.jpg](sheet-towns.jpg): top row Sunreach and Westholm, middle Saltmere and Port Calda, bottom Westholm and Sunreach at night.
- [sheet-port.jpg](sheet-port.jpg): Westholm's port screen, Market and Quay tabs.

## 1. The three weakest areas against the bible (Sunreach the benchmark)

1. **The Windward Ring, where every player starts.** The four seas were raised to rule 10; the ring never was. Westholm and Saltmere at level 1 are a handful of tiny houses on a flat green plane with lone round trees, beaches with no shelf colour, one-tone cliffs. **At night Westholm is dark:** no lit windows, only the pier lamps (Sunreach's lanes glow). The first ten minutes of the game are the plainest part of it. Fix: a ring catch-up pass on the same checklist as the seas (woods instead of lone trees, cliff bands, lanes with lamp posts, gardens and boats, lit windows on every ring house recipe), one port at a time, Sunreach as the bar.
2. **The port screen.** A dark navy table: four rows on Market, then half a screen of nothing; the Quay tab is one line of text on empty navy. It carries none of the port's character, though it is where the player spends a third of the time. Fix (cheap, data driven): a port header band with the port's signature drawn from the scene (or a small rendered vignette of the town at its level), the port's house palette as an accent, and the empty space used for the keeper's portrait and the town's level and next build. Style D stays.
3. **Sound.** Not strictly art, but it is the thinnest part of the presentation: one music theme, creak and foghorn. Each sea deserves an ambient bed (surf, gulls, wind in the rigging, ice creak, lava hiss, sheep) and the harbour a bell. Pirates will need cannon and splash sounds anyway, so it is worth one audio pass with them.

Also seen: Port Calda is already closer to the bar (woods, lake, stepped mountain); the gap is widest at Westholm and Saltmere. Abbey Head, Stonehaven and the small ring islands still need the same look at the same camera.

## 2. Pirates and the storybook look

**It fits.** The game's reference is the *Privateers: Pirate Wars* ad, which is pirates in exactly this bright low-poly style. What keeps it cozy is how threat and harm are drawn, not leaving pirates out:

- **Read the threat by colour and silhouette, not by gore.** Pirate ships are the existing lines in pirate dress: tar-dark hulls, patched oxblood or charcoal sails, a cartoon flag. Red is already reserved for pirates in the bible (amber means storm), so the chart badge, warnings and pirates' night lanterns use red.
- **Hits are splashes, splinters and smoke, never fire or bodies.** A shot is a muzzle puff (the decision 0178 smoke puffs, steam-white), a ball, a white water splash on a miss, a shower of wood chips on a hit. Nothing sinks (decision 0038); a beaten pirate strikes its flag and limps off, a boarded merchant loses cargo, not crew.
- **Warships stay storybook D.** Ketch, brig and frigate on the shared square rig, same proportions as the fluyt and indiaman, with gun ports as a painted band (the indiaman already has them), navy-and-brass colours so the player's warships read as "ours", not as pirates.

What it needs: three warship models (one file each, decision 0077); a pirate dress applied to existing hulls (colours, patched sails, flag) as data; **flags as data** (pirate, naval, each port's colours; the same system later gives cosmetics); effects (muzzle puff, ball, splash, chips, a struck flag); a pirate cove or two in the art of the sea they haunt; visible hull damage (below); a red pirate marker on the chart and HUD; sounds (cannon, splash, bell). Settings switch: pirates off leaves the seas looking the same.

## 3. Roadmap order from the art side

- **Earlier, into Phase 5:** visible damage (Guillaume's 2026-10-19 note: debris and splash on impact, the model changing every 20–25% of hull lost, cleared by repair). Combat is unreadable without it, and reef and coast crashes get it for free. **Flags as data** too: pirates need them, and ship cosmetics then cost little.
- **Before or at the start of Phase 5:** the ring catch-up pass and the port screen header (§1). They are small, they touch the first impression, and they do not depend on the pirate design.
- **Keep later:** seasons (they touch every island and the palette; Phase 7), ship cosmetics beyond flags (sail colours, figureheads; Phase 7, once flags exist), kids-mode art.
- From the handover, still open and worth doing with the ring pass: Fogwatch's lantern room and the main-port 7,500-triangle budget (needs a `?bench` run), Sunreach's upper-lane windows, Palm Key's level-3 step, Emberhold's boulder clusters.

## 4. The central sea and Skerry's build view (Guillaume's must-haves, 2026-10-25 14:34Z)

[sheet-ring.jpg](sheet-ring.jpg): Abbey Head and Lantern Rock (top), the ring's middle at zoom 4 and Skerry moored with its build spots (middle), Skerry from above and Watchman Key (bottom).

### What the ring review should cover

The same review the outer seas got, island by island at the same cameras (town `--zoom 1.4`, overview 2–4, `--night`), at town level 1 and level 4, with Sunreach beside it:

- **Shape:** coast outlines, tiers and ridges against the bible's "no regular polygons" flaw list.
- **Detail level (rule 10):** woods, cliff bands, lanes with lamp posts, gardens, boats, fields, walls; no empty planes.
- **Night:** lit windows on every ring house recipe.
- **Signatures and story:** one nameable landmark per port, agreed with the head storyteller (Westholm's mill, Stonehaven's light, Abbey Head's abbey; Saltmere and Port Calda need theirs named), and the arcs' payoffs visible on the island.
- **Open water:** density per decision 0180 (no empty disc over r150), reef and shallows look, the ring's borders with the four seas (§8 of the bible).
- **Budget:** triangles per port and island (6,000 now; the 7,500 main-port budget needs a `?bench` run).

### Top three ring gaps against Sunreach

1. **Man-made shapes.** Abbey Head, Lantern Rock and Watchman Key are stacked octagons; Greyback Ridge and the long ring islands are straight extrusions with parallel tiers. Sunreach is an organic crater. The ring needs ragged outlines, offset tiers, bays and headlands.
2. **Thin, dark towns.** A few small houses, no lanes with lamp posts, no gardens or boats; Westholm is dark at night.
3. **Empty planes and one-tone ground.** Flat green caps with lone round trees and plain sandstone tiers, where the seas have woods, cliff bands and props. Reefs read as scattered pebbles.

### Skerry's build view

**Move the choice into the harbour screen as an "Island" tab**, and keep the 3D island for the result. The tab lists the free plots and the buildings you have earned, in the same style D and navigation as the rest of the port screen (Guillaume's rule: one menu style everywhere). Picking a plot in the tab turns the camera to that plot on the island behind the half-height panel, so the player still sees where it goes. On the island itself the numbered UI circles become in-world markers (a staked plot with a small sign), which read as "something can be built here" without a mode of their own. An arc reward then ends with "Build it at Skerry", and docking at Skerry opens the Island tab directly. This is a UI and flow change: the art side is the plot marker prop and the camera move; the head storyteller words the reward line.
