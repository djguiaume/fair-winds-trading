# Storyteller brief: how the community arcs are written and built

**Status:** written by the head storyteller after Guillaume's answers (2026-10-23). It is binding for the four arc threads. The [Phase 4 section](#phase-4-the-four-seas) (2026-10-24, [0147](../decisions/0147-phase-4-story.md)) is binding for the Phase 4 arc threads. **Recorded in:** [0129](../decisions/0129-storyteller-brief.md). **Builds on:** the approved story ([community arcs](community-arcs.md), [0122](../decisions/0122-community-arcs-story.md)), the quest engine ([0125](../decisions/0125-quest-engine.md), how-to in [content README › Quests](../content/README.md#quests-0125)), the home island ([0126](../decisions/0126-home-island-build-spots.md)) and the prologue ([0127](../decisions/0127-prologue-rescue-tutorial.md)).

**Who decides.** The head storyteller thread decides anything about the story: tone, people, lines, step design, and how the arcs fit together. Arc threads ask the storyteller, not Guillaume (his rule, 2026-10-23). When something here doesn't fit what the engine or the map can do, ask the storyteller before you change the story to fit.

## Guillaume's answers (2026-10-23)

| Question | Answer |
|---|---|
| Are the names final? | **Yes.** Rook, Kit Marlow, Ines Calder, Maren Holt, Ada Flint, Old Ness, the Teeth and Teeth Rock, Greyback Ridge. |
| Kit: man or woman? | **A man** ("pêcheur" in French). The cast is three men and three women. |
| An ending? | **Yes:** a short epilogue at Skerry once all four arcs are done (see [The epilogue](#the-epilogue-fair-winds)). |
| Voices? | **Babble** ("hum hum" talk with an accent), either generated or from sound files, like the music and the other sounds. It must be data. See [Voices](#voices-babble-generated-or-from-files). |
| The written voice, and Rook naming the four people at the end of the prologue? | **Yes** to both (Guillaume, 21:54). |
| How to keep it data driven? | Left to the storyteller: see [Everything is data](#everything-is-data). |

## The voice

**Warm and plain, with a little humour.** It's a cozy game for people who like sailing. The winter is the only thing working against you: no villains, no deaths, no danger to people, no sad endings. Kids can read every line.

### Rules for every card

1. **2 to 4 short lines**, at most about 220 characters in English. The French may run up to about 20 % longer.
2. **The title is the ask**, written as an imperative of at most 5 words, with the place in it when there is one: "Bring stone to Port Calda", "Find the diving gulls". It is also the line in the journal. A timed run's title may run longer if it follows the pattern "Rush … to <place> in {par}" (French: « Portez … à <place> en {par} »).
3. **The copy is the person talking**, in the first person, with no quotation marks (the card shows who is speaking). Stage directions don't go in the copy.
4. **Everyone calls the player "captain"**, lower case in a sentence. In French it's "capitaine" with **vous**, and nobody says *tu*. The player has no name and no gender, so French copy addressed to the player must not agree a word with the player's gender (write "Merci, capitaine", not "vous êtes prêt").
5. **No deadlines or threats that the game doesn't keep.** Nothing can fail, so nobody says "the fair is in a week" or "before dark". A timed run is about freshness or pride ("while the fish are still jumping"), and its par is in the title, not in the copy.
6. **Numbers:** digits in titles, words in the copy ("eight timber").
7. **Use the game's own words** for places, goods and ships: Port Calda, Stonehaven, timber, stone, cutter, hauler. Numbers in the copy (crates, knots) must match the quest file.
8. **Sailing talk is welcome, because the audience likes sailing.** "Come in slow, under two knots", "you'll need a tack or two". Don't explain the interface in dialogue: the coach marks and the title do that.
9. **Hazards stay optional.** No line needs night or a storm to be switched on. Say "when the light's lit", not "tonight".
10. **One mention across.** Each arc mentions at least one other person by name, once, so the islands feel like neighbours. Already in the story: Ada's millstones (Westholm), Rook at the launch (Calda), Old Ness and his lens (Stonehaven). Kit mentions Rook, who went looking for the shoals on the East Reef and ended up on it (that's the prologue's wreck).
11. **Moods:** `worried` on the hook (the first step), `neutral` on the middle steps, and `pleased` on the done card.
12. **The done card thanks, then names the plot and the two buildings with placeholders, and sends the captain to Skerry to choose** (`{spotA}`, `{spotB}`: the building names with their article). The giver then speaks once more by the stake at Skerry (`<text>.plot.copy`), decision [0210](../decisions/0210-skerrys-build-choice-staked-plots-and-the-island-tab.md).

### Each person's way of speaking

Accents come from word choice and from the babble (below), **never from misspelled dialect**, which is hard to read, hard to translate and can come across as mockery.

| Person | Habit | English sample | French sample |
|---|---|---|---|
| **Rook** (Saltmere, harbourmaster) | brisk and orderly; talks like his ledger | "Entered in the book, captain. In good order." | « C’est noté au registre, capitaine. En bonne et due forme. » |
| **Kit Marlow** (Saltmere, fisher) | restless, short sentences, gently teasing | "Gulls don't lie. Where they dive, fish swim. Go on." | « Les mouettes ne mentent pas. Là où elles plongent, il y a du poisson. Allez. » |
| **Ines Calder** (Port Calda, shipwright) | old boatyard sayings; patient | "Measure twice, cut once. And mind the keel." | « Deux fois mesurer, une fois couper. Et gare à la quille. » |
| **Maren Holt** (Westholm, miller and baker) | cheerful and in a hurry; strings things together with "and" | "Flour on my hands and no flour in the sacks, can you believe it?" | « De la farine plein les mains et pas un sac de plein, vous imaginez ? » |
| **Ada Flint** (Stonehaven, mason) | blunt, few words, stone images | "It'll stand. Stone doesn't argue." | « Ça tiendra. La pierre ne discute pas. » |
| **Old Ness** (Watchman Key, keeper) | rambles, wanders off the point, then comes back to it | "Did I tell you about the winter of… never mind. The lens. Yes." | « Je vous ai raconté l’hiver de… peu importe. La lentille. Oui. » |

## Voices: babble, generated or from files

When a card opens, the person "speaks" a short burble of made-up syllables (about one per word of the title, capped at about 1.5 s). There are no recorded lines, so nothing needs recording again when a line changes, and it sounds the same in both languages.

**Where it lives (storyteller's decision): voices are sounds, so they go in `src/data/audio.json`**, next to the music and the effects, in a new `voices` section. The person's entry in `characters.json` only names their voice. That keeps one place for every sound and one rule for generated against recorded, the same as the effects ([content README › Music and sounds](../content/README.md#music-and-sounds-0113)):

```json
// characters.json, in the person's entry
"voice": "rook"

// audio.json
"voices": {
  "rook":  { "synth": "babble", "pitch": 0.8, "speed": 1.1, "wobble": 0.1, "volume": 1 },
  "maren": { "synth": "babble", "pitch": 1.4, "speed": 1.4, "wobble": 0.2 },
  "ness":  { "files": ["audio/voices/ness-1.ogg", "audio/voices/ness-2.ogg"], "volume": 0.9 }
}
```

- **Generated:** `synth: "babble"` with `pitch`, `speed` and `wobble` (and an optional `vowels` string for a port's accent). **From files:** `file` (one clip) or `files` (a few short clips, picked at random and cut to length), in `public/audio/voices/`, MP3 or OGG, kept small.
- **Mood:** an optional `moods` block (`{ "pleased": { "pitch": 1.1 } }`) changes the numbers or the files for that mood.
- **The accent of a port** is a shared starting point: the people of one port get similar `vowels` and rhythm. Rook and Kit sound like Saltmere.
- **Settings › Sound** gets a **Voices** switch and volume, which are on by default. The `?tune` panel can preview each voice.
- The checks refuse a `voice` that `audio.json` lacks, and a missing file.

The Westholm thread builds this once (see [Who builds the shared pieces](#who-builds-the-shared-pieces)). Other arcs only add their person's entry. The six existing people get generated voices first; files can replace any of them later without touching code.

## Everything is data

Guillaume's rule (0093): the four arcs are **only data**, plus generic engine pieces that any later arc can reuse.

| What | Where |
|---|---|
| The arc: steps, goals, items, gold, home spot, mood, speaker | `src/data/quests/<id>.json` |
| What people say: titles, copy, the arc's name, choices | `src/i18n/en.json` and `fr.json` (`quest.<id>.*`) |
| Who they are: name, role, port, portrait, voice | `src/data/characters.json` (role text in i18n: `character.<id>.role`) |
| How they sound | `src/data/audio.json` › `voices` (and files in `public/audio/voices/`) |
| Markers, gates, landing spots | the quest file (map coordinates, 0125) |
| What changes in a port: new props, chart marks | island files: props tagged `after:<quest>` / `before:<quest>` |
| What changes in a port's trade (made from level 2, for example) | the map file's port entry, keyed by quest (shape set by the Saltmere thread's after-a-quest hook) |
| New places (Teeth Rock, the East Reef gap) | the map file and island files, made with the editor where it can |
| Buildings and their effects | `src/data/buildings.json` |

**No arc-specific TypeScript.** Code never names a quest, step, person or place (`if (quest === 'saltmere-shoals')` is not allowed). When an arc needs something new, it becomes a generic condition, reward, prop tag or field, gets its check in `checkQuests` / the map checks, and goes in the content README. Tests are the only code that names the arcs.

## Shared conventions

### Quest ids, files and text keys

| Arc | Quest id (file `src/data/quests/<id>.json`) | Giver | Text prefix | Home spot it offers |
|---|---|---|---|---|
| Saltmere, fish | `saltmere-shoals` | `kit` | `quest.saltmere-shoals` | `spot-3` (watch: Lookout or Pilot house) |
| Port Calda, timber | `calda-slipway` | `ines` | `quest.calda-slipway` | `spot-1` (crafts: Workshop or Rigging loft) |
| Westholm, grain | `westholm-mill` | `maren` | `quest.westholm-mill` | `spot-2` (stores: Warehouse or Bakehouse) |
| Stonehaven, stone | `stonehaven-light` | `ada` | `quest.stonehaven-light` | `spot-4` (waterside: Weather glass or Boathouse) |
| Epilogue | `fair-winds` | `rook` | `quest.fair-winds` | none |

- **Start and offer:** each arc has `"start": { "is": "quest-done", "quest": "rooks-thanks" }` and `"offer": true`, with `port` set to the giver's port. All four open together and can be done in any order.
- **Step ids** are short nouns in the order of the story (below). Never rename one once it is merged, because old saves would start the arc again.
- **Text keys:** `quest.<id>.name` (the arc's name, below), `quest.<id>.<step>.title` / `.copy`, and `quest.<id>.done.title` / `.copy`. They go in **both** `src/i18n/en.json` and `fr.json`, in the same PR. Put each arc's keys together as one block just after the `quest.rooks-thanks.*` keys. When two arc PRs touch the same spot, keep both blocks, in the order of the table above.
- **Quest cargo items** are named for the thing itself (`catch`, `mast-tree`, `rook`, `millstone`, `stone-blocks`, `lens`). The space per piece is listed below, from the hold sizes: sloop 10, cutter 16, hoy 25.
- **Rewards:** gold on every step, about **100 / 150 / 250** (about 500 per arc, so a passed-over building at 1,500 × 1.5 still costs about 4 arcs' gold). The quest's own `reward` pays `homeSpot` plus the port change. Gold lives in the quest file; it is content (0093).
- **`clean`** goes on any step whose sailing is about not touching a reef or a shore.
- **Ships:** every step can be done in the sloop. A "suits haulers" step means a hauler saves trips, not that a sloop can't do it.
- **No flag.** Each arc ships live once its PR is merged and complete; arcs are independent of each other. The `?home` flag keeps working for testing the island.

### The four arcs: fixed details

Steps and situations are as in the [approved story](community-arcs.md). What's added or settled here:

**`saltmere-shoals`, "Where the shoals went" (Kit).** The reef is the **East Reef**, the prologue's reef: Rook went out looking for the shoals and ran aground there, which Kit teases him about once. Steps: `gulls` (reach 3 points along the outer edge in any order, `clean`), `channel` (3 gates in order through a **new gap at the reef's north-west end**, `clean`; the prologue wreck stays where it is), `catch` (item `catch`, 6 pieces × space 1, timed from Saltmere to Port Calda). Port change: fishing boats by the reef, buoys on the gap drawn on the chart, smoked fish from level 2.

**`calda-slipway`, "The last keel" (Ines).** Steps: `stone` (deliver 8 stone to Port Calda), `mast` (item `mast-tree`, 1 piece × space 8, loaded at a landing spot on **Greyback Ridge's** shore, under 2 kn, `clean`), `launch` (item `rook`, space 0, timed from Saltmere to Port Calda). Rook rides as the passenger on `launch` and has no card of his own (storyteller, 2026-10-23): Ines's launch card stays at Calda, where the player is. Port change: rebuilt slipway with a hull on it, the pilot cutter at the pier, planks from level 2.

**`westholm-mill`, "The mill on the hill" (Maren).** Steps: `sails` (deliver 8 timber to Westholm), `millstones` (item `millstone`, 2 pieces × space 6, from Stonehaven to Westholm: a sloop makes two trips, a cutter or hauler one), `bread` (item `bread-batch`, 4 × space 1, timed from Westholm to Saltmere). The millstones are "cut by Ada". Maren's card says so, and Ada doesn't need to speak. Port change: the mill gets its sails back (bare frames before, `before:westholm-mill`; full sails after, standing still like every windmill: no line promises that it turns), and the harvest fair is `levelUp: ["westholm"]` (the fair happens on the done card; it is never a deadline).

**`stonehaven-light`, "A light on the Teeth" (Ada).** Steps: `scaffold` (deliver 6 timber to Stonehaven), `stone` (item `stone-blocks`, 3 × space 5, to the landing on **Teeth Rock**, under 2 kn, `clean`: a sloop makes two trips, a cutter one), `lens` (discover Watchman Key from a chart circle, take the item `lens`, 1 × space 1, from Watchman Key to Teeth Rock). Old Ness speaks the Watchman Key card (`speaker: "ness"`). The light comes on as you leave Teeth Rock, with the Saltmere sweep (0121). Port change: the lighthouse on Teeth Rock (island file and light), the reef drawn with a light on the chart, and the mason's crane on Stonehaven's quay.

### Places at sea

The engine's markers are map coordinates in the quest file (0125). Landing spots and gates are chosen by the thread that owns them, written in the quest file, and named in that thread's ADR. Moving an island later means moving its markers.

**The ring's names and what each port shows** (head storyteller, 2026-10-25, built in [0216](../decisions/0216-windward-ring-catch-up-pass.md)):

- Reefs: only two have names in the story, the **East Reef** (by Saltmere, with Kit's gap) and **the Teeth** (off Teeth Rock). The storyteller named the rest: **The Combs** (the narrows reef near Gull Hook), **Mackerel Ledge** (south of Gull Hook), **The Friars** (by Abbey Head). "Gull" is never a leading word again (taken). French keeps the English name with an article: « les Combs », « le Mackerel Ledge », « les Friars ». **Bell Rock** keeps its name.
- Signatures: Saltmere's smokehouse row and net-drying green, with Rook's harbour office facing the quay (Fogwatch asks for "smoked fish from Saltmere"); Port Calda's slipway with a hull on it.
- Before and after: Saltmere's story is empty nets, not damage: before `saltmere-shoals` boats pulled up on the shore, empty drying racks, cold smokehouse chimneys; after it full racks, smoke, boats out and buoys on the East Reef gap. Stonehaven before `stonehaven-light`: an idle quarry, uncut blocks stacked on the quay, Teeth Rock bare and one old, empty hull on the Teeth (wrecks are always old and empty, never people); after it the tower and light on Teeth Rock, the hull gone. Watchman Key and Abbey Head show nothing before or after.
- Greyback Ridge keeps its tall pines in sight: the mast in `calda-slipway` comes from there.

## Who builds the shared pieces

Each shared piece has **one owner thread**, so the four arcs don't build it four times. The others write their quest file, text and tests in parallel and rebase onto the owner's merged PR. Until then a test may skip the part that needs it.

| Shared piece | What | Owner | Used by |
|---|---|---|---|
| **After-a-quest hook** | Props tagged `after:<quest>` show once that quest is done, and props tagged `before:<quest>` go. A port may change what it makes after a quest (for example, `levelProduces` earlier). Chart marks follow the same tags. | **Saltmere** | all four, epilogue |
| **Cargo at a spot** | `carried` with `from` / `to` as a point at sea (`{ x, y, within, maxKn, holdSec }`) instead of a port: load or unload by holding slowly at a landing spot. | **Calda** | Calda (mast), Stonehaven (stone, lens) |
| **A step's speaker** | A step's `speaker` (a character id) shows that person on the card instead of the giver. | **Stonehaven** | Stonehaven (Ness), Calda (Rook), optional |
| **Teeth Rock** | A new small rock island file at the west end of `sw-reef`, with its landing spot and the lighthouse props (`after:stonehaven-light`). | **Stonehaven** | Stonehaven |
| **East Reef gap** | Split the East Reef's outline to open a channel at the north-west end, keeping the prologue wreck and its test where they are. | **Saltmere** | Saltmere |
| **`{par}` in titles** | A timed step's title may hold `{par}`, shown as a readable time for the difficulty ("2:20"), on the card and in the journal. | **Westholm** | every timed run |
| **Babble voices** | `voices` in `audio.json` (generated or files), `voice` in `characters.json`, the Settings switch, and the checks. | **Westholm** | every card |
| **Rook names the four** | One line at the end of the prologue (`lesson.island.copy`, `quest.rooks-thanks.done.copy`) naming Kit, Ines, Maren and Ada. **Done in this brief's PR.** | storyteller | prologue |
| **The epilogue** | `fair-winds`, after the four arcs are merged. | storyteller | |

## The epilogue: "Fair winds"

`fair-winds` starts when all four arcs are done. Its one step is docking at home (Skerry). The card is Rook's (`pleased`). He came over with Kit, Ines, Maren and Ada, and they hoist a company flag. Skerry gets a flag and a name board on the pier (`after:fair-winds` props). The reward is a little gold, then the sandbox carries on. The storyteller writes and builds it once the four arcs are merged.

## How an arc thread works

1. Read this brief, the approved story, and the content README › Quests.
2. Use graphify (`/opt/node22/bin/graphify`) to find your way around the code, as in every thread.
3. Check `origin/main` (and the open branches) for the next free ADR number before you write yours. Arc ADRs explain the engine or map changes and the places chosen. The story itself is already decided here.
4. Write the quest file, the text in both languages, the port change, and a test that plays the arc through on the engine (`tests/arcs/<id>.test.ts`) and passes `checkQuests`.
5. Post static screenshots of every card (desktop, phone landscape and portrait), since Guillaume prefers images to demos.
6. Send the storyteller your card text before you merge, and the storyteller answers in your thread. If anything here clashes with the engine or the map, ask the storyteller; don't pick on your own.

## Phase 4: the four seas

**Status:** written by the head storyteller (2026-10-24), recorded in [0147](../decisions/0147-phase-4-story.md). It builds on the biomes ([0137](../decisions/0137-phase-4-biomes-and-founded-outposts.md)), the far goods ([0146](../decisions/0146-far-goods-from-the-biome-outposts.md)) and the epilogue ([0134](../decisions/0134-fair-winds-epilogue.md)). Everything above still applies: the voice, the card rules, the moods, babble voices, everything as data, one owner per shared piece, and how an arc thread works. Phase 4 arc threads ask the storyteller, not Guillaume.

### The story in one paragraph

The ring is busy now, and the company has a name. Letters start to arrive from people who went beyond the reef long ago: a great-nephew, a brother, a sister, a cousin. Each sea has an old port that knows a craft but has nobody left to gather what the craft needs. The captain carries home goods out, helps the port's keeper, then brings the relative from the ring to found an outpost on an empty island. The outpost gathers, the port crafts, and the ring buys. Nothing is lost or in danger: the hard seas (ice, ash, fog) are the only thing working against you, and each hazard has its own Settings switch, so no line may need one.

### The pattern for every sea

Every sea is the same three arcs, in this order. The seas open early and run side by side (Guillaume, 2026-10-25, [0194](../decisions/0194-open-the-edge-seas-after-each-ring-arc.md)). The south is the first door: Old Ness's chart (`watchman-passage`, once Ada has brought his lens) shows the captain the way beyond the reef. After that, each other letter arrives once its writer's own ring arc is done, because word has spread that a captain sails beyond the reef. Sailing out is never blocked. Far main ports trade as soon as they are sighted, and only their arcs wait for the letter:

1. **The letter (or chart)**, one step, given at a ring port by a person the player knows. A relative has written from beyond the reef. Goal: sail through the sea's gateway and reach its main port (discover it). This lifts the sea's chart (0137 point 1).
2. **The keeper's arc**, three steps at the main port, given by its **keeper of the craft**. It tells why the workshop stands idle: the keeper still has the craft, but nobody gathers any more. The steps help the port itself (bring home goods, one sailing step that shows off the sea, one delivery that brings the port back to life). The port's look changes after it (`after:` props). The done card says the gathering ground is empty and points to the relative.
3. **The outpost**, given by the keeper, with the relative speaking on the steps (`speaker`). Bring founding goods from the ring, then carry the relative (item, space 0) from where they live to the empty island. Tam Ness lives at Watchman Key with his great-uncle. The other three relatives went beyond the reef long ago and live at their sea's main port, which is why the letters come from them. It ends with the epilogue's **flagpole and name board** on the outpost (`after:outpost-<biome>`), and the outpost starts gathering. The relative's done card says, in plain words, where the raw goods go: "Bring what we gather to <keeper> at <port>, and the workshop will do the rest." That is the story's explanation of "no raw goods, no craft" (0146 point 4). The relative speaks that done card through the quest field `doneSpeaker` (0158), and the card shows at the keeper's port. The south's `outpost-south` is the worked example: land founding goods at the island's landing spot (`landed`), then carry the relative, reward `found`.

Rewards grow with the seas, but the amounts are content for the balance pass (0146), written in the quest files.

### Places and people

Map names stay in English in French too (as for Teeth Rock). A map or balance thread may change a place name only with the storyteller's OK. The cast stays balanced: two women and two men among the keepers, and the same among the relatives.

| Order | Sea | Main port | Keeper of the craft (port's voice) | Opened by | Relative who founds the outpost | Outpost island |
|---|---|---|---|---|---|---|
| 1st | South, tropical | **Sunreach** | **Juno Reyes**, tea blender (woman) | **Old Ness**, with his old chart: the planned Watchman Key arc "The keeper's passage" | **Tam Ness**, Ness's great-nephew (man) | **Palm Key** |
| 2nd | West, fire | **Emberhold** | **Bram Kettle**, glassworker and mirror maker (man) | **Ines Calder** (Port Calda): a letter from her brother | **Oskar Calder** (man) | **Cinder Isle** |
| 3rd | North, ice | **Rimewick** | **Sigrun Vale**, jam maker (woman) | **Kit Marlow** (Saltmere): a letter from his sister | **Nell Marlow** (woman) | **Snowberry Isle** |
| 4th | East, fog and storm | **Fogwatch** | **Elias Morrow**, amber carver (man) | **Maren Holt** (Westholm): a letter from her cousin | **Pip Holt** (woman) | **Amber Strand** |

How they speak (same rules as the ring: word choice, never dialect spelling):

| Person | Habit | English sample | French sample |
|---|---|---|---|
| **Juno Reyes** | unhurried; everything is a recipe | "A pinch of patience, captain, and let it steep." | « Une pincée de patience, capitaine, et on laisse infuser. » |
| **Bram Kettle** | proud of his work, talks about light and fire | "Good glass shows you the truth. Even before breakfast." | « Un bon miroir dit la vérité. Même avant le petit-déjeuner. » |
| **Sigrun Vale** | dry humour, counts everything in winters | "Three winters I've waited for berries. One more won't hurt." | « Trois hivers que j’attends des baies. Un de plus, ça ne fera pas de mal. » |
| **Elias Morrow** | quiet, speaks softly, notices small things | "Listen. The fog has a sound, if you wait." | « Écoutez. Le brouillard a un bruit, si on attend. » |
| **Tam Ness** | eager, a little clumsy, quotes his great-uncle | "Uncle Ness says… well, he says a lot. But he's right!" | « L’oncle Ness dit… enfin, il dit beaucoup de choses. Mais il a raison ! » |
| **Oskar Calder** | like his sister, a boatyard saying for everything | "Fair wind, firm keel, full hold. That's the order." | « Bon vent, quille solide, cale pleine. Dans cet ordre. » |
| **Nell Marlow** | like her brother, short and teasing | "Kit wrote, did he? First letter in six years." | « Kit vous a écrit ? Première lettre en six ans. » |
| **Pip Holt** | like her cousin, cheerful, strings things with "and" | "Amber on the beach and nobody to pick it up, can you believe it?" | « De l’ambre sur la plage et personne pour le ramasser, vous imaginez ? » |

### Each sea's hazards and set pieces (Guillaume, 2026-10-24)

The layout stays as it is: tropical south, fire west, ice north, fog and storms east (Guillaume: "keep it as is"). Every hazard has its own Settings switch, and no story line may need one switched on.

- **North, ice:** drifting icebergs and cold gales.
- **West, fire:** ash clouds that cut visibility, warm currents, and **eruptions as a spectacle**: a smoking peak that sometimes erupts, ash falling, and floating pumice that slows the boat. Nothing hits the ship. If rock projections are ever added, they are gentle (a scratch, like reef damage) and have their own switch.
- **The west's outpost island is born in an eruption.** Bram Kettle's arc at Emberhold ends with an eruption the captain watches from a safe distance. The next time she sails by, a new island steams where the sea was: **Cinder Isle**. Oskar Calder founds the outpost on it (`outpost-west`), so the obsidian is fresh from the fire.
- **The north's outpost lies behind pack ice.** Snowberry Isle sits in a cove locked by pack ice: snow on its hills, but a warm spring keeps a green, sheltered moor by the shore, red with cloudberries (a real far-north plant of moors and bogs), and no ship gets in. Nell Marlow knows where the ice is thinnest. Sigrun Vale's arc at Rimewick ends by rebuilding the old beacon that marks that lead. After it, the ice breaks up and the lead stays open for good. Inside stands an **old weather station**, empty since the ice closed the cove; Nell founds the outpost by rebuilding it, with a glasshouse warmed by the spring (`outpost-north`), and the berry pickers come back with her. The station suits the sailing audience: it can later give the north a small weather perk, like Skerry's weather glass. No whaling or sealing station, old or new: no animals are hunted in this game.
- **Engine, for those two:** an island entry may carry `"after": "<quest>"`, and a terrain entry (the north's pack ice, which may be drawn as an ice island or an ice field) `"before": "<quest>"`, like props and sea marks (0130). The island's land, collision and chart label stay hidden until that quest is done; the ice goes once it is done. Two rules: a change happens only when the boat is far away or docked, never under her, and the map's deep-route check (0152 point 6) must pass with the island there. New visuals (the eruption, steam, the island rising) go to Guillaume as screenshots before merging.

### The west sea, step by step (head storyteller, 2026-10-24)

Written for the thread that lays out Emberhold's sea. That thread writes the three arcs too, so that Cinder Isle's `after:emberhold-glass` tag points at a real quest: no stub quests. Until the quests are written, Cinder Isle's island file waits outside the sea file. Gold amounts are first guesses, for `npm run balance` to settle.

**Place names** (English in French too): the volcano island **The Smoulder** (not a real volcano's name like Hekla); **Ashfall Reach**, the ash zone downwind of it; **Black Strand**, Emberhold's black beach; **The Organ Pipes**, the basalt sea stacks; **Warm Run**, the warm current; **Pumice Bank**, the floating pumice field; and the gateway **The Forge Gap**, through a basalt reef.

**Emberhold** is a normal, working port (levels 1 to 3, like Sunreach) with Bram's glassworks on the quay as its signature: a furnace chimney, cold before his arc and glowing `after:emberhold-glass`. What it makes and buys follows the far goods data (0146, 0150), not the story. Obsidian mirrors come only once Cinder Isle gathers obsidian.

**Eruptions.** The Smoulder smokes all the time, and with the switch on it erupts every few minutes while the boat is near. With the switch off it only smokes. The one story eruption, at the end of Bram's arc, plays whatever the switch says. It is a spectacle only, with no ash or pumice for the boat, and nothing in the copy needs the captain to have watched it. Cinder Isle appears afterwards, only while the boat is far away or docked.

| Quest | Step | Goal | Card |
|---|---|---|---|
| `calda-letter` (Ines, Port Calda) | `chart` | dock at Emberhold, charting the Forge Gap and Emberhold's waters | Ines has a letter from her brother Oskar and mentions her slipway once. The done card points to Bram's glassworks. |
| `emberhold-glass` (Bram) | `kiln` (worried) | deliver 8 cut stone to Emberhold | Reline the cold furnace. Good glass needs a good fire. |
| | `smoulder` | reach 3 points round The Smoulder, in any order, `clean` | Go and look: the old obsidian beds lie under fresh rock. |
| | `furnace` | deliver 12 timber to Emberhold | Fire the furnace again. |
| | done | Cinder Isle `after:emberhold-glass` | The furnace glows, and the Smoulder rumbles. "When it settles, there'll be new ground out there." Names Oskar Calder, who has waited for ground of his own. |
| `outpost-west` (Bram, speaker and `doneSpeaker` Oskar) | `supplies` (worried) | land 10 planks and 6 timber on Cinder Isle | Bram: the ground's still warm, so build on stone feet. |
| | `settler` | carry `oskar` (space 0) from Emberhold to Cinder Isle | Oskar, a boatyard saying for everything, mentions Ines once. |
| | done | `found: ["cinder-isle"]` | Oskar: "Bring what we gather to Bram at Emberhold, captain, and the glassworks will do the rest. Rook will want that in the book." |

Cut stone (Stonehaven) is a made good, so the delivery passes the `wantsMade` rule. Emberhold must buy cut stone and timber for the two deliveries. Ash and pumice stay optional: with them off, every step is the same sail.

### The north sea, step by step (head storyteller, 2026-10-24)

Written for the "Build the north ice sea" thread, which lays out the sea and writes its three arcs. Gold amounts are first guesses, for `npm run balance` to settle.

**Place names** (English in French too): the gateway **The Rime Gate**, through **The Floe Line** (grounded bergs and skerries); **Rimewick Fjord**, where Rimewick sits; **Whitefell**, the glacier island that calves the drifting bergs, and **The Calving Grounds** below it; **The Whistle**, the cold-gale wind zone; **Snowberry Pack**, the pack ice locking the cove; **Nell's Lead**, the thin-ice lane the locals named after her; **Lead Rock**, where the beacon stands; landmarks **Cairn Holm** (a stone cairn; not "Cairn Skerry", because Skerry is the home island) and **Seal Rocks** (seals basking; wildlife only).

**Looks.** Rimewick: a fjord town of red, ochre and slate-blue timber houses with snow on the roofs; Sigrun's **jam house** (a boiling house with copper pots, steam from the chimney once the arc is done) as the signature; drying racks for nets and fish; snowmen by the houses. The **beacon on Lead Rock** is a stone cairn with an iron lamp cage on top that burns lamp oil: a tumbled cairn `before:rimewick-jam`, rebuilt and lit (night lights, 0121) `after:rimewick-jam`. Snowberry Isle: snowy hills, a green moor by the steaming warm spring, red with cloudberries, the old weather station (shuttered until founding), then the glasshouse, flagpole and name board `after:outpost-north`. Every new look goes to Guillaume as screenshots first.

| Quest | Step | Goal | Card |
|---|---|---|---|
| `saltmere-letter` (Kit, Saltmere) | `chart` | dock at Rimewick, charting the Rime Gate and Rimewick's waters | Kit has a letter from Nell, mentions his shoals once. Done card points to Sigrun's jam house. |
| `rimewick-jam` (Sigrun) | `oil` (worried) | deliver 8 lamp oil to Rimewick | The jam house is cold and the old beacon dark; lamp oil for both. |
| | `lead` | reach Lead Rock slowly (under 3 kn, hold), `clean` | Go and look at the pack: the beacon rock still stands at the lead's mouth. |
| | `beacon` | land 6 cut stone on Lead Rock (under 2 kn) | Rebuild the cairn; the lamp goes on top. |
| | done | the pack breaks up (`before:rimewick-jam` on the ice) | The beacon is lit and the pack is cracking. Names Nell, who has wanted to go back to the station for years. |
| `outpost-north` (Sigrun, speaker and `doneSpeaker` Nell) | `supplies` (worried) | land 8 planks and 4 cut stone at Snowberry Isle | Sigrun: the station needs a roof and the glasshouse a footing. |
| | `settler` | carry `nell` (space 0) from Rimewick to Snowberry Isle | Nell, short and teasing, mentions Kit's letter. |
| | done | `found: ["snowberry-isle"]` | Nell: "Bring what we gather to Sigrun at Rimewick, captain, and the jam house will do the rest. Rook will want that in the book." |

Lamp oil (Watchman Key) and cut stone (Stonehaven) are both made goods on the ring, so the deliveries pass the `wantsMade` rule. Drifting bergs and cold gales stay optional: no card needs them, and with them off Lead Rock is still a slow, careful approach past the pack's edge.

**Order.** Since 0194, `saltmere-letter` starts after `saltmere-shoals` and `watchman-passage` (see the Quest ids table).

### The east sea's names (head storyteller, 2026-10-24)

The names are English in French too. The barrier of skerries is **The Stepping Stones**, not "The Skerries", which is too close to Skerry, the home island. Its gateway is **Gannet Sound**, with a light on its north skerry. Fogwatch's sheltered bay is **Fogwatch Voe**. The two sea stacks off its north tip are **The Giant and his Wife** ("Carlin" is too obscure for kids). The current is **The Race**, and the fog banks are **The Haar** and **The Grey Murk**. The islets are **Puffin Holm**, with a beacon to steer by (not "Gull Holm", which is too close to Gull Hook); **Lamb Holm**, with sheep grazing and nobody hunting; and **Broch Isle**, with an old round tower and standing stones, empty for ages. The chart areas are **The Stepping Stones**, **Fogwatch Waters**, **The Race** and **Amber Reach**.

### The east sea, step by step (head storyteller, 2026-10-25)

This section is for the thread that writes the east arcs. It follows the same pattern as the west and the north. The gold amounts are first guesses, for `npm run balance` to settle. `westholm-letter` starts after `westholm-mill` and `watchman-passage` (0194).

**People.** Elias Morrow (amber carver, a man) and Pip Holt (Maren's cousin, a woman) go into `characters.json`. Each gets their own voice in `audio.json`.
- **Elias** is quiet and slow, with a soft, low voice. Make it different from Rook's and Bram's: vowels such as `"eu"`, low `wobble`.
- **Pip** is quick and bright, close to Maren (the same port family), but not the same.
- Elias's workshop on Fogwatch's quay is the port's signature: shutters closed before his arc, a lamp in the window `after:fogwatch-amber`. The foghorn tower gets its light `after:fogwatch-amber`.

| Quest | Step | Goal | Card |
|---|---|---|---|
| `westholm-letter` (Maren, Westholm) | `chart` | dock at Fogwatch, `charts: ["stepping-stones", "fogwatch-waters"]` | Maren has a letter from her cousin Pip and mentions her mill once ("and the mill's turning, tell her that"). On the done card, Elias is named (Maren speaks from the letter, as Ines does): the carver's workshop is shut. |
| `fogwatch-amber` (Elias) | `fish` (worried) | deliver 8 smoked fish to Fogwatch | Few boats go out in the fog any more, so the town eats what comes in. He speaks softly, about small things. |
| | `strand` | reach a point off Amber Strand's beach (under 3 kn, hold), `charts: ["amber-reach"]` | Look at the strand from the sea: either round the Stormbreak's end, or wait for a lull. The card says both ways; with storms off it's just a gusty belt. His Stormbreak line ("Out past the fog the weather comes in breaths…") goes here. |
| | `light` | deliver 8 lamp oil to Fogwatch | Amber on the beach, then. Now a light in the foghorn tower, so boats find the Voe in the Haar. |
| | done | tower lit, workshop opens (`after:fogwatch-amber`) | Thanks, and the strand needs a gatherer. Names Pip Holt, who walks that beach every summer. |
| `outpost-east` (Elias, speaker and `doneSpeaker` Pip) | `supplies` (worried) | land 8 timber and 6 planks at Amber Strand | Elias: a hut out of the wind, and racks to dry what the sea brings. |
| | `settler` | carry `pip` (space 0) from Fogwatch to Amber Strand | Pip strings things together with "and", like her cousin, and mentions Maren once. |
| | done | `found: ["amber-strand"]` | Pip: "Bring what we gather to Elias at Fogwatch, captain, and the workshop will do the rest. Rook will want that in the book." |

Smoked fish (Saltmere), lamp oil (Watchman Key) and planks (Port Calda) are made goods that Fogwatch already wants, so the deliveries pass the `wantsMade` rule. Amber Strand already wants timber and planks. The fog and the Stormbreak keep their switches, and no card needs either one.

### The closing beat: "Four winds" (head storyteller, 2026-10-25)

Once all four outposts are founded, a short epilogue closes Phase 4, like `fair-winds` closes the ring:
- **The quest:** `four-winds` (giver Rook, `pleased`). It starts when `outpost-east` is done and has one step: dock at Skerry.
- **Rook's card:** the company's book is full, with four seas, four outposts and four crafts. His line keeps to his ledger habit, and names no one beyond the ring.
- **What changes:** a signpost on Skerry's pier points to Sunreach, Emberhold, Rimewick and Fogwatch (an `after:four-winds` prop). A new look, so Guillaume sees screenshots.
- **Reward:** a little gold, then the sandbox carries on.
- **Who builds it:** the east thread, after the east arcs. It is one quest, its text and one prop.

**Outposts beyond trading** are not part of this release. Build spots on outposts (0157), and the weather station's small weather perk on Snowberry Isle, stay later ideas in the roadmap.

### The east storm belt: The Stormbreak (head storyteller, 2026-10-24)

The belt of squall lines beside the fog coast is **The Stormbreak** (English in French: « le Stormbreak »). Its HUD hint is interface text, not a card, so it may give the timing: "Squalls in the Stormbreak · lull in about 1 min" / « Grains dans le Stormbreak · accalmie dans 1 min environ », and "Lull in the Stormbreak · squalls in about 2 min" / « Accalmie dans le Stormbreak · grains dans 2 min environ ». With its switch off, the hint goes. Elias may mention it once in `fogwatch-amber`, in words that still hold with the switch off: "Out past the fog the weather comes in breaths. Wait for the quiet one, captain." / « Au-delà du brouillard, le temps vient par souffles. Attendez le calme, capitaine. »

### Town levels in the new seas (head storyteller, 2026-10-25)

Guillaume asked whether the new seas' ports have levels. They do, and they follow one rule:

- **Main ports** (Sunreach, Emberhold, Rimewick, Fogwatch) are old ports gone quiet, not new ones. They start as a **Town** (level 3) with no `maxLevel`, so they can grow to **Port town** (level 4) with trade, like the ring ports. Their workshop opens at level 3 (`levelProduces: { "3": ["<crafted good>"] }`), so it crafts as soon as the outpost's raw goods arrive (0150 point 4).
- **Outposts** (Palm Key, Cinder Isle, Snowberry Isle, Amber Strand) are sites (`site: true`, 0157). They are founded as a **Hamlet** (level 1), gather their raw good from that day, and grow to Town at most (`maxLevel: 3`).

### French map names

Map names stay in English. In French prose, drop "The" and give the name an article, as `le Keeper's Passage` and `la Coral Line` already do: « le Forge Gap », « du Smoulder », « la Floe Line ». Never write « de The Smoulder ». In English prose, write "the Smoulder" mid-sentence, as with "the Teeth", and keep the map name in titles.

### Quest ids

Ids follow `<port>-<slug>` and `outpost-<biome>`. Keepers and relatives go in `characters.json` with their `voice`, look and port. The opener's letter is a quest of its own, so a ring arc never changes after it is merged.

| Sea | Letter (giver, port) | Keeper's arc (giver) | Outpost (giver, speaker) | Starts when |
|---|---|---|---|---|
| South | `watchman-passage` (Ness, Watchman Key) | `sunreach-tea` (Juno) | `outpost-south` (Juno, Tam) | `stonehaven-light` done, and docked at Watchman Key |
| West | `calda-letter` (Ines, Port Calda) | `emberhold-glass` (Bram) | `outpost-west` (Bram, Oskar) | `calda-slipway` and `watchman-passage` done |
| North | `saltmere-letter` (Kit, Saltmere) | `rimewick-jam` (Sigrun) | `outpost-north` (Sigrun, Nell) | `saltmere-shoals` and `watchman-passage` done |
| East | `westholm-letter` (Maren, Westholm) | `fogwatch-amber` (Elias) | `outpost-east` (Elias, Pip) | `westholm-mill` and `watchman-passage` done |

Each keeper's arc starts when its letter is done, and each outpost starts when its keeper's arc is done. The epilogues don't move: `fair-winds` comes after the four ring arcs, and `four-winds` after all four outposts. A ship's draft or class must never block a step outright: a step in the south suits the shallow ships, and its card says so ("she'll want a shallow keel"), but a deep ship can still reach the main port by the long way if the map has one. If not, the thread asks the storyteller.

### One mention across, in Phase 4

Every letter card mentions the ring person's own arc once (Kit's shoals, Ines's slipway, Maren's mill, and Ness's lens), and every keeper names the relative once before they meet. Rook stays at Saltmere. He may close each outpost with a single line in the book on the relative's done card ("Rook will want that in the book"), never with a card of his own.

## Rulings for other threads (2026-10-24)

Story calls made for threads outside the arcs. They stand unless Guillaume changes them.

- **Rook's thanks on the skip path** (0139): written for a stranger, since the player skipped the rescue: "I hear you handle a boat well…", "I've a proposal for you".
- **Finding the home island after the tutorial** (0159): Rook names Skerry, "just west of Saltmere", and a "Sail to Skerry" step with a chart mark takes the captain there. Rook speaks the arrival card: bare plots and a sound pier, and the people of the islands (Kit, Ines, Maren, Ada) will each give a plot. In French say "les îles", not "l'anneau". No building names, deadlines or dialect.
- **Sailing lessons** (the menu's "Replay tutorial", Guillaume 2026-10-24): a separate navigation-only quest that never replays the rescue. Rook runs a buoy course near Saltmere. His lines stay story-neutral, because it can be played before the rescue or long after: no gratitude, Skerry or arcs. No reward (replayable, no farming); the buoys only show while the lesson runs; no dock speed written into text. Done card: "Neatly sailed, captain. The course is here whenever you want it." Titles: "Hoist and lower sails", "Find the no-go zone", "Tack up to buoy A", "Reach to buoy C", "Run home and dock". French uses real terms (virer de bord, vent de travers, vent arrière) and whatever word the HUD already uses for the no-go zone. The HUD says **« zone de vent debout »** (not « zone interdite »). Buoy letters follow the order the player reaches them, as in the quest file. Coach cards may quote Rook (“ ”, « » with a non-breaking space inside), like `lesson.island.copy`. The full French lines: project files `plan/sailing-lessons/storyteller-ruling-2.md`.

## Status (2026-10-28)

- Phase 3 and Phase 4 story are built and merged, and so is the Phase 5 story: the regatta, standing orders, the voiced Skerry choice and the keepers on the harbour screen (see [docs/phase-5/story.md](../phase-5/story.md)).
- The v1.1 Sailing Club story is built and merged ([club-words.md](club-words.md)). No story question is open; the pointers for v1.2 are in [handover.md](handover.md).
