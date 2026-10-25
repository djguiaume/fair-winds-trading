# 0178. Four equal sea quarters

**Status:** Proposed (2026-10-25). Agreed by the four sea threads, the storyteller and the art director; waiting on Guillaume's OK.

## Context

Phase 4 grows the sea round the Windward Ring into four biomes (decision 0137): ice north, fog east, tropics south, fire west. Each sea was laid out by its own thread, and nothing said how much of the outer ring each one owns. The south came first (0152) and spread over 160° of it (bearings 100..260), the east (0173) and west (0171) kept to about 55° each, the north (0170) to 90°. Guillaume asked for equal quarters and one chart of all four seas.

## Decision

- **Quarters centred on the compass points.** Compass bearings from the middle of the map (0 = north, clockwise): north 315..45, east 45..135, south 135..225, west 225..315. The main ports sit in the middle of their quarter (Rimewick ~350°, Fogwatch ~89°, Sunreach ~189°, Emberhold ~298°) and the gateways stay (Rime Gate, Gannet Sound, Keeper's Passage, Forge Gap).
- **Data:** `sectors` in `src/data/seas/grown.json`, `{ sea: [from, to] }`. `src/sim/seaSectors.ts` checks that every island (its whole beach circle), shape, mark, current, wind zone, chart area and waypoint of a sea lies inside its sector (0.5° slack), and that sectors do not overlap. The check runs in `npm run check` (phase4), `npm run sea` and the sea editor's check list.
- **Seen:** the editor's chart and `npm run chart` (grown sea, or a sea file) draw a dashed spoke at each border and the sea's name and span near the rim (`--sectors none` hides them).
- **Edited:** in the sea editor (`editor.html?sea=phase4`), each sea file's row has "its sector" under its name; and with `npm run sea -- set grown --sector east=45,135` (several with `;`, `none` removes one). New sea editor edits for the move: `move <what> <id> --turn deg` turns a thing round the middle of the map keeping its distance, `set <what> <id> --outline "…"` gives a shape, zone or area a new outline.
- **What moved** (south only; names, ports and quests unchanged, storyteller OK): Wreck Reef turned +20° (to ~141°, just north of The Glass), The Glass and its shoal +8°, Sugar Bar and its spit −15°, the unnamed islet west of Sunreach nudged 36 units clear of the spit, Cinder Isle turned −5° (to 305°, art director: clear of the north's tint blend), the Coral Line ends pulled in to 136.5° and 223.5°, The Trades and the chart areas recut to 135..225°. East's chart areas stretch to 135° and its Stepping Stones end at 133.5°; west's chart areas stretch down to 225° (ids kept: `calda-letter` charts `forge-gap` and `emberhold-waters`). The north (not on main yet) only clips two points of The Cold Sea at 45°. Steps: [docs/reviews/sea-quarters/steps.json](../reviews/sea-quarters/steps.json).
- **Borders (art director, art bible):** a barrier changes look only at a gap, never mid-reef; no mixed-rock blend; islands never straddle a border and follow their quarter's style; water tint blends over 60..100 units; every border gap gets something to look at. Here: a red and green buoy in the 3° gap where basalt Stepping Stones meet the Coral Line at 135°, a west cardinal at the Coral Line's west end (225°), and a chart light at each.

## Consequences

- East gains 100..135° and west 225..260° of empty sea for later content.
- Route checks pass on the grown sea, the long way to Palm Key for deep ships included. `npm run balance --map phase4` on all three levels: sloop leg medians move by at most 1 s (112/119/116 → 113/120/116 s), the longest leg gets shorter (263 → 236 s); the same checks fail as before (the grown sea is still a dev sea).
- A sea thread that adds anything past its border now fails `npm run check`; the north's PR clips The Cold Sea before it merges.
- Before/after charts (before.jpg, after.jpg) and junction shots (junction-135.jpg, junction-225.jpg): [docs/reviews/sea-quarters/](../reviews/sea-quarters/).
