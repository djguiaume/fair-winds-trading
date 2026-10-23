# Later extensions: steam, harbour logistics, pirates and the great expedition

**Status:** Planned later design directions, not implemented or scheduled. Steam/automation are explicitly deferred; pirates retain their existing later-roadmap intent.
**Updated:** 2026-10-23.
**Related:** [three progression candidates](README.md), [decision 0097](../../decisions/0097-progression-candidates-and-later-extensions.md), [roadmap](../../roadmap.md).

The base sailing/trading game must have satisfying progression and a conclusion without either extension. “Expansion” or “DLC” describes a possible scope boundary, not an approved paid product. Release order and pricing are undecided.

## Rules shared by both

- No progress while the game is closed. No wall-clock catch-up on resume.
- Pause/suspension stops deliveries, production, construction, threats and costs.
- Preserve existing voyages, ship classes, art silhouettes and upgrade combinations.
- Keep manual sailing relevant and retain the older-tablet/three-quality-level budget.
- An extension cannot be required to finish the base story.

## Steam and harbour logistics

### Intent and introduction

Small, relatively slow wooden steam launches provide dependable local transport independent of wind. The player should be able to acquire and captain one. Autonomous supply assignments are a separate later feature: first validate manually piloting, fueling and balancing the boat; then prove automation improves play.

A mechanic's quest and a suitable harbour facility could introduce the technology. Their precise location depends on the chosen base direction, so a player-owned island is not a prerequisite. The art direction must deliberately accommodate early steam technology.

### Balance hypothesis

| Attribute  | Small steam boat                                   | Large sailing vessel                                      |
| ---------- | -------------------------------------------------- | --------------------------------------------------------- |
| Propulsion | Predictable movement independent of wind direction | Wind, polar and seamanship determine performance          |
| Speed      | Modest consistent cruise                           | Superior speed in suitable conditions, depending on class |
| Capacity   | Machinery and fuel reduce usable space             | Haulers retain a large bulk advantage                     |
| Range      | Fuel and available refuelling matter               | Suitable for long passages without propulsion fuel        |
| Costs      | Fuel and machinery maintenance                     | Lower propulsion costs; existing repairs remain           |
| Role       | Short, awkward upwind crossings and local supplies | Long-distance trade, exploration and bulk movement        |

No numerical stats have been chosen. Compare route time, net profit, usable hold and endurance over short upwind, short reaching and long bulk routes. Steam must win some jobs and lose others; it must not become the universal last-tier upgrade. Compare against swift vessels as well as haulers.

Fuel should create planning choices, not constant button presses. Show clear endurance information and provide forgiving recovery if stranded. Random breakdowns are not part of the proposed minimum scope.

### Automation proposal and compute implications

Steam avoids tack planning and wind-dependent heading/speed changes. It does **not** permit sailing through islands, reefs, ships or piers. Slow speed alone does not make simulation cheaper.

For a limited first implementation:

- Use known ports connected by authored or precomputed safe sea lanes.
- Calculate a path on assignment or a meaningful change, not every frame.
- Track distant vessels as progress along path segments with bounded coarse updates.
- Render nearby boats; validate consistent arrivals/cargo between distant and nearby states.
- Start with a small vessel-count cap and one simple supply assignment.
- Include warehouse limits, spending reserves, valid cargo and a clear stop condition.

A possible assignment is “bring timber from Calda while home storage is below its target; preserve a gold reserve.” Values belong in data. Congestion, docking, running costs, missing fuel, unavailable stock and changes of destination still need rules. The offscreen route simulation operates while the player is actively playing; it is not offline progression.

Automated sailing ships could also use coarse simulation, so steam is a gameplay and implementation choice rather than a requirement for optimization. No performance gains have been measured.

## Pirates and contested passages

### Intent

Add optional voyage risk and different responses: notice danger, avoid it, escape, protect cargo or fight. Existing plans include pirate sightings on the chart, pursuit of loaded merchants, difficulty scaling, escorts and the ketch/brig/frigate line with guns. Naval combat is new work; current hull damage and repairs are only part of its foundation.

Begin with readable sightings, limited pursuit and forgiving consequences before committing to large battles. Define pursuit, disengagement, boarding, recovery and rewards. Do not make every profitable crossing a compulsory fight or every merchant need a warship.

### Guardrails

- Keep the Settings switch and per-difficulty scale from ADR 0083.
- Story progress must have compatible alternatives when pirates are disabled.
- Swift vessels can escape; merchants can avoid danger; warships have protection/combat roles with economic trade-offs.
- Escort automation depends on additional AI and must not be assumed free or available before logistics.
- Island raids, destroyed player buildings, territorial conquest and armies are separate scope decisions, not part of simply adding pirates.
- No raids, repairs, costs or cargo losses while closed or paused.

### Costs and risks

Pursuit and navigation AI, ship-to-ship collision, targeting, projectiles, damage feedback, UI, audio, saves and difficulty balancing make full combat a high-cost extension. Its greatest design risk is displacing trade and sailing with compulsory fighting. Its greatest performance risk is simultaneous ships, projectiles and effects; cap and profile them before expanding encounters.

## Fit with every base direction

| Base direction        | Steam / logistics                                             | Pirates                                                   | Main caution                                                                              |
| --------------------- | ------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Personal island       | Harbour services, mechanic, optional local supply boats       | Risk on incoming/outgoing voyages and protection missions | Do not assume raids or create offline defence obligations                                 |
| Connected communities | Technology story and reliable links between established ports | Restore safe passage and respond to shared threats        | Automation must not erase the player's relationship with ports                            |
| Great expedition      | Alternate propulsion strategy with fuel/range planning        | Hostile passages with evasion or confrontation choices    | Steam must not bypass the whole challenge; pirates cannot be required for the base finale |

Connected communities accommodates both most naturally. The personal island gives steam the clearest physical home. The expedition gives pirates a clear dramatic role. These are design assessments, not reasons to select a core direction prematurely.

## Proposed validation order

1. Finish choosing and validating the base progression.
2. Validate one player-controlled steam launch and its economy before automation.
3. Test one bounded supply assignment against manually completing the same job.
4. For pirates, test one readable encounter with viable evasion and recovery before escalating combat.
5. Test compatibility with each supported base progression, saves/transfers, difficulty switches and physical target devices.

Steps 2–4 do not establish a release order between the two extensions. Separate decisions are needed for exact rules, vessels, pricing, combat and distribution.

## The great expedition

Moved here from the base-game candidates by [0120](../../decisions/0120-communities-and-home-island.md) (2026-10-23). The idea is unchanged from [direction C](README.md#c-prepare-for-a-great-expedition) and its [mockups](directions/README.md#c-the-great-expedition): a known, intimidating destination past a storm belt, optional preparation, two approaches, refuges, turning back that keeps what you learned, and no combat requirement. It needs a new region (a natural fit for the bigger map), so it comes after the base game; the home island can be its supply base and the people of the community arcs its allies. Order relative to steam and pirates is undecided.
