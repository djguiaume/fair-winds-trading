# Art bible

The one page that keeps Fair Winds Trading Co. looking like one game. Every thread that adds something visible (an island, a prop, a sea, a UI screen, a character) checks it against this page, and the art director thread reviews its screenshots before they go to Guillaume, who gives the final OK on every visual ([decision 0165](../decisions/0165-art-bible-and-the-phase-4-biome-looks.md)).

## 1. The look in one sentence

A bright, low-poly storybook sea: flat-shaded shapes in clear sunny colours, chunky enough to read on a phone, close to the *Privateers: Pirate Wars* ad, with sailing that looks like real sailing.

## 2. What is decided (and where)

| Part | Choice | Decision |
|---|---|---|
| Sea | **A**, clear turquoise: deep `#1d6f7a`, water `#2a8f9a`, light `#3aa7ae`, glowing shallows `#58c2c0`, white foam | [0012](../decisions/0012-boat-and-island-art-style.md) |
| Islands | **B2 bright highlands**: small beaches, stacked sandstone tiers, bright grass caps, red and blue roofs | [0012](../decisions/0012-boat-and-island-art-style.md), [0016](../decisions/0016-game-models-style-d-and-b2.md) |
| Boats | **D storybook classic**: medium proportions, softly bellied sails, one class colour band, light rigging | [0012](../decisions/0012-boat-and-island-art-style.md), [0035](../decisions/0035-three-ship-lines.md) |
| Towns | Grow visibly over four levels, each port its own way | [0060](../decisions/0060-growing-town-visuals.md) |
| Day and night | 12-minute day, golden dusk, **deep blue moonlit night (never black)**, lit windows and lanterns | [0068](../decisions/0068-day-and-night.md), [0121](../decisions/0121-lighthouse-and-beacon-night-lights.md) |
| Characters | **Low-poly portraits B**, SVG from a few values in `characters.json` | [0124](../decisions/0124-characters-look.md) |
| UI | **Instrument style D**: navy and brass, colour icons, chunky buttons | [0049](../decisions/0049-ui-instrument-style.md) |
| Props and buildings | Recipes in `src/data/props/`, colours by name from `src/data/palette.json` | [0135](../decisions/0135-props-as-data.md) |
| Chart | Blank parchment in the fog of war | [0156](../decisions/0156-fog-of-war.md) |
| South sea | `tropic` style: crater-rim Sunreach, tea house, palms, white lagoon beach | [0152](../decisions/0152-south-sea-sunreach-layout.md) |

## 3. Rules every visual follows

1. **Flat shading, vertex colours, one lighting.** Every model is lit by the same sun and sky light and coloured per face. No image textures, no outlines, no post-processing passes. Atmosphere changes only colours and intensities ([0068](../decisions/0068-day-and-night.md)).
2. **Colours have names, and the names live in data.** A recipe, island or sea says `rock2` or `basalt`, never a hex value in TypeScript. New colours go into `src/data/palette.json` (decision [0093](../decisions/0093-data-driven-content-and-authoring-tools.md)).
3. **Storybook, never grim.** Saturation stays up, shadows stay coloured (blue, not grey), darks are warm charcoal, never `#000`. A cold, foggy or volcanic biome is still a sunny game on a good day. Pure white is avoided too (`#f6f9fb` at most): it blooms on tablet screens.
4. **Read at the game camera.** Judge everything from the sailing camera and on a phone, not from the model sheet. Silhouette first, colour second, detail last. Small props are chunky; thin details go away at Low quality.
5. **One signature per port** (agreed with the head storyteller, story looks in [the brief](../story/storyteller-brief.md)). Each main port has one landmark you can name from the sea (Sunreach's green-roofed tea house, Westholm's mill, Stonehaven's light) and one house palette of its own.
6. **Night shows the way.** At night ports glow warm (windows, lanterns), lights sweep, and hazards stay readable under blue moonlight. Anything that glows uses the lit-window material (§6).
7. **Everything is editable.** If a thread adds a look (ground, river, prop, tint), the island builder, sea editor or tuning panel can make and change it, and an agent CLI (`npm run island`, `npm run sea`) can too (Guillaume's rule, 2026-10-24).
8. **Cheap on the 2 GB tablet** ([0006](../decisions/0006-desktop-and-mobile.md), [0115](../decisions/0115-bigger-map-engine-rules.md)–[0117](../decisions/0117-nearby-wind-shelter-and-camera-far.md)): each island stays one batched mesh plus its lit-window mesh; particles are one shared point cloud per kind; a new prop stays near today's tree and house triangle counts (see `models.html`); transparency is avoided (sorting cost) except for existing glows.
9. **Hazards look like hazards, and can be switched off.** Icebergs, ash, fog and storms each have a Settings switch; with it off the biome still looks like itself (the snow, the black sand, the turf stay).

## 4. Shared palette

The B2 base colours (`src/data/palette.json` `colors`) stay the ring's: sand `#f2d9a0`, grass `#7cc04f`, meadow `#8fcc5a`, sandstone `#c2ad8c` / `#d6c4a4`, wood `#9b6b3d`, trunk `#5a3d24`, cream `#f4ede0`, lamp `#ffe3a0`, flag `#c8603e`, sail `#f4ead2`. House palettes are the `styles` (fish, timber, grain, stone, tropic, yard). Phase 4 adds one style per biome (`fire`, `ice`, `fog`) and its grounds (§5).

## 5. Ground materials as data (the shared mechanism)

Built once by the north sea thread, used by all three seas:

- `palette.json` gains **`grounds`**: named ground materials, each with a top colour, a side (cliff) colour, optional face jitter colours, and an optional **glow** colour for cracks or lava (§6).
- **A style picks its grounds** for beach, cliff tiers and cap. An ice island's "grass" cap is snow and its beach shingle without the file saying so, while a ground or ramp in the file can still name a ground explicitly (a moss patch on a lava field).
- The island builder lists the grounds of the island's style; `npm run island -- plateau … --material basalt` takes the same names.

Ground names in use: ring `sand`, `grass`, `rock`; south `coralsand`, `jungle`, `ochre` ([0172](../decisions/0172-south-sea-look-polish-tropic-grounds-jungle-woods-night-lamp.md)); north `snow`, `ice`, `slate`, `shingle`, `moor`; west `basalt`, `lavafield`, `blacksand`, `moss`, `ash`; east `turf`, `darkcliff`, `shingle`, `dune`.

**Snow and ice "texture"** (mandatory, Guillaume) is per-face jitter between a few close colours, with blue shadow on steep faces. Facets stay readable; it is never noise. If that does not read as snow on the screenshots, the fallback is one shared 128 px world-projected detail texture for snow and ice only, decided with Guillaume after a measured test.

## 6. Glow: the lit-window material

House windows already use one unlit material that is dark by day and bright at night (`WINDOWS_BY_DAY` / `WINDOWS_AT_NIGHT`, `glow: true` parts in recipes). Everything that glows in Phase 4 reuses it rather than adding lights:

- lava cracks and lava rivers (dull red by day, glowing at night),
- the volcano's crater,
- warm windows in the snow.

Lava needs a brighter day tint than windows (lava glows by day too), so the material gets a second pair of day/night tints for **ember** faces, as data in `palette.json`. A slow pulse of that tint is allowed (one uniform, no per-vertex work).

## 7. Biome tints

Each sea (or named area) may carry a **look** in its sea file: water, light water, shallows, foam and sky tints, and for the east a fog density, blended over the gateway like wind zones. One mechanism for all seas (built first by the north, extended with fog by the east), editable in the sea editor. The day, golden hour and night cycle still runs on top: a biome shifts the colours, it never replaces the night's deep blue.

## 8. The four seas

### Ring (Windward Ring): the home waters

B2 as shipped: sandstone tiers, bright grass, red and blue roofs, sunny turquoise. The reference every biome is compared with.

### South: tropical (Sunreach, Palm Key) — built

Crater-rim lagoon, white beaches, palms, tea gardens, `tropic` house palette (white and peach walls, thatch and terracotta roofs, one teal roof), paler lagoon water ([0152](../decisions/0152-south-sea-sunreach-layout.md)). Grounds ([0172](../decisions/0172-south-sea-look-polish-tropic-grounds-jungle-woods-night-lamp.md)): `coralsand` beaches, `jungle` caps over warm ochre and red-brown crater cliffs, bare `ochre` summits; `woodland-jungle` woods (palms and low broadleaf); Juno's tea house roof `teaRoof`, a jade that stands out from the jungle.

### West: fire (Emberhold, Cinder Isle) — inspiration Iceland

What Guillaume asked for: **lava rivers, black ground with red fractures glowing a bit red at night, black rocks, black beaches.**

- **Grounds:** `basalt` warm charcoal cliffs (`#3d3839` / `#4b4547`), `lavafield` (basalt with a seeded network of thin crack lines in the glow material), `blacksand` beach (`#2e2b2d`) only on Emberhold's south shore and the volcano island, grey `shingle` elsewhere so the sea never reads as a hole (foam stays white), `moss` caps (`#7fa852`, Iceland's moss on old lava, alive rather than grey) so the islands are not only black, `ash` (`#8a8580`) on the volcano's upper slopes.
- **Glow strength:** cracks and lava at about 45% by day, full at night (`#ff5a1f`).
- **Lava river:** the `lava` kind of the island file's river feature (`rivers: [{points, width, kind: "water" | "lava", from, to, tags}]`, river tool in the island builder and `npm run island`), from the crater down one flank into the sea: bright core, dark crust edge `#5a1e14`, ember material, a white steam puff at the mouth. Wide enough to read on a phone at the sailing camera.
- **Volcano:** dark cone, ash slopes, red crater glow at night, a thin smoke plume. The volcano is **The Smoulder**, always smoking. Eruptions are spectacle only ([0147](../decisions/0147-phase-4-story.md) brief); **Cinder Isle** is new, dark, steaming ground that appears after Bram's arc (`after:` tags).
- **Props:** hexagonal basalt columns and sea stacks at the shore (Reynisfjara, Reynisdrangar), steaming vents, sulphur patches (`#d8c040`), black sea rocks, turf houses with grass roofs, Bram's glassworks with a glowing furnace and mirror racks catching the sun.
- **Houses (`fire` style):** tarred black timber and white walls, red and green roofs, turf roofs on the old houses. **Emberhold's signature is Bram's glassworks** with its furnace chimney, cold before his arc and glowing after (storyteller, 2026-10-24). No church.
- **Water:** a touch darker and greener near the volcano, warm current shimmer.

### North: ice (Rimewick, Snowberry Isle) — inspiration Greenland, Svalbard, Antarctica

What Guillaume asked for: **snow and ice textures (mandatory), snowmen, snow-covered trees.**

- **Grounds:** `snow` (faces jittered between `#eef4f8`, `#e3ecf3`, `#f6f9fb`, blue shadow `#c5d6e6`), `ice` glacier cliffs (`#a8dde8` with deeper bands `#6cbcd2`, never neon), `slate` Svalbard rock (`#5b6068` / `#6e747c`) with snow in the gullies, `shingle` grey beaches (`#a9aaa6`), `moor` olive-russet (`#8a8a4a` / `#9a6a3a`) for Snowberry's cloudberry moor.
- **Props:** `snow-pine` (fir with white tiers), `snowman`, icebergs in several sizes (tabular Antarctic and pointed Greenland), ice floe sheets for the pack ice (gone with `after:` tags), cloudberry racks; berries red-orange (`#e0602a`) with a few ripe amber ones (`#f0a030`) so the moor reads red from the sea. **Story objects:** the Snowberry Pack locks Snowberry Isle's cove and goes after `rimewick-jam`; the Lead Rock beacon is a stone cairn with an iron lamp cage, tumbled before and lit after; Snowberry Isle has snowy hills, a small green moor by a steaming warm spring and the old shuttered weather station, and after founding a glasshouse, a flagpole and a name board. No igloos, no hunting (Seal Rocks are wildlife only).
- **Houses (`ice` style):** Greenland-bright walls (oxblood `#a8403a`, mustard `#d9a83a`, slate blue `#3f6a9a`, moss green `#4f7f5a`), white trim, near-black roofs (`#33373d`) with snow on them. **Rimewick's signature** is these bright fjord houses; its story landmark is Sigrun's jam house, a boiling house with copper pots that steams once her arc is done. The weather station belongs to Snowberry Isle, not Rimewick.
- **Water:** colder and bluer; icebergs get the shallows tint around them instead of a transparent skirt.

### East: fog and storm coast (Fogwatch, Amber Strand) — inspiration Faroe Islands, Scotland

- **Grounds:** `turf` muted living green (`#6f9a4a` / `#5e8a44`), `darkcliff` basalt (`#4f535a` / `#61666d`) as stacked horizontal bands with thin green ledges (the layered Faroese cliff), `shingle` grey-black beaches, `dune` pale sand (`#e6d6a8`) with marram (`#c8bf86`) at Amber Strand, amber pieces `#e89a2a` catching the low sun.
- **Almost treeless.** Height comes from cliffs and sea stacks, not woods.
- **Fogwatch's signature:** the two sea stacks and the foghorn tower; Elias's amber carver's workshop on the quay comes later. Amber is honey-gold beads and lumps on Amber Strand's pale beach.
- **Props:** two tall sea stacks, a waterfall off a cliff into the sea (the `water` kind of the river feature), stone cairns, slatted drying sheds, boathouses, a foghorn tower, sheep.
- **Houses (`fog` style):** black tar (`#2f3035`) and whitewash (`#eeeae2`), turf roofs, red frames (`#b8433a`); a white church with a black roof as an ordinary building.
- **Fog:** greyer sky and water only inside fog banks (biome tint with fog density), so the coast is moody without the whole sea going grey. **The Stormbreak** storm belt: slate-blue choppy water (about `#2b5266` / `#3e6a7c`) with whitecap streaks and a sharp broken-foam edge you can steer along; squalls are darker shadow discs with a few thin grey-blue rain curtains (`#8fa0aa`, alpha about 0.25, dropped at Low quality); on the chart a dark slate band with amber (`#ffb36b`) chevrons. Amber means storm warning, red is kept for pirates. Builds on the storm look of [0067](../decisions/0067-weather-states-and-storms.md).

## 9. Architecture and landmarks by sea

Guillaume asked what each sea's buildings and landmarks should be (2026-10-24). The port's signature (§3.5) is set with the head storyteller; the rest are ordinary buildings and props the sea threads pick from, within their triangle budget.

| Sea | Everyday buildings | Landmarks and props |
|---|---|---|
| **West (Iceland)** | Turf houses with grass roofs and white or red wooden gable fronts (Glaumbær) for the old quarter; corrugated-iron houses painted bright with red, green or blue roofs (Reykjavik) for the working town; a small black wooden church with white trim (Búðir) | **Bram's glassworks** (signature, furnace glows after his arc); an orange square lighthouse; fish-drying racks; a round stone sheep fold; a steaming hot-spring pool; geothermal greenhouses glowing at night; basalt-column cliffs, a sea arch (Dyrhólaey), sea stacks, a geyser that puffs now and then |
| **North (Greenland)** | Bright painted wooden houses (oxblood, mustard, slate blue, moss green) with white trim and snowy near-black roofs; a **red wooden church** with white trim, a steep snowy roof and a small bell tower (Ilulissat, Nuuk), not a dark Norwegian stave church, which would clash with the bright houses | **Bright fjord houses** (signature) and **Sigrun's jam house** (copper pots, steams after her arc); Lead Rock cairn beacon; snowmen, snow-pines, icebergs, pack ice; Snowberry Isle's weather station and glasshouse |
| **East (Faroe, Scotland)** | Black tarred wooden houses and whitewashed stone houses with turf roofs and red window frames; turf-roofed boathouses at the shore; slatted drying sheds; a small white church with a black roof (Saksun); dry-stone walls | **Two sea stacks and the foghorn tower** (signature), Elias's amber carver's workshop later; a church ruin on the shore (Kirkjubøur, the existing `ruins` prop recoloured); a round stone broch tower and a ring of standing stones on a headland (Scotland); a white lighthouse with an ochre lantern gallery (the Stevenson lights); a waterfall off a cliff; sheep |
| **South (tropical)** | `beach-house` homes in the `tropic` palette | Juno's green-roofed tea house (signature), tea-garden terraces, palms, lighthouses on the arm tips |

## 10. How a visual gets approved

1. The thread follows this page and asks the art director thread when something is not covered.
2. It takes real-game screenshots with `npm run shots` (desktop, landscape and portrait; day and `--night`; hazards on and off) and a labelled chart with `npm run chart` for any map change.
3. The art director reviews them for cohesion and sends notes back.
4. Guillaume sees every screenshot, the chart and any schema before anything is merged.
5. Where look and story meet (a port's signature, a character's look, something that appears after a quest), the art director agrees it with the head storyteller first.
