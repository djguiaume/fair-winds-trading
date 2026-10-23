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
