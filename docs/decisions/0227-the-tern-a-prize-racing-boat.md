# 0227. The Tern, a prize racing boat

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
- **Pars** for her on all three levels come from `npm run race -- --all --pars --write`.
- **Save codes** keep reading codes made before her: the id lists a code can be read with moved to
  `src/sim/saveLayout.ts`, with the ship list before the Tern beside the goods and ports ones.

## Consequences

- The club series (`regatta-club`) needs `"prize": "tern"` once the club races land.
- Every new ship file appended to the list needs the same legacy entry in `saveLayout.ts`.
