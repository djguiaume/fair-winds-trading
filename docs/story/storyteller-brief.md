# Storyteller brief: how the community arcs are written and built

**Status:** written by the head storyteller after Guillaume's answers (2026-10-23). It is binding for the four arc threads. **Recorded in:** [0129](../decisions/0129-storyteller-brief.md). **Builds on:** the approved story ([community arcs](community-arcs.md), [0122](../decisions/0122-community-arcs-story.md)), the quest engine ([0125](../decisions/0125-quest-engine.md), how-to in [content README › Quests](../content/README.md#quests-0125)), the home island ([0126](../decisions/0126-home-island-build-spots.md)) and the prologue ([0127](../decisions/0127-prologue-rescue-tutorial.md)).

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
2. **The title is the ask**, written as an imperative of at most 5 words, with the place in it when there is one: "Bring stone to Port Calda", "Find the diving gulls". It is also the line in the journal.
3. **The copy is the person talking**, in the first person, with no quotation marks (the card shows who is speaking). Stage directions don't go in the copy.
4. **Everyone calls the player "captain"**, lower case in a sentence. In French it's "capitaine" with **vous**, and nobody says *tu*. The player has no name and no gender, so French copy addressed to the player must not agree a word with the player's gender (write "Merci, capitaine", not "vous êtes prêt").
5. **No deadlines or threats that the game doesn't keep.** Nothing can fail, so nobody says "the fair is in a week" or "before dark". A timed run is about freshness or pride ("while the fish are still jumping"), and its par is in the title, not in the copy.
6. **Use the game's own words** for places, goods and ships: Port Calda, Stonehaven, timber, stone, cutter, hauler. Numbers in the copy (crates, knots) must match the quest file.
7. **Sailing talk is welcome, because the audience likes sailing.** "Come in slow, under two knots", "you'll need a tack or two". Don't explain the interface in dialogue: the coach marks and the title do that.
8. **Hazards stay optional.** No line needs night or a storm to be switched on. Say "when the light's lit", not "tonight".
9. **One mention across.** Each arc mentions at least one other person by name, once, so the islands feel like neighbours. Already in the story: Ada's millstones (Westholm), Rook at the launch (Calda), Old Ness and his lens (Stonehaven). Kit mentions Rook, who went looking for the shoals on the East Reef and ended up on it (that's the prologue's wreck).
10. **Moods:** `worried` on the hook (the first step), `neutral` on the middle steps, and `pleased` on the done card.
11. **The done card does two things in two lines:** thanks, and an invitation to "pick" the building on your island. Don't name the two buildings there, because the island's spot card shows them.

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

**`calda-slipway`, "The last keel" (Ines).** Steps: `stone` (deliver 8 stone to Port Calda), `mast` (item `mast-tree`, 1 piece × space 8, loaded at a landing spot on **Greyback Ridge's** shore, under 2 kn, `clean`), `launch` (item `rook`, space 0, timed from Saltmere to Port Calda). On `launch`, Rook speaks one line, as speaker (see `speaker` below), if it's ready. Port change: rebuilt slipway with a hull on it, the pilot cutter at the pier, planks from level 2.

**`westholm-mill`, "The mill on the hill" (Maren).** Steps: `sails` (deliver 8 timber to Westholm), `millstones` (item `millstone`, 2 pieces × space 6, from Stonehaven to Westholm: a sloop makes two trips, a cutter or hauler one), `bread` (item `bread-batch`, 4 × space 1, timed from Westholm to Saltmere). The millstones are "cut by Ada". Maren's card says so, and Ada doesn't need to speak. Port change: the windmill turns, and the harvest fair is `levelUp: ["westholm"]` (the fair happens on the done card; it is never a deadline).

**`stonehaven-light`, "A light on the Teeth" (Ada).** Steps: `scaffold` (deliver 6 timber to Stonehaven), `stone` (item `stone-blocks`, 3 × space 5, to the landing on **Teeth Rock**, under 2 kn, `clean`: a sloop makes two trips, a cutter one), `lens` (discover Watchman Key from a chart circle, take the item `lens`, 1 × space 1, from Watchman Key to Teeth Rock). Old Ness speaks the Watchman Key card (`speaker: "ness"`). The light comes on as you leave Teeth Rock, with the Saltmere sweep (0121). Port change: the lighthouse on Teeth Rock (island file and light), the reef drawn with a light on the chart, and the mason's crane on Stonehaven's quay.

### Places at sea

The engine's markers are map coordinates in the quest file (0125). Landing spots and gates are chosen by the thread that owns them, written in the quest file, and named in that thread's ADR. Moving an island later means moving its markers.

## Who builds the shared pieces

Each shared piece has **one owner thread**, so the four arcs don't build it four times. The others write their quest file, text and tests in parallel and rebase onto the owner's merged PR. Until then a test may skip the part that needs it.

| Shared piece | What | Owner | Used by |
|---|---|---|---|
| **After-a-quest hook** | Props tagged `after:<quest>` show once that quest is done, and props tagged `before:<quest>` go. A port may change what it makes after a quest (for example, `levelProduces` earlier). Chart marks follow the same tags. | **Saltmere** | all four, epilogue |
| **Cargo at a spot** | `carried` with `from` / `to` as a point at sea (`{ x, y, within, maxKn, holdSec }`) instead of a port: load or unload by holding slowly at a landing spot. | **Calda** | Calda (mast), Stonehaven (stone, lens) |
| **A step's speaker** | A step's `speaker` (a character id) shows that person on the card instead of the giver. | **Stonehaven** | Stonehaven (Ness), Calda (Rook), optional |
| **Teeth Rock** | A new small rock island file at the west end of `sw-reef`, with its landing spot and the lighthouse props (`after:stonehaven-light`). | **Stonehaven** | Stonehaven |
| **East Reef gap** | Split the East Reef's outline to open a channel at the north-west end, keeping the prologue wreck and its test where they are. | **Saltmere** | Saltmere |
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
