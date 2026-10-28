# Art director handover (v1.0 to v1.1, 2026-10-28)

For the "Art director (v1.1)" thread, in the format of [roles.md](../roles.md). Rules are in the [art bible](art-bible.md) (decision [0165](../decisions/0165-art-bible-and-the-phase-4-biome-looks.md)); this page only holds what is open. Guillaume gives the final OK on every visual: your OK means "ready to show Guillaume", never "merged". Your own PRs are docs only.

## 1. Open decisions

| What | Who waits | State |
|---|---|---|
| **Style E, the UI reskin** ([0220](../decisions/0220-a-game-like-ui-skin-style-e.md), issue [#261](https://github.com/djguiaume/fair-winds-trading/issues/261)) | the build thread of #261 (last wave) | Proposed. Still to do, in this order: a "UI" chapter in the bible (materials, tokens, font, frames), then static mockups of two directions side by side (logbook, painted wood) for the title menu, new voyage, sea HUD, port Market and Quay, chart and a quest card; Guillaume picks one; 0220 is then updated with the font, colours and frames. No mockup exists yet. |
| **Ultra look** ([0221](../decisions/0221-an-ultra-quality-level-for-desktop-and-xbox.md), issues #257 and #258) | the Ultra build thread | You review its day and night shots of every main port (lighting, tone mapping, sky reflection, foam). Night stays deep blue, never black; colours stay saturated. |
| **v1.2 new look** ([0222](../decisions/0222-a-new-look-smooth-terrain-blue-water-and-forests.md)) | v1.2 build thread | Direction approved by Guillaume; not built. Each island's final look is approved from screenshots, the ring first. The art guide below is the input. |
| **Ring port size** | Guillaume | The central-sea review asked whether to grow the four ring towns (radius 18 to 26, against 48 to 60 for the outer main ports) to about 34. Check what was decided before the ring is redone for 0222. |

## 2. Pointers

- **Art guide for v1.2** ([new-look/README.md](../reviews/art-direction/new-look/README.md), PR #253): what to protect from mockup v2 (biome cliff colours, crisp zones, a visible town, warm haze, turquoise shallows), ground zones per biome mapped to `palette.json` grounds, tree mixes (east has no forest), water ramps and haze per sea, what stays faceted (sea stacks, signature cliffs, volcanoes, ice, reefs), and the island-by-island approval set (High and Low on one frame, a coast overlay).
- **Phase 5 notes** ([phase5/README.md](../reviews/art-direction/phase5/README.md)): colours and sizes agreed for traffic boats, regatta marks, Skerry's staked plots, hull damage, port header and sounds. Earlier notes: [south](../reviews/art-direction/south/README.md), [volcano](../reviews/art-direction/volcano/README.md), [sea density](../reviews/art-direction/sea-density/README.md), [whole game](../reviews/art-direction/whole-game/README.md).
- **Bible sections to know:** rule 10 (one detail level, Sunreach the benchmark), §6 (smoke and steam), §8 (four seas, where seas meet, the sea's edge), §9 (architecture by sea). Rule 1 (flat shading) and §2's sea colour change when 0222 is built.
- **Colour reservations:** red is for the edge buoys, amber `#ffb36b` is storm warning, yellow is the regatta's marks, brass `#e8c46a` is the HUD. Never pure white (`#f6f9fb` at most).
- **Budgets:** main ports 6,000 triangles (7,500 only after a `?bench` run), stack or skerry about 300, wreck 400, islet 1,200, per sea quarter at most about 15 open-water pieces and 8,000 triangles (decision 0180). Traffic boats on screen: Low 3, Medium 6, High 10.
- **Review habits:** same camera for every comparison (town `--zoom 1.4`, overview 2 to 4, plus `--night`, level 1 and 4, portrait for towns); look at every image yourself. Recurring flaws: dark night towns, empty planes, one-tone cliffs, regular polygons, small white details that read as litter. Answer in a short list (must fix, good, nice to have) and skip a second round when fixes are small. Thread messages are capped at 2,000 characters; for longer notes write a file and send the path.
- **Tools:** `npm run shots`, `npm run chart`, `npm run island`, `npm run sound`. Colours in `src/data/palette.json`, props in `src/data/props/`, flags in `src/data/flags.json`. Shared-folder sheets: `/mnt/project-files/art-director/`.
- **Thread ids:** find them with `list_threads` and match the relay's session id before replying. Never send a test message.

## 3. Follow-ups

Agreed small work not yet done. None has an issue yet; open one (label `idea`) when it is picked up.

- Main-port budget of about 7,500 triangles: needs a `?bench` run on the old tablet, and 0222's denser ground changes the numbers, so decide it with that.
- Fogwatch: two or three more crofts and dykes on the lowest south shelf, and the foghorn tower's lit lantern room (Elias's payoff), bigger so it reads.
- Palm Key: a clear visual step at town level 3.
- Emberhold town grass: fewer, bigger boulders in clusters.
- Sunreach at night: a few more lit windows on the upper lane.
- First real sea extension: zones that hug the old rim (the Stormbreak) must continue into the new section or fade out at the seam (0202).
- Portrait shots of each main port, once.
- Pirates, warships and the "cozy fight" rules are parked for a later extension sea (notes in [whole-game/README.md](../reviews/art-direction/whole-game/README.md)).

## Follow-ups from the Abbey Head club (#312)

- v1.2 budget pass: lit windows at night, a striped awning and a few tables for the café, a lamp on the shed. The island is at its mobile triangle budget (0073), so they need budget freed first.
