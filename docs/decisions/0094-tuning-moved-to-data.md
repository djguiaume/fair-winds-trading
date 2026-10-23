# 0094. Tuning moved to data

**Status:** Implemented for review (2026-10-23). Step 1 of [0093](0093-data-driven-content-and-authoring-tools.md), requested by Guillaume.

## Context

[0093](0093-data-driven-content-and-authoring-tools.md) accepted a data-driven game: tuning numbers in JSON, read live so a `?tune` panel can change them while sailing, with a meta file that drives the panel. Before this change the numbers were TypeScript constants spread over 16 sim files: about 80 named values, the 7 ship classes (20 values each), the 3 difficulty levels (10 values each), the upgrade effects, the goods and the Phase 2 weather.

## Decision

1. **Seven files in `src/data/tuning/`**, one per subject, generated from the old constants:

   | File | What | From |
   |---|---|---|
   | `ships.json` | the 7 classes by id: polar, speeds, turning, hold, prices, standing | `ship.ts` |
   | `upgrades.json` | `effects` per level, `homePortLevel` per upgrade level | `upgrades.ts`, `settlement.ts` |
   | `goods.json` | per good: name, base price, icon, `madeFrom` for specialties | `goods.ts` |
   | `economy.json` | `market`, `towns`, `orders` (help orders included), `discoverRange` | `market.ts`, `settlement.ts`, `contracts.ts`, `shipyards.ts` |
   | `difficulty.json` | the 3 `levels` and the `steadyWind` settings | `difficulty.ts` |
   | `weather.json` | the Phase 2 weather (`default`), `storms`, island lee and channels, wind force bands, daylight, setting blend | `wind.ts`, `storms.ts`, `windStrength.ts`, `daylight.ts`, `world.ts` |
   | `seamanship.json` | `boat` (world scale, overpowered wind, shipyard reference breeze), `hazards`, `harbour` (docking, mooring, buoys), `cargo` (press and cargo overboard) | `boat.ts`, `hazards.ts`, `trade.ts`, `world.ts` |

2. **One live object.** `src/data/tuning.ts` exports `TUNING` (a copy of the files), `SHIPPED_TUNING` (the files as shipped) and `resetTuning()`. Sim code reads `TUNING.group.value` when it needs it; scalar constants are gone. Object constants that many files use (`SLOOP`…`INDIAMAN`, `SHIP_CLASSES`, `GOOD_DEFS`, `DIFFICULTY`, `UPGRADE_EFFECTS`, `DEFAULT_WEATHER`) stay as names but are the objects inside `TUNING`, so they are live too. Rule: **change values in place**, never replace a whole group; `resetTuning()` copies the shipped values back in place for the same reason.
3. **Angles in degrees.** Ship classes store `noGoDeg` and `turnRateDeg` (what a person tunes) and `noGoAngle(ship)` / `turnRate(ship)` give radians. Storm inflow and lee spread are degrees too.
4. **Duplicates folded into Captain.** `START_GOLD`, `SPREAD`, `CONTRACT_PRICE_FACTOR` and `REPAIR_COST` were copies of the Captain level's `startGold`, `spread`, `orderFactor` and `repairCost`; defaults now read Captain's knobs, so there is one place to tune each.
5. **`src/data/tuning-meta.ts`**: label, min, max, step, unit and one line of help per value, keyed by path with `*` for ids (`ships.*.hold`). Kinds: number (also lists of numbers), polar, toggle, text. The panel will build itself from it.
6. **Ids stay in code** for this step (`SHIP_IDS`, `GOODS`, `DIFFICULTIES`, `WEATHER_KINDS`); content as data (step 1b) moves them.
7. **Not moved**, as planned in 0093: physics formulas and their fixed shape constants (sail easing, rudder, leeway mix, ray sample spacing), the render-only heel factors and hull shapes (they join the ship files in 1b as `model`), collision geometry, save keys, the tutorial.

## Tests

`tests/tuning.test.ts`:

- the files have exactly the ids the code knows, and list lengths match the levels;
- every value has a meta entry, inside its range and on its step, and no meta entry is left over;
- every polar runs 0° to 180°, sorted, fractions 0 to 1;
- live edits reach the sim (market recovery, base price, no-go zone, force bands, daylight) and `resetTuning()` restores the files without breaking references;
- **every moved value equals the old constant** (one line per old name, ship classes compared back in radians). This block pins the move only: when a value is changed on purpose, delete the block rather than edit it; the economy and difficulty balance tests stay the safety net.

All 59 existing test files pass with the existing numbers, so play is unchanged.

## Consequences

- Guillaume can change any number by editing a JSON file on GitHub; CI runs the balance tests on it.
- New numbers (Phase 3 fleets and routes) are born in these files with a meta line, or the meta test fails.
- Caches keyed by weather config objects (weather walk, difficulty-shaped weather) do not notice a live edit of the weather; the tuning panel (step 2) must clear them when it changes weather values.
- Sim code reads a property where it read a constant; no measurable cost.
