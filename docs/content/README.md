# Adding content without code

Content lives in data files ([0093](../decisions/0093-data-driven-content-and-authoring-tools.md)).
This page says which file to edit to add something new. Edit on GitHub (open the file, pencil
icon, commit to a new branch, open a pull request); CI runs every check.

## A new good ([0108](../decisions/0108-goods-and-weather-kinds-as-data.md))

Add an entry to [`src/data/tuning/goods.json`](../../src/data/tuning/goods.json):

```json
"salt": {
  "id": "salt",
  "name": "Salt",
  "kind": "raw",
  "basePrice": 12,
  "icon": "🧂"
}
```

- `id` must be the same as the key. It is stored in saves: never rename a shipped good.
- `kind`: `raw` (a bulk good a port produces), `made` (a level-3 workshop makes it; add
  `"madeFrom": "<raw good>"`) or `rare` (made only at a far yard).
- The order of the file is the order of the harbour and chart lists.
- Then give it a maker and buyers in the map editor (`editor.html`, port panel: produces, wants,
  makes at level, wants made). The map checks flag a good that is wanted but made nowhere, or made but wanted nowhere; a good on no port at all simply never trades.
- Names: add `good.salt`, `goodThe.salt` and `goodSome.salt` to
  [`src/i18n/en.json`](../../src/i18n/en.json) and [`fr.json`](../../src/i18n/fr.json) ("Salt" /
  "the salt" / "salt", "Sel" / "le sel" / "du sel"). Until then the game shows `name`. A `made` good
  can also get `workshop.salt` ("a salt pan"); otherwise the toast says "a workshop".
- Not from data yet: a good's look as deck cargo is the same crates for every good.

## A new weather kind ([0108](../decisions/0108-goods-and-weather-kinds-as-data.md))

Add an entry under `default.kinds` in
[`src/data/tuning/weather.json`](../../src/data/tuning/weather.json):

```json
"fog": { "name": "Fog", "weight": 0.1, "strength": [0.4, 0.6], "rain": 0, "gusts": 0.5, "gloom": 0.4 }
```

- `weight`: how often it is picked when the weather changes, against the others' weights.
- `strength`: wind multiplier range; `rain` 0..1; `gusts` × the map's gustiness; `gloom` 0..1 how
  grey the sky gets.
- Add it **at the end**: the order of the file is the order of the pick, so moving a kind changes
  the weather of every voyage.
- `breeze` is the plain weather: every voyage starts in it, the HUD does not name it, and difficulty
  levels move weight between it and `gale`. Keep both.
- Name: `weather.fog` in `src/i18n/en.json` and `fr.json`; until then the HUD shows `name`.
- Not from data yet: a new look (real fog, snow) needs code once; until then a kind looks like its
  rain and gloom.

## A new ship ([0109](../decisions/0109-one-file-per-ship.md))

Copy a ship file in [`src/data/ships/`](../../src/data/ships/), rename it to the new id
(`ketch.json`) and change what differs. The file is the whole ship:

| Part      | What                                                                                                                                                                                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| top       | `id` (same as the file name, stored in saves), `name`, `line` (`starter`, `swift`, `hauler`, `warship`) and `tier` (1 to 3): the shipyard order                                                                                                     |
| `unlock`  | `standing` (orders to deliver at the yard before it is on sale), `price`, `upgradePrices` (level 2 and 3)                                                                                                                                           |
| `sailing` | polar, no-go angle, speed, turning, leeway, hold, draft, collision radius ([sailing model](../sailing-model.md)) and `heel` (how readily she leans, 1 = sloop)                                                                                       |
| `hull`    | `length`, `beam`, `depth` in reference units and the authored sections: `outline` (deck plan, x and z from -0.5 to 0.5, bow at +z) and `rings` (how the hull narrows going down)                                                                    |
| `model`   | `hullColor`, `bandColor`, the main mast (`mastZ`, `mastHeight`, `boom`, `gaff`), optional `foremast` / `mizzen` / `squareMasts`, jibs, cargo spots, `castle`, and `parts`: named pieces from `src/render/models/shipParts.ts` |

- **Where it is built** is set per map: a port's `builds` list in the map editor. A ship no port
  builds is never on sale.
- **Parts available:** `schooner-deck`, `clipper-deck`, `hoy-deck`, `leeboards`, `fluyt-stern`,
  `indiaman-stern`, `gun-ports`. A new kind of part (lateen rig, paddle wheel) needs code once.
- **Look at it** on the model sheet before playing: `models.html?view=ketch&level=3` (also
  `?view=boats` for all ships side by side).
- **Names:** `ship.ketch` and `shipThe.ketch` in `src/i18n/en.json` and `fr.json`; until then the
  game shows `name`.

## A new building or prop ([0135](../decisions/0135-props-as-data.md))

Every building, tree and rock an island file places is a recipe in
[`src/data/props/`](../../src/data/props/), one file per type (`fish-house.json`); colours come
from [`src/data/palette.json`](../../src/data/palette.json). Copy a close file, rename it to the
new id and change its parts. A new file shows up in the island builder's palette (by its `group`).

```json
{
  "id": "fish-house",
  "name": "Fisher's house",
  "group": "homes",
  "home": true,
  "building": true,
  "style": "fish",
  "vars": { "h": { "range": [1.1, 1.6] } },
  "parts": [
    { "box": [0.8, "h", 0.95], "at": [0, "h / 2", 0], "color": "walls[variant]" },
    { "gable": [0.9, 1.1, 0.7], "y": "h", "color": "roofs[variant * 3]" },
    { "windows": [0.8, 0.95, "h * 0.72", 2, 1], "seed": "variant" }
  ]
}
```

| Key | What |
| --- | --- |
| top | `id` (the file name, used by island files), `name` (in the builder), `group` (`homes`, `town`, `timber`, `fish`, `farm`, `stone`, `nature`, `landmarks`), flags `home`, `building`, `water`, `edge`, `sizedInModel`, footprint `fit` / `fitRadius`, `internal` (not in the builder) |
| `style` | take walls and roofs from this style (`fish`, `timber`, `grain`, `stone`, `yard`) instead of the island's |
| `vars` | numbers set in order: a number, an expression, or `{ "range": [a, b] }` set by the island file's `shape` (0 gives a, 1 gives b) |
| `defaults` | values for island-file fields a prop may leave out (`length`) |
| `extends` | another recipe to copy, with some `vars` changed (`windmill-bare` is `windmill` with `bare: 1`) |
| `scale` | scales the whole model at the end (the landmarks use `"size"`) |

**Parts.** Each part has one shape: `box` [w, h, d], `cyl` [top r, bottom r, h, sides, open, start, arc], `cone` [r, h, sides], `gable` / `hip` [w, d, h] with eaves at `y`, `sphere`, `ico`, `dodeca`, `torus`, `plane` [w, h], `windows` [w, d, height, front, side, x, z] with `seed`, `use` (another prop, with `vars`), `part` (a shape written in code, `src/render/models/propRecipe.ts` › `CODE_PARTS`), or `parts` (a group). Then `at` [x, y, z] moves it; `ops` (`["move", x, y, z]`, `["turnX" | "turnY" | "turnZ", radians]`, `["scale", s]`) are steps applied before `at`, for pieces that pivot. `if` keeps a part only when its expression is not 0; `repeat` (`{ "x": [-1, 1] }` or `{ "i": { "count": 4 } }`) makes one per value. `glow` makes lit glass; `tag` sets game hooks.

**Colours:** a palette name (`post`, `chimney`, `sail`), a list with an index (`walls[variant]`, `roofs[variant * 3]`, `pine[i]`, `crops[variant]`; the index wraps), `{ "pick": "i % 2", "of": ["stone", "cut"] }`, or `#rrggbb`.

**Expressions** (`"h / 2"`, `"k * pi / 2 + 0.4"`, `"variant == 0 ? 2 : variant"`) use numbers, the names `R` (island radius), `variant`, `shape`, `size`, `length`, the vars and repeat names, `pi`, `+ - * / %`, comparisons, `&& || !`, `? :`, and `floor abs min max sin cos sqrt pow`.

**Checks** (`tests/prop-files.test.ts`): a typo in a key, an unknown colour or name, or a part with no shape fails with the file and part named; every file must build in every style for variants 0 to 5, within its group's triangle budget (`src/data/prop-groups.json`: homes 120, nature 60…) because islands must stay light for the old tablet. Changing a shipped recipe changes the islands that use it: the island golden hashes in `tests/island-files.test.ts` then need the new values, after a look at the island.

## A new difficulty level ([0113](../decisions/0113-levels-tutorial-and-music-as-data.md))

Add an entry under `levels` in
[`src/data/tuning/difficulty.json`](../../src/data/tuning/difficulty.json), in its place from the
easiest to the hardest:

```json
"storm": {
  "name": "Storm petrel",
  "tag": "Gales all the way",
  "color": "#c48bff",
  "waves": 3,
  "cargoLost": 2, "damage": 2, "repairCost": 4, "spread": 0.14, "orderFactor": 1.1,
  "startGold": 80, "growth": 1.5, "galeWeight": 0.3, "stormEverySec": 300, "steadyWind": false
}
```

- The key is stored in saves: never rename a shipped level. `default` at the top of the file is
  the level that plays when none is picked (Captain); it keeps the map's own weather and wears the
  "Standard" badge.
- `name`, `tag`, `color` and `waves` (1 to 3) make its card on the New voyage screen and its
  button in Settings; the knobs are explained in `src/data/tuning-meta.ts`.
- Text: `level.storm` (name), `level.stormTag` and the card's points `level.storm1`,
  `level.storm2`… in `src/i18n/en.json` and `fr.json`. Points after the third are hidden on small
  screens. Until then the card shows `name` and `tag` and no points.
- Check the balance: `tests/difficulty-balance.test.ts` runs every level.

## A new town level ([0113](../decisions/0113-levels-tutorial-and-music-as-data.md))

Add an entry at the end of `levels` in
[`src/data/town-levels.json`](../../src/data/town-levels.json) (`{ "name": "City" }`), then one
number for it in each per-level table of
[`src/data/tuning/economy.json`](../../src/data/tuning/economy.json) › `towns`:
`growthToLevel` (`"5": 600`), `wantsEquilibrium`, `producesEquilibrium` and `orderScale`. A test
fails until every table has one entry per level.

- Levels are stored in saves as numbers: add at the end, never in between.
- The top level is the one the rare-goods gate holds back ([0065](../decisions/0065-rare-goods-from-the-far-yards.md)).
- What a town wants and makes at the new level: the map editor (port panel, "Wants at L5"…).
- Its look: give props `from: 5` in the island builder; until then it looks like a port town.
- Name: `settlement.level.5` in `src/i18n/en.json` and `fr.json`; until then the game shows `name`.

## The tutorial's lessons ([0151](../decisions/0151-tutorial-as-ordinary-quest-steps.md))

The tutorial is an ordinary quest, [`src/data/quests/first-voyage.json`](../../src/data/quests/first-voyage.json),
written with the step fields of the [Quests](#quests-0125) section below and edited in the quest
builder like any other. What makes it a lesson is data at the top of the file: `start: { "is":
"asked" }` (the game asks for it: a fresh voyage's offer or the menu), `lesson: true` (the coach
bubble instead of a card, always tracked, other cards wait), `storms: false`, and `vars` for the
harbours and cargo the player picks. Its text keys are `lesson.<step>.title`, `.copy` and
`lesson.<step>.continue.title`, plus `lesson.done.title`/`.copy`. Skip counts it as done, unpaid.

- The prologue's places are in the map file: `prologue.start` (`x`, `y`, `headingDeg`: where a fresh
  voyage that takes the tutorial begins) and `prologue.wreck` (the reef or sandbank whose wreck is
  Rook's boat; the boat starts there lying still with the sails down). Steps name it `"wreck"`; on a
  map without a prologue they are passed by. Rook's thanks, the home island, is the quest
  [`rooks-thanks.json`](../../src/data/quests/rooks-thanks.json).
- A lesson that waits for something no condition watches (reefing in a gale, say) needs one new
  condition in `src/sim/questLibrary.ts`, then data.

## Quests ([0125](../decisions/0125-quest-engine.md))

The **quest builder** in the map editor (`editor.html` › Quests, [how to use](../quest-builder/builder/README.md), [0142](../decisions/0142-quest-builder.md)) edits all of this with forms, places on the chart and text side by side, and exports the files.

Every file in `src/data/quests/` is a quest the engine runs (`src/sim/quests.ts`), several at
once, saved with the voyage. Example (a test file: [`tests/fixtures/quests/test-pier.json`](../../tests/fixtures/quests/test-pier.json)):

```json
{
  "id": "calda-slipway",
  "name": "The old slipway",
  "start": { "is": "quest-done", "quest": "first-voyage" },
  "text": "quest.calda-slipway",
  "items": { "patterns": { "space": 1 } },
  "steps": [
    { "id": "stone", "goal": { "is": "delivered", "port": "calda", "good": "stone", "qty": 8 }, "reward": { "gold": 60 } },
    { "id": "build", "choose": [{ "id": "workshop" }, { "id": "rigging-loft" }] }
  ],
  "reward": { "levelUp": ["calda"] }
}
```

At the top: `id`, `name`, `start` (a condition), `text` (prefix of the text keys:
`<text>.<step>.title` and `.copy`), optional `reward`, `items` (quest cargo: hold `space` per
piece, 0 for a passenger), `giver`, `port`, `offer` (`true`: the card asks first, and the
quest starts on the player's yes; the captain can also say "don't offer again"), `main` (`true`:
a story quest, whose cards greet the captain on arrival before the harbour screen; every other
quest speaks on the harbour screen's Quay tab and with a small note at sea, decision 0141). Each step: `id`, then `goal` (a condition), `choose` (one or more
options: `id`, `reward`, `next`, and `if`: shown only while that condition holds) or both (either
ends the step); optional `reward`, `next` (a later step or `done`; default the
next one), `clean` (touching or grinding on a reef or shore starts the step over), `port`, `chart`
(`{ "port", "radius" }`: the rough circle on the chart), `compass` (`{ "x", "y" }` or `"wreck"`: a
direction mark on the compass, and where the sea's objective arrow points, for a foghorn or a
wreck), `wind` (`{ "speedKn", "fromDeg"? }`: a light, steady breeze instead of the sea's wind;
direction default the map's), `sound` (`{ "effect", "everySec" }`: an `audio.json` effect played
at once and then every few seconds, with the line `toast.<effect>` if there is one, `{dir}` the
direction of the step's place), `mood` (the giver's face on this
step's card: `neutral`, `pleased` or `worried`), `look` (a named look from
`characters.json`, e.g. Rook `soaked`) and `speaker` (someone else speaks this step's card, a
`characters.json` id; `mood` and `look` are then theirs: [0133](../decisions/0133-stonehaven-light-arc.md)). The sea shows the
**tracked** quest's step: its `compass`, `wind` and `sound` ([0139](../decisions/0139-gentler-prologue-and-quest-cards.md)), and with no course set an
objective arrow to its compass point, spot or harbour. The tutorial's lessons use the same `wind`
and `sound` fields.

**Lessons, picks and ways back ([0151](../decisions/0151-tutorial-as-ordinary-quest-steps.md)).**
Any quest can use what the tutorial needed:

| Field | Where | What |
| --- | --- | --- |
| `lesson` | quest | `true`: the coach bubble instead of a card; always tracked while it runs |
| `storms` | quest | `false`: no storms while it runs |
| `vars` | quest | `{ "name": "port" or "good" }`, picked in play; conditions, `port` and `coach` read `$name`; text says `{name}`, `{nameMakes}` (a port's own good) and `{nameBuyer}` (a good's buyer, key `<text>.<name>Buyer`) |
| `set` | step | `{ "name": source }` when the step ends: `course`, `docked`, `aboard`, `home`, an id or `$var` |
| `unless` | step | `[{ "if": condition, "to": step, "set"? }]`: ways back, tested after the goal, one per check |
| `coach` | step | `sea`, `chart`, `market`: the element ringed on each screen (`chart-button`, `sail-lever`, `wind-compass`, `port-marker`, `dock-button`, `chart-port`, `close-chart`, `buy-button`, `sell-button`); `port` (id, `home`, `$var`, `nearest`, `buyer:$var`); `good` (id, `$var`, `makes:$var`); `action` (the bubble's button: `chart`, `market`, `tips`) |

**The person and their card ([0124](../decisions/0124-characters-look.md)).** `giver` is an id in
[`src/data/characters.json`](../../src/data/characters.json) (name, role, home port and a few
values that draw their low-poly portrait); `port` is where their card shows. The card and the
journal read these text keys, and leave out any nobody wrote: `<text>.name` (the arc's name),
`<text>.<step>.copy` (what they say, 2 to 4 lines), `<text>.<step>.title` (the ask, also the
journal line), `<text>.<step>.<option>.title` and `.copy` (a choice's buttons) and
`<text>.done.copy` / `.title` (their thanks, shown pleased). A person's role is
`character.<id>.role`. A timed step's title and copy can say `{par}`: the run's par for the voyage's
level, as a clock ("Rush bread to Saltmere in {par}" shows "2:20" on Captain,
[0132](../decisions/0132-westholm-mill-and-babble-voices.md)). A timed run with quest cargo is
`{ "is": "all", "of": [{ "is": "carried", … }, { "is": "timed", … }] }`.

| Condition | Params | Where |
| --- | --- | --- |
| `always` | | anywhere |
| `all`, `any` | `of`: list of conditions | anywhere |
| `not` | `of`: a condition | anywhere |
| `asked` | the game starts it (the tutorial) | start only |
| `quest-done` | `quest` (also `first-voyage`: finished or skipped) | anywhere |
| `chose` | `quest`, `option` | anywhere |
| `docked` | `port` (optional: any harbour) | anywhere |
| `discovered` | `port` | anywhere |
| `course` | `port` (optional): a course set on the chart | anywhere |
| `screen` | `screen`: `sea`, `chart` or `market` on screen | anywhere |
| `town-level`, `standing` | `port`, `atLeast` | anywhere |
| `orders-done`, `gold` | `atLeast` | anywhere |
| `has-cargo` | `good`, `qty` (both optional: anything aboard) | anywhere |
| `owns-ship` | `ship` | anywhere |
| `moored` | `island` (optional; default the home island): moored at its pier | anywhere |
| `delivered` | `port`, `good`, `qty`: sold or for an order there since the step began | goal |
| `landed` | `place`, `good`, `qty`: goods taken out of the hold at a port alongside, or at a spot at sea held slowly there, as many as she has aboard up to `qty`; nothing paid; founding goods ([0155](../decisions/0155-founding-an-outpost.md)) | goal |
| `carried` | `item`, `qty`, `from`, `to`: quest cargo, loaded as the hold allows; `from`/`to` is a port or a spot at sea `{ "x", "y", "within", "maxKn", "holdSec" }`, held slowly there ([0131](../decisions/0131-calda-slipway-and-cargo-at-a-spot.md)) | goal |
| `bought` | `port`, `good` (optional), `qty`: bought there since the step began | goal |
| `sails-practised` | lowered and raised the sails, steered, got under way | goal |
| `reach` | `points` (`[{ "x", "y" }]` or `"wreck"`), `within`, `order` (`any`/`in-order`), `maxKn` + `holdSec`, `atNight` | goal |
| `timed` | `from`, `to` (default `from`), `via` (points in order), `within`, `par` (seconds, or `{ "fair": …, "captain": …, "salt": … }`) | goal |

`port` can be `"home"`. Rewards: `gold`, `standing` (`{ "port": n }`), `discover` and `levelUp`
(lists of ports), and `found` (a list of sites to found, below). `tests/quests.test.ts` checks every shipped quest file; `checkQuests` says
what is wrong in plain words. Never rename a shipped quest, step or option: old saves would
start it again.

**An outpost to found ([0155](../decisions/0155-founding-an-outpost.md)).** Give the port entry
`"site": true` and its `level` (the level it opens at) and `maxLevel`. Until a quest reward
`"found": ["<port>"]` names it, it is an empty island: no pier, market, chart entry or docking.
Its island file shows level 0 before founding: give a prop `"from": 0` to have it stand then
too (a daymark); everything from level 1 appears on the day it is founded (the flagpole and
name board, the first homes). Founding goods are `landed` at a spot off its beach, the settler
is a `carried` item (space 0) to the same spot. `discover` and `levelUp` never name a site.

**A step's places at sea ([0130](../decisions/0130-after-a-quest-and-the-saltmere-shoals.md)).**
The tracked step's `reach` points, a timed run's `via` points and quest cargo's spot are drawn
at sea (a ring as wide as `within`, the next one pulsing) and on the chart, with no extra field.
`"marker": "gulls"` on a step adds a flock diving over each spot.

### What changes after a quest ([0130](../decisions/0130-after-a-quest-and-the-saltmere-shoals.md))

- **Island props:** add `"tags": ["after:<quest>"]` to a prop that stands once the quest is
  done, `"tags": ["before:<quest>"]` to one that goes then. To swap a prop, put the pair on the
  same spot (the island checks know they never stand together). A lighthouse or beacon prop
  tagged this way is lit only when it stands. A moored boat is solid, so it cannot wait on a
  quest: use a sea mark.
- **A port's trade:** in the map's port entry, `"afterQuest": { "<quest>": { "levelProduces":
  { "2": ["smokedFish"] } } }`. Each field given (`produces`, `wants`, `levelProduces`,
  `levelWants`, `wantsMade`) takes the place of the port's own once the quest is done.
- **Sea marks:** the map's `"marks": [{ "type", "x", "y", "turn", "tags", "chart" }]`, for
  things at sea: `buoy-red`, `buoy-green`, `fishing-boat`, `pilot-cutter`, or `light` (a star
  on the chart only), and the cardinal danger marks `cardinal-north`, `cardinal-east`,
  `cardinal-south`, `cardinal-west` (decision 0152: safe water lies on the named side; their
  models are recipes in `src/data/props/mark-cardinal-*.json`, a yellow and black diamond on
  the chart). `turn` is a heading in degrees; `"chart": true` draws it on the chart too. Not solid;
  the map checks keep them off land and reefs.
- `checkQuestHooks` (run by `tests/quest-hooks.test.ts`) refuses a tag or `afterQuest` naming a
  quest that does not exist.

A reef's or bank's landmark can be set by hand with `"look": { "landmark": "wreck",
"landmarkAt": { "x", "y" } }`, so reshaping the outline does not move it (the prologue wreck).

## Music and sounds ([0113](../decisions/0113-levels-tutorial-and-music-as-data.md))

Every sound is listed in [`src/data/audio.json`](../../src/data/audio.json):

```json
{
  "music": { "sea": { "theme": "fair-winds" } },
  "effects": { "creak": { "synth": "creak", "volume": 1.6 } }
}
```

- **A recorded sound:** put the file in `public/audio/` and point to it:
  `"sea": { "file": "audio/sea-shanty.mp3", "volume": 0.8 }` loops it as the sea music;
  `"creak": { "file": "audio/creak.ogg" }` plays it as the creak. MP3 or OGG; keep files small for
  old phones. A missing file plays as silence.
- **A new tune from the composer:** copy
  [`src/data/music/fair-winds.json`](../../src/data/music/fair-winds.json), rename it
  (`harbour-jig.json`), change what differs and point a track at it
  (`"theme": "harbour-jig"`). The file holds `tempo` (beats per minute range), `scales` and `keys`
  (tonic as a MIDI note, 62 = D), `rhythms` (bar rhythms in eighths, each adding up to 6),
  `progressions` (chords as scale degrees, 0 = home chord), `startSteps`, `range`, `leap` and
  `moves` of the melody, `restChance`, `accents`, `padVel`, `bassVel`, `restBars` (pad chords
  between tunes) and `echo`. Every tune is still 16 bars in 6/8 on flute, pad and bass: a new
  form or instrument needs code once.
- **People's voices** ([0132](../decisions/0132-westholm-mill-and-babble-voices.md)): when a card
  opens, its person babbles about one syllable per word of the ask (at most 1.5 s). A person's
  entry in `characters.json` names a voice (`"voice": "maren"`) from the `voices` section:

  ```json
  "voices": {
    "maren": { "synth": "babble", "pitch": 1.45, "speed": 1.45, "wobble": 0.22, "vowels": "eia",
               "moods": { "pleased": { "pitch": 1.55 } } },
    "ness":  { "files": ["audio/voices/ness-1.ogg", "audio/voices/ness-2.ogg"], "volume": 0.9 }
  }
  ```

  Generated: `pitch` (1 = a middle voice, about 180 Hz), `speed` (1 = about seven syllables a
  second), `wobble` (0 flat to 1 sing-song) and `vowels` (from `aeiou`; give the people of one port
  the same ones, their accent). Recorded: `file` or `files` in `public/audio/voices/` (one clip is
  picked at random and cut to length). `volume` and `moods` (`neutral`, `worried`, `pleased`) are
  optional. Settings › Sound › Voices switches them off; `?tune` › Voices plays each one. The
  checks refuse a person whose voice is missing and a file not in `public/`.
- The game plays `music.sea`, `effects.creak` and, during the prologue, `effects.foghorn`; a new kind of moment (port music, a bell when an
  order is done) needs one line of code to play it, then it is a line in this file.
