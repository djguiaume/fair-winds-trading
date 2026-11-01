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
| `sail-pattern` | `pattern` (a key of `rules.json` › `patterns`: bands, stripe, panels, halves, chevron, diamond), `colours` (pattern, trim). The upgrade bands take the colours `boat-look.json` › `patterns.bandColours` names (decision 0264). |
| `sail-logo` | `colour`, and `<id>.svg` beside the file: viewBox, flat filled shapes only (`path rect circle ellipse polygon g`, `transform` allowed), no text, strokes, styles or images, about 40 triangles at most (the check estimates). An outline inside another is a hole. The `colour` is no lighter than lightness 0.55 (`rules.json › emblem.maxLightness`). Drawn on the mainsail, half its width, centred (decision 0264); over a pattern of a close colour the cloth keeps plain canvas behind it. |
| `hull-colour` | `band`, `strake` (hex); `stock` keeps the class's own. |
| `flag` | `own: { shape, bands (1 to 3), length, height }` or `ref` (a regatta pennant of `flags.json`: earned by its series, never recoloured). A personal flag may not look like any flag of `flags.json`. |
| `wake` | `style` (see `rules.json`; how each draws: `boat-look.json` › `wakes`), `tint` (hex, any colour, or null). |
| `set` | `items`: a slot to an item id. |

## A figurehead

1. Draw it as a prop recipe in `src/data/props/figurehead-<name>.json` with `"group": "figureheads"` (at most 60 triangles; look at `figurehead-sun.json`). Check it in the island builder's prop list or `npm run island`.
2. `npm run cosmetics -- add figurehead sun --en Sun --fr Soleil --unlock quest:outpost-south --recipe figurehead-sun --tris 44`.
3. `mount` (`stem`) and `size` are in the file; each ship file's mount position is the ship models' (#296).

`npm run cosmetics -- sheet` writes `shots/cosmetics/sheet.svg`, every item on a boat, for a quick look.

## How looks are saved (ADR 0263)

- Each owned ship keeps its own look: `looks` in the save (`{ "<ship id>": { "sailColour": "<item id>", ... } }`), only slots that differ from stock. No `looks` means stock, so old saves load unchanged and `SAVE_VERSION` is still 1.
- Only item ids are stored. On load an unknown slot, unknown or unfit id, or a ship no longer owned is dropped (that slot reverts to stock); the voyage always loads.
- Save codes (FW2) carry it in section 15 as text ids; the FW1 code and the `.json` file carry the `looks` object. Adding items never changes old codes. New slots: append to `SLOT_ORDER` in `src/sim/saveLooksCode.ts`.
- The Boat looks screen edits a `LookDraft` (`src/sim/shipLooks.ts`); only `apply` / `setShipLook` write to the captain, so previews never reach autosave or transfer.

## Seeing it on a boat

`models.html?view=sloop&level=2&wear={"sailLogo":"gull","sailPattern":"chevron-plum"}` shows the 3D model in a look (`&number=FW 1` adds a racing number); the game takes the same `?wear=` for screenshots (`npm run shots -- --query 'wear={…}'`).
