# Fair Winds Trading — Game Roadmap (draft v1)

A top-down, low-poly sailing and trading game for the browser. The visual style follows the *Privateers: Pirate Wars* ad ([screenshots](reference/), teal stylized ocean, sandy islands with soft glow, chunky wooden ships, floating UI bars), but the core loop is **sailing with the wind and delivering goods**, not combat.

## Name shortlist

| Name | Repo slug | Why |
|---|---|---|
| Tradewind Isles | `tradewind-isles` | Says both pillars at once: trade and wind. Easy to search. |
| Leeward | `leeward` | Short, nautical, elegant; less obvious about trading. |
| Saltroute | `saltroute` | Evokes trade lines and shipping routes. |
| Beam Reach | `beam-reach` | Sailing term for the fastest point of sail; nice for sailors, obscure for others. |
| **Fair Winds Trading** (chosen) | `fair-winds-trading` | Cozy, company-builder vibe; long. |

## Design pillars

1. **The wind is the terrain.** Routes are hard because of wind direction and strength, not because of enemies. Upwind needs tacking; downwind is fast.
2. **Every delivery matters.** Settlements visibly grow from the goods you bring.
3. **From captain to shipping magnate.** You start hand-sailing one sloop and end up running a network of automated routes.
4. **Readable and charming.** Low-poly, bright, top-down, playable in short sessions.

## Core loop

Pick up goods at a settlement → read the wind → sail (tacking when needed) → deliver for profit → settlement grows and asks for new goods → buy a better ship or open a route → repeat with farther, harder destinations.

---

## Phase 0 — Sailing prototype ("does sailing feel good?")

Goal: one boat on an empty ocean that is fun to steer.

- Top-down camera following the boat, stylized ocean, a couple of islands with collision.
- Wind: one global direction and strength, shown by a wind arrow/vane and drifting particles.
- Sailing model: boat speed depends on angle to the wind (no-go zone ~45° upwind, best on beam/broad reach); sail trim auto or one key.
- Controls: steer left/right, raise/lower sails. Keyboard first, touch later.
- Wake trail and a simple speed readout.

**Done when:** tacking upwind to reach an island is a small, satisfying challenge.

## Phase 1 — MVP: one-captain trading

Goal: a complete, short game loop someone else can enjoy for 15 minutes.

- A small archipelago (5–8 islands), 3–4 settlements, each producing one good and wanting others (e.g. fish, timber, grain, cloth).
- Docking: slow down near a port to open a trade panel; buy, sell, accept delivery contracts.
- Cargo hold with limited capacity; prices vary by supply and demand per settlement.
- Gold as currency; one ship upgrade (bigger hold or better sails).
- Wind that shifts slowly over time so the same trip changes.
- Minimap with port markers and current wind.
- Floating labels over ports in the ad's style (name, level badge, what they want).
- Save to the browser (local storage).

**Done when:** you can earn enough to buy the upgrade and feel the difference.

## Phase 2 — Living settlements

Goal: deliveries visibly change the world.

- Settlements have a level and population; meeting demand levels them up (more buildings on the island, bigger dock).
- Higher levels unlock new demands, including goods produced only on distant islands.
- Demand decays if unmet, so neglected towns stall.
- Simple production chains (timber → planks, grain → bread) at higher-level towns.
- Day/night cycle and weather states (calm, breeze, gale) affecting wind strength.

## Phase 3 — Fleet and automated trade routes

Goal: shift from sailing every trip to designing a network. This is the main twist on the reference game.

- Buy additional ships of different classes (sloop: fast, small hold; brig: balanced; fluyt/merchantman: big hold, poor upwind).
- Route editor: pick ports in order, what to load/unload at each, and assign ships.
- Automated ships sail with the same wind model; routes that fight the wind are slow, so route design is a puzzle.
- Route dashboard: trips, profit per route, delays.
- Player can still captain any ship by hand (e.g. to rush an urgent contract).

## Phase 4 — Expansion and harder seas

Goal: growth pushes you outward into tougher navigation.

- Larger, explorable map with fog of war; discover new islands and settlements.
- Regional wind patterns: trade-wind belts, doldrums with almost no wind, variable stormy zones, seasonal shifts.
- Currents, reefs and shallows that block bigger ships.
- Big settlements demand exotic goods from far regions, forcing long routes.
- Ports you can found or upgrade (warehouses, shipyards) to act as relay hubs.

## Phase 5 — Polish and optional extras

- Sound: waves, creaking hulls, sails, ambient port music.
- Ship cosmetics (sail colors, flags, figureheads).
- Light hazards instead of heavy combat: storms, pirates you outrun rather than fight (optional, can stay out).
- Mobile/touch controls and responsive UI.
- Achievements, scenario maps, maybe shareable seeds.
- Possible later: online leaderboards or shared world (needs a backend; decide much later).

---

## Out of scope for now

- Ship-to-ship combat as a core feature (the reference game's focus; we deliberately trade it for logistics).
- Multiplayer and monetization.
- Tech stack choice: proposed in [decision 0005](decisions/0005-tech-stack.md), waiting for confirmation before Phase 0 starts.

## Open questions for the tech-stack discussion

- ~~True 3D or 2.5D?~~ Decided: real-time 3D low-poly ([decision 0004](decisions/0004-real-time-3d.md)). Which 3D engine?
- Desktop-first or mobile-first controls?
- How much simulation runs for off-screen automated ships (needed from Phase 3)?
