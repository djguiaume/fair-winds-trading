# 0264. Boat looks screen: wardrobe layout and turntable preview

**Status:** Accepted (2026-11-01), part of v1.4 (#299).

## Context

v1.4 needs a screen where the player dresses each owned ship from the catalogue (decision 0261), saved per ship (decision 0263). Two static mockups (`docs/mockups/boat-looks/mockups-a-b.jpg`): A "Garage" (tabs over a grid, Forza) and B "Wardrobe" (a slot list beside the boat, Pokémon Z-A, Sea of Thieves, AC4's harbour master). Guillaume and the art director picked B: every slot is one press away on a controller, and the list shows what each slot wears.

## Decision

- **Layout B.** Slot rows on paper at the left (Colours, Patterns, Logos, Hull, Figurehead, Flag, Wake), the boat in the middle, the slot's items at the right. Phone portrait: the boat on top (at least 40 % of the height), the slots as one row that snaps, four items a row.
- **Try on, then Use.** A tap tries an item on the boat, locked ones too, so the player sees what to earn. **Use** keeps that slot through `setShipLook` (all or nothing), and leaving puts back what she had. Locked items show a lock and "Earn it: {how}". Unlocks are read from the voyage (`src/sim/cosmeticUnlocks.ts`: quest done, series won), never stored.
- **Compare** Stock, Yours and All upgrades on the same look without buying anything; day or night uses the game's own light.
- **Turntable preview** `src/render/boatPreview.ts`: the real model (class, upgrades, damage, look) on a slow turn, locked to the waterline over a soft disc of sea, with its own small WebGL context made on open and freed on close. Free Sailing (#300) reuses it. Its numbers are in `src/data/boat-preview.json`. Figurehead tiles are the real carving, drawn once in the same context.
- **Flat pictures** of a look (sail swatch with pattern and emblem, hull, wake, flag) are one module, `src/ui/lookPictures.ts`, shared with the editors.
- **Controls.** The screen is a modal `<dialog>`: rows are tabs (LB/RB), A tries on, X uses, LT/RT compare, B or Esc leaves; Q and E turn her. Nothing needs hover.

## Consequences

The Shipyard tab carries a "Boat looks" button; the screen changes nothing about sailing, prices or unlock places. Logos, the new patterns and wake styles show on the turntable boat as #418 draws them. A paid kind would only add a price line to the detail strip (storyteller's voice rules); nothing of it is built.
