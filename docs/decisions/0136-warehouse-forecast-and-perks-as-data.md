# 0136 — Warehouse, weather glass and building perks as data

- Status: Implemented for review
- Date: 2026-10-24
- Builds on: [0126](0126-home-island-build-spots.md), [0128](0128-build-spots-on-any-island.md), [0093](0093-data-driven-content-and-authoring-tools.md), [0118](0118-compact-save-code.md)

## Context

The home island shipped (0126, 0128) with two of its eight buildings marked "coming soon": the
warehouse (keep crates between voyages) and the weather glass (see the wind ahead). Each building's
modifier was one `effect: { kind, value }` in `buildings.json`, and the kinds were TypeScript
names read in a few places. Guillaume asked for the two buildings to work, and then for perks to
be data too ("Perks should also be data"), so islands in extensions can mix buildings and perks
without code.

## Decision

**Perks have their own file, `src/data/perks.json`.**

- `hooks` lists every game number a perk can change, with a plain description: `repairPrice`,
  `sailUpgradePrice`, `shipPrice`, `helpReward`, `discoverRange`, `hullDamage`, `storageRoom`,
  `forecastSec`. A hook is the one place the game reads that number, through
  `applyPerks(home, hook, base)` (`src/sim/perks.ts`). Adding a hook is a code change (a new
  place to read); a new perk on an existing hook is data only.
- `perks` are `{ id, hook, multiply?, add?, where? }`: the number is multiplied by every
  `multiply`, then every `add` is added. `where: "island"` works only while moored at the island
  the building stands on (the workshop's repairs, the warehouse's room); otherwise anywhere.
- Buildings list perk ids (`"perks": ["home-repairs"]`); a building can have several. A perk counts
  once however many of its buildings stand (the same building on two islands does not stack).
- `checkPerks()` reports unknown or undescribed hooks, duplicate perks, perks with neither number,
  bad `where`, and buildings naming unknown perks; a test keeps it empty.
- Card text comes from `perk.<id>` (`{pct}` from `multiply`, `{n}` from `add`) and the small kind
  label from `hook.<hook>`, in `en.json`/`fr.json`.

**Warehouse** (`warehouse-room`: `storageRoom` +10, at its island). While moored at an island with
room, a **Warehouse n/max** button in the home bar opens a card with a row per good (aboard and
kept), and Store 1 / Store all / Take 1 / Take all. Storing is capped by the room left and the
cargo aboard; taking by free hold space. Kept goods have no price and never spoil. Each island
keeps its own (`home.islands[id].stored`).

**Weather glass** (`wind-forecast`: `forecastSec` +60, anywhere). A dim line under the weather
text reads "In 1 min: NE · 15 kn" (orange with "storm" when a squall is due). The wind is
deterministic (`windAt`), so the forecast is the real wind at the ship's position `forecastSec`
ahead, averaged over `economy.json › home.forecastSmoothSec` (10 s, in `?tune`) so gusts do not
make it flicker. Refreshed twice a second.

**Save.** Stored goods are in the JSON save and in the FW2 home section, now layout 3: per owned
island, after its spots, a count then (good index, quantity) pairs. Layouts 1 and 2 still read. A
30-port sea link with quests, home and stored goods is 701 characters (under 1,000, 0118).

## Consequences

- All eight buildings now do what their card says; no "coming soon" text is left.
- Tuning a perk (25% cheaper repairs, 20 crates of room, two minutes of forecast) is a JSON edit,
  checked in tests. Extension islands can define new buildings from existing perks with no code.
- A perk on a new kind of number still needs one `applyPerks` call where that number is read and
  a hook in `HOOKS`; the checks flag a hook added on one side only.
- Old `effect.*` / `effectKind.*` text keys are renamed `perk.<id>` / `hook.<hook>`.
- Screenshots: [home island review](../reviews/home-island/README.md#built-2026-10-23).
