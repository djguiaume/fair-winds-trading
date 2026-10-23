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

## The tutorial's lessons ([0113](../decisions/0113-levels-tutorial-and-music-as-data.md))

The tutorial is the first quest, [`src/data/quests/first-voyage.json`](../../src/data/quests/first-voyage.json).
At the top: `id`, `name`, `start` (`offered`: offered on a fresh voyage and from the menu),
`text` (the prefix of its text keys, `lesson`), `reward` (`gold` paid once when it is finished)
and `steps`, the lessons in order. Later quests use the same file format ([below](#quests-0125)).

Each step:

| Field         | What                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `id`          | stored in the player's tutorial progress; its text is `<text>.<id>.title`, `.copy` and `.continue`                          |
| `action`      | the card's button: `chart`, `market` or `tips`                                                                               |
| `port`        | the harbour the lesson is about: `origin` (where cargo is bought) or `delivery` (where it is sold)                          |
| `picks`       | which of the two a harbour picked on the chart sets                                                                          |
| `cargo`       | `true`: the lesson follows the cargo aboard                                                                                  |
| `continue`    | when the card shows Continue: `always` or `with-cargo`                                                                       |
| `pointer`     | the harbour the coach mark points at: `nearest-port`, `buyer`, `origin` or `delivery` (default: `port`)                     |
| `pointerGood` | the good whose market button it points at: `produced` (the origin's own) or `cargo`                                         |
| `origin`      | `home`: the lesson's harbour is the map's home port, and only it counts as the pick (taking Rook home, [0127](../decisions/0127-prologue-rescue-tutorial.md)) |
| `mark`        | a lesson about the map's prologue wreck: `within` (distance), and to come alongside `maxKn` and `holdSec`; the compass marks the wreck. Skipped on a map without a `prologue` |
| `passenger`   | `true`: Rook is aboard (no hold space)                                                                                       |
| `coach`       | what it points at per surface (`sea`, `chart`, `market`): `chart-button`, `sail-lever`, `wind-compass`, `port-marker`, `dock-button`, `chart-port`, `close-chart`, `buy-button`, `sell-button` |
| `on`          | the step each event leads to (`done` finishes the tutorial)                                                                  |

Events: `chart-opened`, `port-picked`, `destination-cleared`, `sails-practised`, `continue`,
`reached-mark`, `alongside-mark` (a hull hit starts the hold again),
`docked`, `left-port`, `bought`, `sold`, `cargo-gone`, `cargo-sold` (what each one watches:
`src/sim/tutorial.ts`). Lesson text can use `{origin}`, `{delivery}`, `{cargo}`, `{good}` and
`{buyer}`. `tests/tutorial-data.test.ts` checks every event, target and text exists.

- The prologue's places are in the map file: `prologue.start` (`x`, `y`, `headingDeg`: where a fresh
  voyage that takes the tutorial begins) and `prologue.wreck` (the reef or sandbank whose wreck is
  Rook's boat). Rook's thanks, the home island, is the quest
  [`rooks-thanks.json`](../../src/data/quests/rooks-thanks.json).
- Not from data yet: a lesson that waits for something no event watches (reefing in a gale, say)
  needs one new event in code.

## Quests ([0125](../decisions/0125-quest-engine.md))

Every other file in `src/data/quests/` is a quest the engine runs (`src/sim/quests.ts`), several at
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
quest starts on the player's yes). Each step: `id`, then `goal` (a condition) **or** `choose` (two or more
options: `id`, `reward`, `next`); optional `reward`, `next` (a later step or `done`; default the
next one), `clean` (touching a reef or shore starts the step over), `port`, `chart`
(`{ "port", "radius" }`: the rough circle on the chart), `compass` (`{ "x", "y" }`: a
direction mark on the compass, for a foghorn or a wreck), `mood` (the giver's face on this
step's card: `neutral`, `pleased` or `worried`), `look` (a named look from
`characters.json`, e.g. Rook `soaked`) and `speaker` (someone else speaks this step's card, a
`characters.json` id; `mood` and `look` are then theirs: [0133](../decisions/0133-stonehaven-light-arc.md)).

**The person and their card ([0124](../decisions/0124-characters-look.md)).** `giver` is an id in
[`src/data/characters.json`](../../src/data/characters.json) (name, role, home port and a few
values that draw their low-poly portrait); `port` is where their card shows. The card and the
journal read these text keys, and leave out any nobody wrote: `<text>.name` (the arc's name),
`<text>.<step>.copy` (what they say, 2 to 4 lines), `<text>.<step>.title` (the ask, also the
journal line), `<text>.<step>.<option>.title` and `.copy` (a choice's buttons) and
`<text>.done.copy` / `.title` (their thanks, shown pleased). A person's role is
`character.<id>.role`.

| Condition | Params | Where |
| --- | --- | --- |
| `always` | | anywhere |
| `all`, `any` | `of`: list of conditions | anywhere |
| `not` | `of`: a condition | anywhere |
| `quest-done` | `quest` (also `first-voyage`: finished or skipped) | anywhere |
| `chose` | `quest`, `option` | anywhere |
| `docked`, `discovered` | `port` | anywhere |
| `town-level`, `standing` | `port`, `atLeast` | anywhere |
| `orders-done`, `gold` | `atLeast` | anywhere |
| `has-cargo` | `good`, `qty` | anywhere |
| `owns-ship` | `ship` | anywhere |
| `delivered` | `port`, `good`, `qty`: sold or for an order there since the step began | goal |
| `carried` | `item`, `qty`, `from`, `to`: quest cargo, loaded as the hold allows; `from`/`to` is a port or a spot at sea `{ "x", "y", "within", "maxKn", "holdSec" }`, held slowly there ([0131](../decisions/0131-calda-slipway-and-cargo-at-a-spot.md)) | goal |
| `reach` | `points` (`[{ "x", "y" }]`), `within`, `order` (`any`/`in-order`), `maxKn` + `holdSec`, `atNight` | goal |
| `timed` | `from`, `to` (default `from`), `via` (points in order), `within`, `par` (seconds, or `{ "fair": …, "captain": …, "salt": … }`) | goal |

`port` can be `"home"`. Rewards: `gold`, `standing` (`{ "port": n }`), `discover` and `levelUp`
(lists of ports). `tests/quests.test.ts` checks every shipped quest file; `checkQuests` says
what is wrong in plain words. Never rename a shipped quest, step or option: old saves would
start it again.

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
- The game plays `music.sea`, `effects.creak` and, during the prologue, `effects.foghorn`; a new kind of moment (port music, a bell when an
  order is done) needs one line of code to play it, then it is a line in this file.
