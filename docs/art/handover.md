# Art director handover (v1.3.1 to v1.4, 2026-10-31)

For the next art director thread, in the format of [roles.md](../roles.md). Rules are in the [art bible](art-bible.md), now describing the v2 look as the default (decisions [0222](../decisions/0222-a-new-look-smooth-terrain-blue-water-and-forests.md), [0165](../decisions/0165-art-bible-and-the-phase-4-biome-looks.md)). This page only holds what is open. Guillaume gives the final OK on every visual: your OK means "ready to show Guillaume", never "merged". Your own PRs are docs only.

## 1. Open decisions

| What | Who waits | State |
|---|---|---|
| **Surf and beach wash (#286, #397)** | v1.4 | Looks I approved for Guillaume: 1 thin breaking line at 14 kn, 2 in storm, classic ring kept, crisp front, faded tail, half at night, never above `#f6f9fb`; wash with warm wet sand `#d6cbb8`, foam edge, rock shores foam only. Numbers in `waves.json > surf / wash`. Guillaume's own verdict is what counts; re-check High, Low (unchanged, waves off) and night. |
| **Boat ride and drag (#283, #284)** | v1.4 | Ride caps: roll 6° sloop/schooner, 4° fluyt, 3° indiaman; pitch 5° to 2.5°; 1.5 s smoothing; 1.5x in storm; rise follows the sea (not fixed metres), bow keeps 0.4 units of freeboard. Judge on a device or video, stills hide the lag. HUD line "Waves −3%" is a footnote: keep it dimmer than the wind text. |
| **Reef foam** | next | Grey Lady's outer ring is a bit uniform; let its width vary with the swell. |
| **Ultra on Xbox, costs** | v1.4 | [#374](https://github.com/djguiaume/fair-winds-trading/issues/374), [#377](https://github.com/djguiaume/fair-winds-trading/issues/377). Ultra notes: Emberhold rock keeps its facets, lava cracks the brightest thing; lamp glow warmer and smaller; window lights at High's brightness at night; haze 10 to 15% (warm by day, blue by night). |
| **Triangle budgets** | each raise | Budgets are ceilings, every raise is argued (what it buys, what it costs on Low). Low on a weak tablet is [#380](https://github.com/djguiaume/fair-winds-trading/issues/380). |

### What I would ask for v1.4

- **Boat upgrades (#295-#301):** follow [boat look rules](../reviews/art-direction/new-look/boats.md). One readable change per level (sails, trim, flags), no new facets on smooth hulls, same silhouette per class so players still recognise it at far LOD, and ride/tilt must still look right (pivot at the waterline). Show each class at levels 1 to 3, High and Low, day and night, one combined sheet; budget raises argued per ship.
- **Phone look idea (#405):** judge portrait first. Keep numbers and HUD readable, no new per-frame cost, Low stays the reference. Offer 2 or 3 variants as static mockups (Guillaume prefers images over playable demos) before building.

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
