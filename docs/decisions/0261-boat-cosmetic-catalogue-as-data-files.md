# 0261. Boat cosmetic catalogue as data files

**Status:** Proposed (2026-11-01), part of v1.4 (#297).

## Context

v1.4 lets the player dress a boat (design: [customisation.md](../v1.4/customisation.md), ADR 0259). Guillaume wants items easy to add, available free or earned, and a paid kind possible later. The screen, saves and rendering come in other parts (#298, #299, #296); they all need one agreed catalogue and one set of checks.

## Decision

- One JSON file per item in `src/data/cosmetics/<slot>/<id>.json`; slots: sail colour, sail pattern, sail logo (plus `<id>.svg` beside it), hull colour, figurehead, flag, wake, and `set`. Slot rules (allowed patterns, wake styles, triangle limits, stock ids) are `src/data/cosmetics/rules.json`.
- Each item has stable `id`, names (EN and FR), `unlock` (`free`, or `earned` by one quest, regatta series or milestone) and optional `classes` (default: every ship class). No paid kind is built; it would be one more `unlock` kind.
- One pure module, `src/sim/cosmetics.ts`, holds the types and `resolveAppearance` (ids to concrete values for a ship class; unknown or unfit ids fall back to stock with a diagnostic). `src/sim/cosmeticChecks.ts` is the one validator the editor, the CLI, `npm run check` and the tests use.
- Authoring: editors' Cosmetics page and `npm run cosmetics` (list, check, add, set, remove, export, import, shot, sheet) share `src/editor/cosmetics/doc.ts`.
- Guards: sail colours cannot be dark or storm/damage red; emblems are flat filled SVG shapes of at most about 40 triangles; figureheads are prop recipes (group `figureheads`, at most 60 triangles); a personal flag may not copy any `flags.json` flag (regatta prizes, Kestrel); a regatta pennant item points to `flags.json`, is earned by its series and is never recoloured.
- Cosmetic identity is independent of upgrades: a pattern only supplies colours for the upgrade bands that #296 draws.

## Consequences

Adding an item is one file (docs/content/cosmetics.md). The game, the screen (#299) and saves (#298) store and read ids only. Earned unlocks are data, so quest and series ids are checked against the game. Item names for colours, patterns, hull colours, wakes and signal flags are drafts until the storyteller confirms them; figureheads exist for the four outposts only.
