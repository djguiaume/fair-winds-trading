# Adding a boat cosmetic

Decision [0261](../decisions/0261-boat-cosmetic-catalogue-as-data-files.md). Cosmetics are pride, never power: nothing here changes speed, hold or price. Items live in `src/data/cosmetics/<slot>/<id>.json`; the slot rules are `rules.json`. Add by file, by the editors' **Cosmetics** page (Export bundle, then `npm run cosmetics -- import cosmetics.json`) or by `npm run cosmetics`. `npm run cosmetics -- check` (also in `npm run check`) says what is wrong.

Every item has `id` (the file name; stored in saves, never rename), `slot`, `name` (`en`, `fr`), `unlock` and optionally `classes` (ship ids; left out: every class).

```json
"unlock": { "kind": "free" }
"unlock": { "kind": "earned", "quest": "westholm-mill" }
"unlock": { "kind": "earned", "regatta": "regatta-cup" }
"unlock": { "kind": "earned", "milestone": "any-name" }
```

A paid kind may come later; nothing is built for it.

## One cosmetic: a sail colour

`npm run cosmetics -- add sail-colour dusk --en Dusk --fr Crépuscule` writes the file; then `set sail-colour dusk cloth "#cdbff0"`. The check refuses a sail darker than lightness 0.55 or in the red kept for storms and damage. Or by hand:

```json
{ "id": "dusk", "slot": "sail-colour", "name": { "en": "Dusk", "fr": "Crépuscule" }, "unlock": { "kind": "free" }, "cloth": "#cdbff0" }
```

## Other slots

| Slot | Fields |
| --- | --- |
| `sail-pattern` | `pattern` (a key of `rules.json` › `patterns`), `colours` (pattern, trim; as many as the pattern takes). Only `bands` is drawn so far (#296); the rest follow in #418. |
| `sail-logo` | `colour`, and `<id>.svg` beside the file: viewBox, flat filled shapes only (`path rect circle ellipse polygon g`), no text, strokes, styles or images, about 40 triangles at most (the check estimates). |
| `hull-colour` | `band`, `strake` (hex); `stock` keeps the class's own. |
| `flag` | `own: { shape, bands (1 to 3), length, height }` or `ref` (a regatta pennant of `flags.json`: earned by its series, never recoloured). A personal flag may not look like any flag of `flags.json`. |
| `wake` | `style` (see `rules.json`), `tint` (hex or null). |
| `set` | `items`: a slot to an item id. |

## A figurehead

1. Draw it as a prop recipe in `src/data/props/figurehead-<name>.json` with `"group": "figureheads"` (at most 60 triangles; look at `figurehead-sun.json`). Check it in the island builder's prop list or `npm run island`.
2. `npm run cosmetics -- add figurehead sun --en Sun --fr Soleil --unlock quest:outpost-south --recipe figurehead-sun --tris 44`.
3. `mount` (`stem`) and `size` are in the file; each ship file's mount position is the ship models' (#296).

`npm run cosmetics -- sheet` writes `shots/cosmetics/sheet.svg`, every item on a boat, for a quick look.
