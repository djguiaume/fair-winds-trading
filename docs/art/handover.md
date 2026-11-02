# Art director handover (v1.5 "A real game" to the next release, 2026-11-02)

v1.5.372 shipped the UI rebuild: one identity, the chart table (art bible section 11, decision 0268). Your OK means "ready to show Guillaume", never "merged". Your own PRs are docs only. Earlier open items (v1.4 look rules, logos, figureheads) are kept below.

## 0. The UI identity and the rules I enforced

- **Identity:** ink on paper. Paper `#efe6d1`, ink `#23303a`, sage `#4a6d41` as the one signature (selection and the one primary action per screen), IM Fell English for titles and Alegreya Sans for UI and numbers. Torn paper edges as 9-slice images, no filters. Round picks: direction 1, ledger D for the harbour, logbook title page, file tabs on an ink rule (#457).
- **Never:** red, amber, yellow or brass as UI colour (buoys, storm warning, regatta, player pennant), pure white, teal with gold, red confirm buttons (destructive actions are ink buttons), blur.
- **Sea:** text straight on the scene gets a hard 1 px ink halo; instruments (compass, speed) always get a faint backing; status 14 px, destination 16 px, compass has a hatched ink no-go wedge, speed is the biggest number.
- **Harbour:** banner of the port on top, opaque ledger below, the same on every tab; Set sail is solid sage and large; the 3D preview is a fixed box.
- **Review habits:** check phone landscape for clipped rows and buttons, night paper opacity (about 95%), 11 px floor, tab and close keycaps in ink, text matches drawings (hatched zone, not red zone).

### Nits left open

Desktop Market and Orders leave the bottom about 20% empty; the Settings Game tab fills only the top third on desktop; night quest chips have thin contrast on 12 px text; phone lists need an edge fade as a scroll cue; quest card on phone sits close to the compass and speed plate; the Boat looks icon and goods list have dead space.

## 1. Open

| What | State |
|---|---|
| **Upgrade look rules (kept)** | Sail bands: swift line deep blue, haulers saturated green `#0b7a4c`, foot band about 1.8 rows deep from sails 2, centre stripe and head band at 3. Hull band at 2, copper at 3. No pink or rose, no brass or yellow in swatches (validator enforces). |
| **Logos** | One per sail, mainsail only, about half the sail width at game zoom, swatch colour, validator refuses lightness above 0.55 until a night edge exists (first pale logo needs it). Race number hides the logo. |
| **Wakes** | Tint and pattern only on Low and Medium; patterns and sparkle on High; foam never above `#f6f9fb`. |
| **Figureheads** | Hang on the stem under the bowsprit, about 0.15 of hull length. Sun may still read as a wheel stuck to the hull: make it smaller, tuck it to the stem, use a lighter carved wood (not brass). |
| **Boat looks screen** | Layout B (Wardrobe). Wake view centres the stern. Hint "Logos are best seen from the side". |
| **Free Sailing (#300)** | Preset cards want a weather icon (deferred to v1.4.1). Badge is the small token on a navy pill with brass edge. |
| **Clipper and schooner hulls** | Still slightly olive at levels 2 to 3. |
| **Surf, ride, Ultra, budgets** | Unchanged from v1.3.1 (see [v1.3.1 notes](../releases/)): reef foam width varying with swell, Xbox Ultra notes in [#374](https://github.com/djguiaume/fair-winds-trading/issues/374) and [#377](https://github.com/djguiaume/fair-winds-trading/issues/377), triangle budgets argued per raise, Low on a weak tablet [#380](https://github.com/djguiaume/fair-winds-trading/issues/380). |

### What I would ask for v1.4.1

- Phone look idea (#405): judge portrait first; keep numbers and HUD readable, no new per-frame cost, Low stays the reference; 2 or 3 static mockups before building.
- More cosmetics with the same validator rules; new figureheads follow the stem mount and the 60 triangle cap.

## 2. Pointers

- **v1.2 art notes:** [boat look rules](../reviews/art-direction/new-look/boats.md), [new-look guide](../reviews/art-direction/new-look/README.md) (ground zones per biome, tree mixes, water and haze), [phase 5 notes](../reviews/art-direction/phase5/README.md), earlier [south](../reviews/art-direction/south/README.md), [volcano](../reviews/art-direction/volcano/README.md), [sea density](../reviews/art-direction/sea-density/README.md), [whole game](../reviews/art-direction/whole-game/README.md).
- **Rulings (Guillaume):** no new facets on smooth shapes (Stonehaven, 2026-10-30); ring ports already grew to radius 36, 36, 36 and 34 (0216), no blanket growth, one island at a time with a chart and `npm run balance`.
- **Review habits:** same camera for High and Low (one frame each) plus night; judge Low against High (shore band, foam ring, trees, no blobs). Common v1.2 flaws: blurry zone edges, dark seabed blobs on Low, glowing night shallows, bare islets, dark blobs that read as stains. Answer in a short list (must fix, good, nice to have). Look at every image yourself.
- **Colour reservations:** red edge buoys, amber `#ffb36b` storm warning, yellow regatta marks, brass `#e8c46a` HUD, never pure white (`#f6f9fb` at most).
- **Tools:** `npm run shots`, `npm run chart`, `npm run island`, `npm run sound`; colours in `src/data/palette.json`, trees in `src/data/forests.json`, ground and shader numbers in `terrain.json` and `graphics.json`. Shared-folder sheets: `/mnt/project-files/` (`new-look-review/`, `forests/`, `depth-water/`, `boats-v12/`).
- **Thread ids:** find them with `list_threads` and match the relay's session id before replying. Never send a test or placeholder message. The coordinator names the thread to reply to; copy that id exactly (one reply in v1.3 failed on a mistyped id).

## 3. Follow-ups

Agreed small work not yet done. Open an issue (label `idea`) when one is picked up.

- [#372](https://github.com/djguiaume/fair-winds-trading/issues/372): Rimewick Low's white summit spot (renderer), Amber Strand rock pools (new prop).
- Two Palms: the grass patch edge is still soft.
- Fogwatch: the foghorn tower's lit lantern room (Elias's payoff), bigger so it reads.
- Palm Key: a clear visual step at town level 3.
- Sunreach at night: a few more lit windows on the upper lane.
- Amber Strand: grows visibly with its levels (dune grass, driftwood, rock pools).
- Abbey Head club (0227): lit windows at night, café awning and tables, a lamp on the shed; the island is at its mobile budget, so free budget first.
- The Tern (0228) and the Sailing Club chart (0226): look at them again in the v2 look.
- First real sea extension: zones that hug the old rim must continue into the new section or fade at the seam (0202).
- Pirates, warships and the "cozy fight" rules stay parked for a later extension sea (notes in the whole-game review).
