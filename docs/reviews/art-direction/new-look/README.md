# Art direction for the new look (v1.2, decision 0222)

The art director's input to decision [0222](../../../decisions/0222-a-new-look-smooth-terrain-blue-water-and-forests.md) (smooth terrain, blue water by depth, forests, haze), written 2026-10-26 after reviewing mockup v2 (`/mnt/project-files/graphics-desktop/future-look-v2/`). Guillaume approved the direction. This page gives the build thread the palettes and the rules that keep the [art bible](../../../art/art-bible.md) true on the new ground. All values go into data (`palette.json`, `tuning.json`, props), never TypeScript.

## 1. What the mockup gets right, and what to protect

**Right:** islands read as land, not stacked slabs. Sloping shores and depth-coloured water make the coast believable, and woods finally fill the empty planes (rule 10). Keep all of that.

**To protect while building:**

1. **Biome colour on slopes.** In the mockup, Sunreach's warm ochre and red-brown crater cliffs (decision 0172) became a soft grey-beige. Slopes must take the biome's **cliff colours** (§2); grey is only for the north's slate and the east's basalt.
2. **Crisp zones, not smears.** The slope and height blends in the mockup are wide, which reads as a blurry low-resolution texture. Blend over a short band (about 1.5–3 units), with a little per-vertex jitter, so the ground keeps the storybook's clean colour shapes.
3. **The town stays visible.** On Saltmere the forest swallows the houses. Keep a clear margin around houses, lanes, fields, piers, build spots and plots (§3), and keep the town's side of the island open toward the harbour camera.
4. **Storybook, never grim** (rule 3). Haze is a light tint of the sea's sky colour, never grey. At night the sea stays deep moonlit blue, never black.
5. **Turquoise survives at the coast.** The sea is blue now, but the shallows ring keeps the decision 0012 turquoise. It is the bright band that tells sailors where the land begins.

## 2. Ground by biome (smooth terrain)

The ground is coloured by **zone**, worked out from height and slope. Each biome maps each zone to grounds that already exist in `palette.json` > `grounds`, so the island builder's names still work.

| Zone | Ring | South (tropic) | North (ice) | West (fire) | East (fog) |
|---|---|---|---|---|---|
| Beach | `ringsand` | `coralsand` | `shingle` (grey) | `blacksand` (Emberhold's south shore, the volcano), `greyshingle` elsewhere | `greyshingle`; `dune` at Amber Strand |
| Wet band (the strip where shore meets water) | sand 15% darker, `#d9bf86` | `#e3d3ac` | `#6b6e6c` | `#2f2e30` | `#545754` |
| Lowland | `downs` greens | `jungle` greens | `snow` (blue shadow `#c5d6e6` on slopes facing away from the sun) with `moor` patches where the file has them | `moss` / `moss-dark`; the islands must not read as only black | `turf` `#6a9548` |
| Slope (steeper than about 30°) | `sandstone` warm bands `#c2ad8c` / `#b29c7a` / `#a8916f`, never grey | `jungle` cliff side `#b8743f` / `#a8603a` / `#c08048` | `slate` `#5b6068` / `#6e747c`, snow kept in hollows (flat = snow, steep = slate) | `basalt` / `blackbasalt` | `turf` cliff side: the layered dark bands `#3f434a`–`#74787e` |
| High ground | `downs` | `ochre` bare summits | `snow`; `bergice` and `ice` stay on the glacier props | `volcanic` with its ash cap above 0.55 | `turf` peaks |
| Town terraces | `terrace` / `cut` as today (unchanged) | `terrace` | `cut` with snow | `ashrock` | `turf` |
| Glow | — | — | — | Lava fields keep their cracks in the glow material (`lavafield` `glow #ff5a2a`): about 45% by day, full at night. Lava rivers stay their own meshes. | — |

The face jitter of each ground (its two or three colours) becomes a gentle per-vertex mottling, a few units across, so the colour isn't flat but never turns to noise.

## 3. Trees by biome

Trees stay **chunky and flat-shaded** (rule 1 still holds for them), instanced, with two or three sizes mixed.

| Sea | Mix | Density (share of the free lowland) |
|---|---|---|
| Ring | `pine` and `leaves` broadleaf, about 40/60, pines on high ground | up to about 40% |
| South | `palm` on the coast and lower terraces, `jungle` broadleaf inland, no pines | up to about 55% |
| North | `snow-pine` only, in sheltered valleys and low ground, none on slate slopes or above the snow line | about 15% |
| West | low birch scrub clumps on the moss (dark moss greens), none on lava, ash or basalt | about 8% |
| East | **no forest** (the bible: almost treeless). Instead, heather and bracken patches (`#8d6b8e` / `#9a7a3a`) on the turf, dry-stone walls, sheep | 0% trees |

Clear margins: no tree within 1.5 house widths of a house, nor on lanes, fields, piers, build spots, plots, or the harbour camera's line to the town. Woods in an island file (`woods`) still say where trees go; the new forest fills those areas more densely rather than inventing woods everywhere.

## 4. Water by depth, per sea

Three colours per sea: shallow (the coast band), mid and deep. The light ramp and foam work as today. The tints blend across the borders between seas over 60–100 units, as now (§8 of the bible).

| Sea | Shallow | Mid | Deep | Notes |
|---|---|---|---|---|
| Ring | `#58c2c0` | `#2f8fb8` | `#1f5f94` | the reference |
| South | `#7fd6cf` | `#39a9c4` | `#2479a8` | lagoons (sheltered zones) stay in the shallow and mid colours |
| North | `#6fb9c9` | `#2f7d9e` | `#1d5578` | colder, less green; the shallows tint round icebergs |
| West | `#4fa9a8` | `#2a7a8c` | `#1d5068` | a touch greener near the volcano; keep the warm current shimmer |
| East | `#6aa3ad` | `#3a7489` | `#284f63` | fog banks grey it further, as today; the Stormbreak keeps `#2b5266` / `#3e6a7c` |

Foam: `#e6eef2` to `#f6f9fb` at most, never pure white.

**Haze** is the sea's sky colour by day: ring and south `#cfe3ee`, north `#d9e6ee`, west `#d8d2cc` (a warm hint of ash), east `#c9d3d6`. At night it is `#1d2f4a`. It stays clear within about 150 units of the camera and reaches at most about 35% at the horizon. It never hides a hazard the player must read (reefs, shallows, buoys) inside the sailing view.

## 5. What stays faceted on top of the smooth ground

These are the game's silhouettes; smoothing them would lose the landmark. Either they stay faceted props, or the island file gets a **per-shape smoothing amount** (`smooth: 0` for these), editable in the island builder and in `npm run island`.

- **Sea stacks and pillars:** Fogwatch's two stacks (its signature), The Giant and His Wife, The Chimneys, The Tongs, Organ Pipes' basalt columns, Teeth Rock, Selkie Rock, The Kittiwakes, every open-water stack and skerry from the density fills.
- **Signature cliffs:** Fogwatch's layered cliff bands, Sunreach's crater rim (the ridge line stays sharp; its inner slopes may soften), Stonehaven's cliff under the light, Rimewick's fjord walls.
- **Volcanoes:** the Smoulder's cone and crater rim, Emberhold's small crater.
- **Ice:** icebergs, glacier fronts, pack-ice floes.
- **Reefs and rocks:** reef rocks, boulders, cairns, standing stones, the broch.
- **Everything built:** houses, piers, lighthouses, walls (rule 1 unchanged).

## 6. How each island gets approved

Island by island, the ring first (the first thing players see), then the south, north, west and east. For each island:

- the build thread sends before and after shots at the review cameras: town at `--zoom 1.4`, overview at 2–4, `--night`, levels 1 and 4, and phone portrait;
- High, plus **Low** on the same frame, since Low must still look like the same game;
- for any change to a coast, a chart overlay showing that the smoothed shore matches the sim's coast;
- one art round, then Guillaume (decision 0165, §10 of the bible).
