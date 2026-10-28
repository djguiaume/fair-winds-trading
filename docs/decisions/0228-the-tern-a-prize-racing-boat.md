# 0228. The Tern, a prize racing boat

**Status:** Proposed (2026-10-28), pending Guillaume's OK of the look.

## Context

The Sailing Club's six races (#260) end with the club pennant. Guillaume wants a fast, light boat
as the prize: new art, almost no hold, a sister to Wren's *Kestrel* (`docs/story/club-words.md`).
The art director picked the slim one-mast gaff cutter (Guillaume pointed at real gaff racers).

## Decision

- **A new ship file** `src/data/ships/tern.json`, line `racer` (a fourth line beside swift and
  hauler), tier 1: cream hull, deep blue band, tall mast with gaff main and topsail, two jibs,
  hold 4, faster than the Cutter and about the Clipper's pace on the race pars.
- **No yard sells her.** A class no port lists in `builds` and with `standing` above 0 has no
  yard on any map, so she shows in the fleet only once owned.
- **A series can name a `prize` ship** (`regatta.json` series, `src/sim/seriesPrizes.ts`): she
  joins the fleet at stock levels the moment the series is won, never switched to by herself.
  Editable on the editor's Regatta page and with `npm run race -- series <id> --prize tern`.
- **The masthead flies a brass pennant** from the ship file's `model.pennant` (`flags.json`
  `tern`) until a regatta pennant is won.
- **Three boats (Guillaume, 2026-10-28):** `tern` (gaff cutter, the prize), `tern-pilot` (Bristol
  Channel pilot cutter, beamier, hold 12) and `tern-yawl` (gaff yawl, hold 8). The quest engine
  can offer a pick-one step (`choose`) but has no ship reward and no "series won" start, so the
  prize stays the Tern; the other two have `unlock.series` set to the club series: no yard offers
  them until it is won, then the yard that lists them in `builds` (Abbey Head) sells them.
  Prices 6000 and 7000 are placeholders for the storyteller.
- **Pars** for them on all three levels come from `npm run race -- --all --pars --write`.
- **Save codes** keep reading codes made before her: the id lists a code can be read with moved to
  `src/sim/saveLayout.ts`, with the ship list before the Tern beside the goods and ports ones.

## Consequences

- The club series (`regatta-club`) needs `"prize": "tern"`, and Abbey Head `builds` needs `tern-pilot` and `tern-yawl`, once the club races land.
- Every new ship file appended to the list needs the same legacy entry in `saveLayout.ts`.

- **Not in the engine yet:** a quest reward that gives a ship, and a quest start on "series won", so a pick-one prize (a `choose` step with a ship per option) is not possible; the prize is fixed and the other boats are sold. Tracked as idea issue #315 for v1.2.
