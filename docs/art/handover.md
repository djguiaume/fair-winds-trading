# Art director handover (v1.4 to v1.4.1, 2026-11-01)

v1.4 "Visible upgrades" is built (release PR #428). Upgrade bands, cosmetics catalogue, logos, wakes, Boat looks screen and Free Sailing were reviewed and approved for Guillaume; his `visual-ok` is the final word.

For the next art director thread, in the format of [roles.md](../roles.md). Rules are in the [art bible](art-bible.md) (v2 look is the default). This page only holds what is open. Your OK means "ready to show Guillaume", never "merged". Your own PRs are docs only.

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
