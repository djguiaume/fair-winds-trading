# 0035. Three ship lines: swift, warship and hauler

**Status:** Accepted direction, 2026-10-19 (Guillaume asked for it; numbers are starting values to tune in play). Refines [0011](0011-ship-lineup-and-upgrades.md) and builds on [0030](0030-home-base-upgrades-and-earned-ships.md). Numbered 0035 to leave 0033–0034 free for parallel threads.

**Context:** Guillaume wants more ship diversity: the player should be able to go down one of three boat categories, roughly *fast and agile* (less firepower, average cargo), *slow with lots of firepower* (low cargo) and *lots of cargo* (less firepower, slow), balanced by Claude. Today [0011](0011-ship-lineup-and-upgrades.md) is a single ladder (sloop → cutter → schooner → brig → fluyt) where each ship is mostly "bigger", and firepower does not exist yet. [0030](0030-home-base-upgrades-and-earned-ships.md) already says new classes are built at discoverable ports and unlocked by deliveries there, which fits several lines well.

**Decision:**

The sloop stays the all-round starter. After it, ships come in **three lines with three tiers each**. Each line has one clear strength, one average stat and one clear weakness, so no ship is best at everything:

| Line | Strong | Average | Weak | Identity on the model |
|---|---|---|---|---|
| **Swift** (fast and agile) | speed, turning, points high into the wind | cargo | firepower, hull | slim hull, tall fore-and-aft rig, light sails |
| **Warship** | firepower, hull | speed downwind | cargo, upwind, turning | wider hull, gun ports, dark trim |
| **Hauler** (cargo) | cargo | hull | speed, turning, upwind | deep round hull, deck cargo, pale patched sails |

Starting stats (sloop = 100 for speed and turning; hold in cargo units; guns = cannons, used from Phase 5; hull = health against reefs, storms and later cannon fire):

| Tier | Ship | Line | Speed | Turn | No-go | Hold | Guns | Hull | Price |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Sloop | starter | 100 | 100 | 45° | 10 | 0 | 100 | starter |
| 1 | Cutter | Swift | 110 | 105 | 40° | 16 | 2 | 90 | 1 500 |
| 2 | Schooner | Swift | 125 | 110 | 38° | 30 | 4 | 110 | 5 000 |
| 3 | Clipper | Swift | 145 | 105 | 40° | 50 | 6 | 130 | 20 000 |
| 1 | Ketch | Warship | 90 | 90 | 50° | 8 | 6 | 150 | 2 000 |
| 2 | Brig | Warship | 100 | 85 | 55° | 16 | 14 | 220 | 8 000 |
| 3 | Frigate | Warship | 105 | 80 | 55° | 24 | 28 | 340 | 30 000 |
| 1 | Hoy | Hauler | 85 | 85 | 50° | 25 | 0 | 120 | 1 800 |
| 2 | Fluyt | Hauler | 80 | 75 | 55° | 60 | 2 | 160 | 7 000 |
| 3 | Indiaman | Hauler | 85 | 70 | 55° | 120 | 8 | 240 | 25 000 |

How it balances:

- **Gold per trip:** at the same tier a hauler carries about 2× a swift ship and 4× a warship, but swift ships make more trips, especially upwind where their narrow no-go zone saves long tacks. On an upwind route a schooner should roughly match a fluyt's income; on a downwind route the fluyt wins. That keeps the wind ([0007](0007-arcade-sailing-with-tacking.md)) at the centre of the choice.
- **Danger (Phase 5):** swift ships survive pirates by outrunning them, warships by fighting, haulers by hiring an escort or arming up and accepting the risk. Firepower is worthless before pirates, so warships carry little cargo for a reason that only pays off once pirates exist.
- **Price:** warships cost the most per tier and haulers slightly more than swift ships, because hold is the stat that earns gold directly.
- Square rigs (brig, frigate, fluyt, indiaman) keep the [0011](0011-ship-lineup-and-upgrades.md) rule: wider no-go zone, better downwind.

Progression and unlocks ([0030](0030-home-base-upgrades-and-earned-ships.md)):

- The player is not locked into a line: they can buy into any line they have unlocked and switch owned ships at the home base. Choosing a line is a play-style choice, and in Phase 3 a mixed fleet is the natural end state.
- Each line has its own shipwright at a different port. Tier 1 needs little standing, tiers 2 and 3 need more deliveries there. Proposed placement on the Windward Ring ([0031](0031-windward-ring-map.md)), to confirm when the unlock system is built: the cutter stays at the home base (Phase 1 goal), the **swift yard** at Watchman Key, the **hauler yard** at Abbey Head, and the **naval yard** arrives with pirates in Phase 5.
- Upgrades keep the three tracks (sails, hold, hull) at the home base. Phase 5 adds a fourth track, **guns**, so any ship can arm a little, but a line's base stats always dominate (an armed hauler stays weaker than a stock warship of the same tier).

**Consequences:**

- Supersedes the [0011](0011-ship-lineup-and-upgrades.md) lineup table: the brig becomes the tier 2 warship (hold 50 → 16), the fluyt becomes the tier 2 hauler (hold 100 → 60, with the indiaman as the new giant) and the schooner stays the tier 2 swift ship. Four new classes: clipper, ketch, frigate, hoy. The cutter and sloop are unchanged, so Phase 1 code needs no change now.
- `ShipClass` (src/sim/ship.ts) will gain `line`, `tier`, `guns` and `hull` fields when the next ships are built; speed and turning above map to `speedRatio` and `turnRate` relative to the sloop.
- Six new code-built models ([0014](0014-code-built-models-for-now.md), [0016](0016-game-models-style-d-and-b2.md)), each needing a clearly readable silhouette per line, also on the phone.
- Phase 3 ships the swift and hauler lines; the warship line and the guns track wait for Phase 5. The Phase 3 route editor can then show which line suits a route (upwind or downwind, valuable or bulk).
- Ship health needs a real hull points value per class, which [0010](0010-light-hazards-pirates-later.md) already asked for.
