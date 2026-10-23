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
