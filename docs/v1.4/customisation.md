# Boat customisation: system design (#295)

Guillaume, 2026-10-31: "Sails must be really customisable visually. Colours, patterns, logos (animals, wind, volcanos...), flag also, maybe even the boat's water trail. If we add micro transactions, that's where it will start. It must be easy to add items. Customisation needs its own screen." Availability so far: sail colours and patterns free; figureheads and pennants earned (story, regattas); no coin prices; the Tern stays a single gift. Release scope (which part ships when) belongs to the release lead.

## How similar games do it (what we copy)

| Game | What we take |
| --- | --- |
| Pokemon Legends Z-A (outfits, see `docs/ui-refactor/style-e/references.md`) | One slot list, one big white selected row, the character previewed live beside it, "new" dots |
| Rocket League (garage) | Slots including a **trail** (boost) and a flag-like topper; paint as a colour on top of an item; saved loadouts; "how to unlock" on locked items |
| Sea of Thieves (shipwright, emporium) | Matching ship sets (sails, hull, figurehead, flag) plus single pieces; cosmetic only, never stats; the shop is where paid items started |
| Forza (livery editor) | Layers: base colour, pattern, decal on top; decals have a fixed place, we do not offer free placement |

Pirate and boat games (Guillaume, 2026-10-31):

| Game | What we take |
| --- | --- |
| Assassin's Creed IV Black Flag (the Jackdaw) | Sails, figurehead, wheel and hull paint picked at the harbour master; most pieces **found or earned at sea** (wrecks, treasure maps, quests), a few in DLC packs. Unlocks are trophies of a voyage |
| Skull and Bones | Per-ship looks in a dedicated customisation screen: hull paint and pattern, sail look, figurehead, flag, emblems; shown on the ship before buying; paid items live beside earned ones |
| Sea of Thieves | Matching full sets per theme (above); the flag you fly says who you are; the shipwright on the dock is the in-world way in |
| World of Warships | Camouflage patterns and signal flags as small, stackable cosmetic items; the bought ones are cosmetic only in our version (theirs add bonuses, we do not) |

So for us: earned pieces come from voyages and quests (a volcano logo after the volcano quest, a seal after the seal colony), the harbour shipyard is the in-world door to the screen, and sets are themed (Sailing Club, East Wind, Ember Isles).

Rules from them: cosmetics never change sailing; every locked item says how to get it; preview before equip; one tap back to "stock".

## Slots

| Slot | Item kinds | Colour channels | Notes |
| --- | --- | --- | --- |
| Sail colour | swatch | 1 cloth | The canvas tint; clamped so sails never go dark or red (storm / damage reserved hues) |
| Sail pattern | plain, bands, stripe, panels, halves, chevron, diamond | 2 (pattern, trim) | Pattern replaces the upgrade bands' colours, never their places: sails 1/2/3 still read |
| Sail logo | animals, wind, volcano, compass, star, anchor... | 1 | On the mainsail (and the main course on square riggers) in a fixed spot; hidden by the racing number while racing |
| Hull colour | swatch | 2 (band, strake) | Copper bottom stays as the hull-3 sign |
| Figurehead | per class mount | 0 | ≤ 60 triangles, merged in the hull, gone at far LOD |
| Flag | pennant, swallowtail, burgee + colours | 3 bands | Earned regatta pennants are their own locked items, never recolourable |
| Wake trail | plain, foam sparkle, glow (night), bubbles | 1 | A tint and pattern on the existing wake; Settings switch; off on Low |
| Set | a named bundle of the above | – | Quick apply; also the unit a shop would sell |

Every item works on every class at every upgrade level; the validator refuses one that does not.

## Items are files (easy to add)

- One JSON file per item: `src/data/cosmetics/<slot>/<id>.json` with `id`, `slot`, names (EN/FR keys), `unlock`, look data. Same shape as props (decision 0135).
- Logos: an SVG file next to the JSON (`logo-otter.svg`), flat filled shapes only, at most about 40 triangles once filled; turned into sail geometry at load (three's SVGLoader), drawn like the racing number (decision 0217). No textures.
- `unlock`: `free`, `earned` (`{ quest | regatta | milestone }`), a paid kind can be added later but is not built. The save keeps an owned list and each ship's equipped look per slot.
- Tool and editor share one module (decision 0153): `npm run cosmetics -- list | check | add <slot> <id> | shot <id>`, and a Cosmetics tab in the editor with live preview.

## Ready for paid items, not building them

A paid kind would be one more `unlock` value (`store` with an `sku`), not built now. Nothing about a shop, prices or payments is built in v1.4: phone stores need their own in-app purchase rules (see decision 0204, parked) and Guillaume decides any prices. Paid items stay cosmetic only and the free set must look good on its own.

## The screen

Its own screen, opened from the shipyard tab and from the title menu's Free Sailing. Left: slot list (Z-A style rows). Middle: the boat, turnable, in day or night light, with the selected item on it. Right/bottom on phone: item grid with locked items and how to earn them, a "new" dot, the set's name. Buttons: equip, back to stock, save as set. Pad, touch and keyboard. A static mockup comes before any build (Guillaume prefers mockups).

## Budgets

Colours and patterns: 0 extra triangles, 0 draw calls. Logo ≤ 40 triangles, figurehead ≤ 60, both merged. Wake trail: uniform changes only on the existing wake, no particles on Low.
