# Difficulty levels: proposal

**Status:** Proposal for Guillaume to choose (2026-10-22). No game code yet. Decision draft: [0083](../../decisions/0083-difficulty-levels.md).

Guillaume: "game can be difficult which is a good and a bad thing. how can we go about making distinct difficulty levels?"

![Picker mockup: desktop, phone landscape, phone portrait and the Settings row](../../mockups/difficulty/difficulty-picker-overview.png)

Mockup source: [docs/mockups/difficulty/mock.html](../../mockups/difficulty/mock.html) (`node docs/mockups/difficulty/render.mjs` re-renders the PNGs).

## The rule: sailing stays honest

The audience is sailing fans first. So the boat sails the same at every level: polars, no-go zone, tacking, leeway, shallows drag, island lee and gusts, the press warning and the mooring rule never change. Difficulty only changes **what a mistake costs** and **how fast the trade pays**. A good sailor is rewarded at every level, and nobody learns a "wrong" boat on an easy level.

## What makes the game hard today

| Source | Where | What it costs now |
| --- | --- | --- |
| No-go zone, tacking, in irons | `noGoAngle` per class, `src/sim/ship.ts` | Time. Stays the same at every level. |
| Reef strikes and shore/pier/boat crashes | `STRIKE_DAMAGE` 6, `CRASH_DAMAGE` 5 per kn, `src/sim/hazards.ts` (0032, 0038, 0082) | Hull points, a leak that slows her up to 25 %, then repairs. |
| Repairs | `REPAIR_COST` 2 g per point (0046) | A 6 kn reef strike costs 72 g, about a third of an early leg. |
| Cargo overboard | `OVERPRESSED_KN`, `LURCH_*`, `src/sim/world.ts` (0067, 0074, 0078) | 1 unit per lurch or 3 s overpressed, gales and storms only. |
| Weather and storms | `DEFAULT_WEATHER`, `src/sim/wind.ts` (0067) | Gales 15 % of spells; a storm every 10 min. Both can be switched off. |
| Night | `src/sim/daylight.ts` (0068) | Harder to see reefs and coasts. Can be switched off. |
| Economy pace | port's cut 6 %, order reward × 1.5, start gold 150 (0046) | Relaxed captain: cutter after about 25 min. |
| Upgrade gates and town growth | `GROWTH_TO_LEVEL` 40/150/350, home port level gates (0059, 0065) | Top upgrades wait for Saltmere to grow; relaxed captain gets there after about 45 min. |
| Catch-up help orders | 0069 | Make it easier: kept at every level. |

## Three presets

| Knob | Fair winds | Captain (today, unchanged) | Old salt |
| --- | --- | --- | --- |
| Sailing (polars, no-go, tacking, shallows) | same | same | same |
| Cargo overboard | **off**; the sails still turn amber/red so you learn | 1 unit per lurch | **2 units** per lurch, same warning lines |
| Reef and crash damage | × 0.5 | × 1 | × 1.5 |
| Repairs (gold per hull point) | 1 | 2 | 3 |
| Port's cut on trades | 3 % | 6 % | 9 % |
| Order reward factor | 1.8 | 1.5 | 1.3 |
| Start gold | 250 | 150 | 100 |
| Town growth needed | × 0.75 | × 1 | × 1.25 |
| Gale share of weather spells | 8 % | 15 % | 22 % |
| A storm crosses the sea every | 15 min | 10 min | 7 min |
| Help orders | on | on | on |

Names follow the game's voice: **Fair winds** (the game's own name), **Captain** (the current mode is already called Captain), **Old salt** (an experienced sailor).

## Effect on pace (balance simulation)

`tests/difficulty-preview.test.ts` runs the 0046 balance sim with the preset knobs applied on top: income × 1.2 / 1 / 0.85 stands in for the port's cut and order changes, plus damage, repair price, growth thresholds and start gold. 150 minutes of play; the relaxed captain is the median of 9 seeds. Run it with `FWT_DIFFICULTY_SIM=1 npx vitest run tests/difficulty-preview.test.ts` (skipped in CI).

| Preset | Captain | 1st upgrade | Cutter | Cutter maxed | 1st town | Repairs / income |
| --- | --- | --- | --- | --- | --- | --- |
| Fair winds | sharp | 2.4 min | 9.3 min | 38 min | 15 min | 0 % |
| Fair winds | relaxed | 4.2 min | 19 min | 57 min | 37 min | 1 % |
| **Captain** | sharp | 4.9 min | 14.5 min | 46 min | 24 min | 0 % |
| **Captain** | relaxed | 7.3 min | 25 min | 80 min | 44 min | 3 % |
| Old salt | sharp | 4.9 min | 16.7 min | 72 min | 25 min | 0 % |
| Old salt | relaxed | 7.6 min | 40 min | 112 min | 68 min | 8 % |

Reading it: Fair winds lets a casual player reach the cutter about as fast as a sharp player does today. Old salt barely slows a sharp captain early (start gold is the only brake), but every mistake is felt: repairs reach 8 % of a careless captain's income and the long game takes about 40 % longer. The sim does not model cargo overboard, storms or night, so Old salt will feel harder at sea than these numbers say, and Fair winds softer.

## How it fits with the Settings switches

- **Two separate things.** The switches (Day and night, Weather, Storms, and Pirates in Phase 5) decide *what happens at sea*. Difficulty decides *what it costs*. They stay independent at every level, so a player can pick Old salt with storms off, or Fair winds with night on.
- The switches stay global (Settings, localStorage). Difficulty belongs to the voyage (see below).
- **Pirates (Phase 5)** get their own switch, as Guillaume asked. Difficulty then scales them like the rest: how often they show up and how much a boarding takes (for example, Fair winds: they chase and warn but take nothing; Old salt: they take more and patrol the long hauls).

## Changing it mid-voyage, and saves

- Picked on **New voyage** (the screen in the mockup). Captain is preselected.
- **Changeable at any time** in Settings › Voyage. It takes effect at once: prices and damage use the new values; orders already posted keep their reward; nothing is refunded or taken back. Forcing a restart to change it would punish exactly the player who is struggling.
- **Saved with the voyage**: a new optional `difficulty` field in the save (`'fair' | 'captain' | 'salt'`), so no save version bump. Older saves load as Captain, which is the game they were playing. Save transfer (0066) carries it for free.
- The save also keeps the **easiest level used** on that voyage, for later: racing missions and any best-times board can show it or require Captain. Racing missions pin their own difficulty, as they already pin wind and storms (0072).

## Kids mode

Kids mode (shelved in [0043](../../decisions/0043-shelve-kids-mode.md)) is a different axis: it changes the *presentation* (words instead of numbers, simpler screens), not the costs. When it comes back in Phase 7 it should be **Kids UI on top of Fair winds**, locked to it. Fair winds gives that rework its gameplay half for free; the difficulty picker is not Kids mode and does not hide any sailing numbers.

## Cost to build (once picked)

Small: one `difficulty.ts` table of knobs read by `hazards.ts`, `market.ts`, `contracts.ts`, `settlement.ts`, `world.ts` (cargo) and the weather config; one save field; the New voyage screen and a Settings row; EN/FR strings; tests that each preset hits its pace targets (the preview test becomes real targets). About one thread's work.

## Options for Guillaume

1. **Three presets as above** (recommended).
2. **Two levels only**, Fair winds and Captain: Old salt comes later with pirates, when "hard" has more to bite on.
3. **Three presets plus Custom**: the same table as individual sliders behind an "Advanced" button. More to test and explain; could be added later on top of option 1.
