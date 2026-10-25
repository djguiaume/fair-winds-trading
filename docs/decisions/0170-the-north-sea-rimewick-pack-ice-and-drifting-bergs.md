# 0170. The north sea: Rimewick, pack ice and drifting bergs

**Status:** Proposed (2026-10-24). Waiting on Guillaume's look check (art director first).

## Context

Phase 4's north sea ([0137](0137-phase-4-biomes-and-founded-outposts.md), story in [0147](0147-phase-4-story.md)) is the ice biome. Guillaume asked for Greenland, Svalbard or Antarctica as inspiration, snow and ice textures, snowmen and snow-covered trees, everything as data and editable in the editors and the command-line tools. The storyteller's brief sets the people and places: Rimewick and Sigrun Vale's cloudberry jam, Snowberry Isle's cove locked by pack ice until Sigrun's quests are done, a warm spring and cloudberry moor, the old weather station Nell rebuilds and a glasshouse. Hazards must have Settings switches, and the whole thing must stay cheap on a 2 GB tablet. The art bible ([docs/art/art-bible.md](../art/art-bible.md)) sets the north's grounds, props and houses, and its rule 10 asks every main port to match Sunreach's detail at the same camera.

## Decision

**The sea** (`src/data/seas/north.json`, made with `npm run sea`, [review](../reviews/north-sea/README.md)):
- Rimewick, the main port: level 3 at start, no top level, makes cloudberry jam from level 3. A fjord between two arms, with a glacier and slate fells behind.
- Snowberry Isle, the site you found (level 1 to 3, gathers cloudberries). Its shelf ice rings it, and the Snowberry Pack closes the cove on the harbour side.
- Small islands: Whitefell, Lead Rock (the beacon), Cairn Holm and Seal Rocks.
- The Floe Line is a barrier of ice floes with one gateway, the Rime Gate. Inside it is the Whistle cold gale. The Calving Grounds is a berg field.
- **The Cold Sea**, a zone of the new kind `cold-sea`, tints the water and sky colder past the Floe Line and changes nothing else.

**New terrain kinds:**
- `ice`: solid floes, drawn as a floe sheet. It can be tagged `before:`/`after:` a quest like any quest land ([0166](0166-land-that-rises-or-clears-after-a-quest.md)), which is how the Snowberry Pack goes after `rimewick-jam`.
- `bergs`: a berg field. Icebergs drift round loops inside the outline. The outer loop is the outline smoothed and drawn in until the largest berg clears the edge. Each inner loop (`loops`, any number the field has room for) turns the other way, `spin` sets the first loop's direction, and `sway` sets how far bergs swing either side of their loop.
- Where a berg is follows only from the map and the time, so nothing is saved. Bergs are solid and have their own Settings switch. Numbers are in `weather.json` › `bergs`.
- A map check warns when a field cannot fit the bergs it asks for. The player's chart shows each berg only on Fair winds (difficulty knob `chartBergs`, Guillaume). The editor's chart and `npm run chart` always show the loops, sway bands and arrows.

**Zone tint:** a wind-zone kind may have a `tint` (water, light water, shallows, optional sky, fade distance), blended by the renderer and dimmed at night. No switch clears it.

**Islands** use the `ice` style ([0168](0168-ground-materials-and-island-styles-as-data.md)), which turns grass into snow, rock into slate and sand into shingle:
- Cliffs get a slate tier under the snow, so they read in bands.
- The glacier is the `ice` ground.
- Rimewick holds bright fjord houses along three lanes, Sigrun's jam house (it steams after her arc), a red church, lamp posts, kitchen gardens, picket fences, woodsheds, sledges, snowmen, boats in the fjord, snow firs and rocks poking through the snow. It stays within the 6,000-triangle budget.
- New props, all data: `sledge`, `snow-rock`, `picket-fence`, `woodshed`, `snow-garden`, plus the earlier north props (snow fir, snowman, iceberg, warm spring, cloudberry patch, weather station shut and rebuilt, glasshouse, jam house, Lead Rock cairn tumbled and lit).
- A prop recipe can carry a `lamp` (`{y, color}`): any prop with one lights at night as a beacon. Lead Rock's rebuilt cairn uses it. A lamp is not inherited through `extends`.

**Quests** (quest engine, [0125](0125-quest-engine.md)):
- `saltmere-letter` (Kit's letter) starts after the west's outpost quest, `outpost-west` (the west sea merged first), so the outer seas open south, west, then north.
- `rimewick-jam` (Sigrun): deliver lamp oil, find the lead past Lead Rock slowly, land cut stone to relight the cairn.
- `outpost-north` (Sigrun, then Nell): land planks and stone on Snowberry Isle, carry Nell over, and the isle is founded.
- New characters: Sigrun Vale and Nell Marlow, each with a look and a voice.

**Tools:**
- The sea editor and `npm run sea` edit berg fields (count, size, loops, sway, spin), ice and the cold sea.
- Sea marks can be named in `npm run sea`.
- The player's chart and `npm run chart` draw ice islands in snow colours.
- `npm run shots -- --quest` now shows the props, marks and lights that stand after the quests done (`fwt.questAt`), and `--look` frames its point at once.

## Consequences

- The north plays from the ring through the Rime Gate. Balance was checked on all three levels (every check passes): Saltmere to Rimewick takes about 108 s, Watchman Key 149 s.
- The `ice`, `bergs` and `cold-sea` kinds and prop `lamp` are available to every sea. Bergs cost one batched mesh per field, drawn only near the boat.
- The map checks run each site's harbour on the map as it stands once its quests are done. An island ringed by ice passes if it has an opening of 60° or more.
- A thread making the four seas equal quarters may clip the Cold Sea's outline to 45°.
