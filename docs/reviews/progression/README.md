# Story and progression: three competing directions

**Status:** Design alternatives for comparison and playtesting; no direction selected.
**Updated:** 2026-10-23.
**Baseline reviewed:** main `d3bde7ca62cf8ec148a630fe46c3547ef80d5e22`, after Phase 2 release v0.2.73, the map editor and the island-builder mockup.
**Related:** [roadmap](../../roadmap.md), [decision 0097](../../decisions/0097-progression-candidates-and-later-extensions.md), [later extensions](extensions.md).

## What is decided, and what is still open

Guillaume wants a stronger reason to sail, trade and progress. Three alternatives remain under discussion: build a personal harbour island; connect and transform existing communities; prepare for a great expedition. Documenting them does not approve implementing any of them or combining all three.

Steam vessels and automation are deferred to a later stage or possible expansion. Pirates remain a separate planned later extension. Paid DLC, release order and commercial packaging are undecided. The base game must be satisfying without either extension. No progress occurs while the game is closed; future systems must also stop during pause. There is no real-time catch-up, offline income, offline production or offline punishment.

A mystery, captain reputation and recurring characters can support any alternative; they are not separate competing core directions. All story names, plots, building lists and tuning ideas below are proposals.

## Existing foundation

The current game is a wind-based sailing and trading game, with short sessions, local saves, desktop/touch controls, three graphics levels and an older-tablet target. Phase 2 is released; older sections of the root README and roadmap still contain historical prototype descriptions.

| Foundation                                                      | Available use in a story                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Wind, tacking, island shelter, shallows, collisions and repairs | Navigation decisions, learning and preparation                     |
| Supply/demand markets, delivery contracts and help orders       | Income and immediate purposes for voyages                          |
| Settlement levels and visible growth                            | Persistent consequences for deliveries                             |
| Town specialties: smoked fish, bread, planks and cut stone      | New trades opened by community development                         |
| Hidden yards at Abbey Head and Watchman Key                     | Discovery, relationships and earned ship access                    |
| Honey and lamp oil                                              | Valuable long crossings and port-town progression                  |
| Sloop, swift line and hauler line, with visible upgrades        | Different tools for different jobs                                 |
| Weather, storms, difficulty settings and visual day/night       | Adjustable atmosphere and challenge                                |
| Chart, tutorial, English/French and voyage transfer             | Existing presentation and persistence foundations                  |
| Data-driven tuning and map editor                               | Authoring support; not an implemented quest or construction system |

Current repeatable contracts are not an authored quest engine: they do not provide multi-step character arcs, persistent partial construction contributions or narrative branching. Current town growth is not player-directed modular building. The newly merged [island-builder proposal and mockup](../../island-builder/README.md) (ADR 0096) concerns developer authoring in `editor.html`; it may support reusable assets and placement checks later, but it is not an implemented player construction, resource-cost or ownership system. Buying/owning ship classes is not autonomous fleet operation. Provisions, player islands, steam propulsion, pirate combat and expedition campaigns are future work.

Relevant decisions: [sandbox sessions](../../decisions/0009-sandbox-short-sessions.md), [home port and yards](../../decisions/0048-ship-unlocks-home-port-and-yards.md), [settlements](../../decisions/0059-settlement-levels.md), [specialties](../../decisions/0063-specialized-town-goods.md), [rare goods](../../decisions/0065-rare-goods-from-the-far-yards.md), [help orders](../../decisions/0069-help-orders.md), [difficulty](../../decisions/0083-difficulty-levels.md), [authoring](../../decisions/0093-data-driven-content-and-authoring-tools.md).

## Side-by-side assessment

These are design judgments, not measured player preferences or delivery estimates.

| Criterion                    | A. My harbour island                                      | B. Connected communities                        | C. Great expedition                                 |
| ---------------------------- | --------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| Player ambition              | Build a place of my own                                   | Help people and places thrive                   | Reach a formidable destination                      |
| Main motivation              | Ownership, creativity, visible investment                 | Relationships and consequences                  | Anticipation, discovery, mastery                    |
| Reuses current systems       | Materials, trade, ships, growth visuals                   | Almost all of the current progression           | Sailing, weather, repair, exploration               |
| Largest new work             | Placement UI, persistence, buildings and material storage | Quest engine, characters, authored content      | Region design, endurance/resupply, failure recovery |
| Relative implementation risk | Medium-high                                               | Lowest of the three, but substantial writing/QA | Medium-high without combat; high with combat        |
| Principal failure            | Sailing becomes material grinding for a builder           | Quests become renamed delivery orders           | All trading becomes grinding for one optimal boat   |
| Ship-line fit                | Strong if bulk building and exploration both matter       | Strong if request types and routes vary         | Conditional: must prove several viable approaches   |
| Defining prototype           | Construct a small personal harbour                        | Complete one consequential community arc        | Attempt one multi-leg expedition                    |
| Current recommendation       | Strongest ownership potential                             | Strongest fit and least systemic disruption     | Challenger with strongest adventure promise         |

Keep A and B as the strongest initial candidates; C should challenge whether a clear destination creates more motivation. Do not merge them before identifying which core activity earns another voyage.

## A. Build your own harbour island

**Promise:** I sail and trade to turn a small abandoned harbour into my own home.

After initial sailing at Saltmere, the player gains stewardship of a modest nearby island with a cottage and damaged jetty. Ownership arrives early; development supplies the long-term ambition. The player names the island, places modules, invites people and sees it change when returning by sea.

**Loop:** choose a project → obtain money, materials, plans or help → sail home → construct or improve something useful → gain a new opportunity.

### Construction proposal

Use movable buildings on a discreet grid, with suitable coastal attachment areas for docks. Support touch placement, rotation, clear footprints and free rearrangement. Natural features should constrain and characterize the site. Full terrain editing, roads, utilities and worker micromanagement are outside the first prototype.

| Module                  | Benefit                                                   | Connection to the archipelago                     |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| Jetty / dock extensions | Access and later larger-vessel accommodation              | Timber, then planks and masonry                   |
| Warehouse               | Store cargo and accumulate partial material contributions | Repeated imports remain useful with small ships   |
| Workshop                | Selected upgrade or repair services                       | Plans and relationships with existing specialists |
| Captain's cottage       | Personalization and record of milestones                  | Quest keepsakes and furnishings                   |
| Guesthouse              | Space for invited characters                              | Completion of personal stories                    |
| Chart room              | Expedition leads and discovery records                    | Exploration and chart information                 |
| Lighthouse              | Major visual and story milestone                          | Advanced materials and regional cooperation       |

These functions need validation; the lighthouse is not a promise of simulated AI navigation. Do not move existing Saltmere services or remove yard unlocks without an explicit migration decision.

### Strengths

- Personal, visible rewards for cargo and money; a reason to return home.
- Layout choices offer expression beyond buying a stronger ship.
- Haulers transport bulk materials; swift ships help with exploration and specialist errands.
- Buildings and residents can preserve memories of completed quests.

### Costs and risks

- A genuine new construction system: terrain suitability, footprints, overlaps, camera/input, upgrades, undo/rearrangement, saves, translations and art.
- Large material requirements can make sailing repetitive.
- Self-sufficiency can destroy the reason to visit producer islands.
- Requiring a full building tree could alienate players who mainly enjoy sailing.
- Unbounded building counts threaten tablet budgets.

**Guardrails:** retain mainland specializations, allow partial deliveries, cap the first island's scope, avoid compulsory production micromanagement, and build static island geometry only when its layout changes. Physical device validation is still required.

**First prototype:** jetty, warehouse, cottage and workshop; three connected quests and one meaningful layout choice. Test whether the player wants to sail again to improve home, rather than merely comply with a recipe.

## B. Connect and transform the archipelago

**Promise:** My voyages make these communities prosper, and people remember my help.

Develop the existing islands and their relationships instead of creating a personal construction game. A proposed plot, “The Broken Routes,” concerns a former trading compact fractured after an unsuccessful expedition and disputes over responsibility. Local trading grows into reconnecting more distant communities. No specific historical cause or ending is approved.

**Loop:** meet a need or person → choose whom/how to help → sail and trade → see a lasting local consequence → uncover a new relationship or opportunity.

### Characters and progression proposal

Start with one recurring character per port, rather than a large cast. Their ambitions should involve the port's existing identity: Saltmere's harbourmaster, Westholm's baker, Calda's sawmill builder, Stonehaven's mason and the two shipwrights. The shipwrights can disagree about speed versus carrying capacity, giving both lines a narrative role.

A compact arc could support Westholm's development, open its existing bakery and arrange the first bread shipment to an eligible buyer. Branches might let players help different ports first and later reconverge. A specific building request must not falsely imply that construction is already manually controlled.

### Strengths

- Strong reuse of settlement growth, workshops, help orders, markets and standing.
- Broad reason to keep different ship classes and upgrade tracks useful.
- Individual arcs suit short sessions and can have their own conclusions.
- More destinations gain meaning without requiring combat or automation.

### Costs and risks

- A delivery with extra dialogue is still a delivery: encounters need choices, discoveries and consequences.
- Characters can become interchangeable resource counters.
- Writing, translation, quest-order QA and economy tuning are substantial recurring work.
- Mandatory growth of every settlement can feel like checklist completion.
- A diffuse “help everyone” objective can lack a memorable endpoint.

**Guardrails:** give each arc a clear local resolution, recognize existing progress, avoid extra standing grinds, allow choice of order, and use discovery or navigation objectives alongside deliveries. Do not promise a complete story that relies on the tentative rival-company phase.

**First prototype:** about five quests linking Saltmere and Westholm, one memorable character, an existing workshop milestone and a meaningful choice. Test whether players care about what changed and who benefited.

## C. Prepare for a great expedition

**Promise:** I know where I ultimately want to sail, but I choose how to become ready.

The reference is the structure of Breath of the Wild: an intimidating known objective, optional preparation and freedom to approach it. It does not mean adding Zelda combat, a literal boss, armies or an on-foot open world.

A proposed “Beyond the Stormbreak” expedition would reach an isolated community and return with a passage chart. Players can attempt it early; skill, knowledge and preparation affect their chances. The first prototype should use sailing hazards rather than depend on pirates.

**Loop:** assess the challenge → trade, explore and improve readiness → attempt a leg → reach refuge or retreat → keep useful discoveries → eventually complete the voyage.

### Keeping the ship lineup meaningful

| Choice               | Possible benefit                           | Cost or limitation                     |
| -------------------- | ------------------------------------------ | -------------------------------------- |
| Small shallow vessel | Access to sheltered/shallow passages       | Less cargo and endurance               |
| Swift vessel         | Shorter exposure and fast scouting         | Less supply capacity than a hauler     |
| Hauler               | Large supply or refuge-building deliveries | Draft, handling and upwind limitations |
| Better information   | Safer or shorter approaches                | Requires exploration or relationships  |

These are route-design hypotheses, not approved stat changes. Preserve distinct hulls, rigs, upgrades and polar behavior. No single “expedition ship” should replace the lineup. Bulk preparation must be fun and lasting, not an obligatory hauling stage invented to justify haulers.

### Strengths

- Clear destination and strong anticipation.
- Navigation mastery has an obvious purpose.
- Preparation can support different play styles.
- Retreat, refuge and discovery can create memorable player stories.

### Costs and risks

- The adventure can collapse into a gold/hull threshold with unavoidable damage.
- One optimal boat can make the rest temporary purchases.
- A long crossing can become repetitive travel or punishing retries.
- Supplies can add chores to ordinary local trading.
- Combat, elaborate survival and cinematic bosses would greatly expand scope.
- One finale may leave little reason to continue trading afterwards.

**Guardrails:** offer genuinely different approaches, readable hazards and practical retreat; retain discovered knowledge after failure; test generous long-voyage endurance before adding several survival meters. No forced waiting for weather and no requirement to enable optional hazards. Open useful trade opportunities after completion.

**First prototype:** two approaches, one resupply refuge and an interesting destination. Test an early attempt, retreat and a later prepared attempt. If it is only fun after adding combat or extensive survival systems, reconsider its fit.

## What already exists on the market

Research checked 2026-10-23 using developer/publisher sources. Descriptions below are factual reference points; lessons and differentiation are our design assessment. This is a focused comparable-game review, not an exhaustive market or commercial-demand study. No sales or audience-size claims are inferred.

| Reference                                                                                                         | Existing proposition                                                                                              | Useful lesson                                                     | Fair Winds Trading distinction / caution                                                           |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Sailwind](https://store.steampowered.com/app/1764530/Sailwind/)                                                  | Sailing simulation, cargo missions, boat customization and exploration                                            | The voyage and growing ambition can motivate progression          | Our accessible top-down, short-session game should not inherit every survival or navigation burden |
| [Spiritfarer](https://thunderlotusgames.com/games/spiritfarer/)                                                   | Build a boat, travel and develop relationships with passengers                                                    | Connect home development, characters and exploration              | An island is stationary; travel and building must remain mutually useful                           |
| [Havendock](https://store.steampowered.com/app/2020710/Havendock/)                                                | Ocean settlement construction, resource management and technological growth                                       | A haven's visible development can supply long-term ownership      | Avoid turning sailing into a minor resource-fetching task for a colony simulator                   |
| [Anno 1800 developer campaign article](https://www.anno-union.com/the-birth-from-an-unbroken-line/)               | Story chapters intertwine with economic progression in one persistent world; sandbox continues after the campaign | Persistent development can carry an authored story                | Borrow structure, not the scale of industrial management                                           |
| [DREDGE](https://www.dredge.game/)                                                                                | Sell catches, upgrade a boat, explore an archipelago and complete inhabitants' personal stories                   | Memorable places and people can motivate otherwise repeated trips | Horror, fishing and its specific progression are not our proposed mechanics                        |
| [Windbound](https://store.steampowered.com/app/1162130/Windbound/)                                                | Island survival, exploration and boat crafting for dangerous waters                                               | A vessel and its preparation can be central to an expedition      | Freeform boat crafting and heavy survival would replace much of our current design                 |
| [Breath of the Wild official guide](https://zelda.nintendo.com/breath-of-the-wild/assets/pdfs/ExplorersGuide.pdf) | A major threat can be approached early; exploration and preparation provide help                                  | A distant known goal need not impose a linear quest sequence      | The analogy is goal structure, not equivalent scope or a requirement for boss combat               |
| [Sunless Sea](https://www.failbettergames.com/games/sunless-sea)                                                  | Captain ambitions, officers with stories, exploration and legacy                                                  | Personal purpose gives destinations meaning beyond prices         | Its frequent death and reading-heavy format are poor baseline assumptions here                     |

Additional primary references: [Spiritfarer developer on resources and exploration](https://thunderlotus.zendesk.com/hc/en-us/articles/28692897576468-I-can-t-find-a-resource-that-I-need-to-advance), [BOTW features](https://zelda.nintendo.com/features/).

None of these sources establishes that one candidate will succeed commercially. Our promising distinction is tactile wind-based sailing, readable ship roles, visible delivery consequences and a low-friction browser/tablet format.

## Shared implementation constraints

- Keep simulation separate from rendering; react to deliveries, discoveries and milestones rather than scanning every quest each frame.
- Put quest definitions, requirements, rewards, building recipes and future vessel parameters in data, following ADR 0093. New mechanics still require code.
- Use stable ids, explicit completion state and idempotent rewards. Persist partial project deliveries and prevent cargo from being counted twice across systems.
- Preserve ships, cargo, settlements and standing in older saves; infer completed milestones where trustworthy. Offer catch-up dialogue instead of forced replay.
- Keep captain-wide unlocks separate from map-specific voyages. Handcrafted stories may require compatible maps; procedural maps need reusable or explicitly unavailable story content.
- Include progression state in voyage transfers. Test old saves, reloads, transfers, alternate quest orders and already-completed milestones.
- Keep the chart/journal on demand; track one objective only when chosen. Never restore the automatic looping port guidance.
- Respect difficulty and independent storm/pirate/night switches; mandatory progress needs viable compatible objectives.
- No progress while closed, paused or suspended; resume without simulating elapsed wall-clock time.
- Retain all graphics levels and bounded assets, geometry and UI updates. Browser tests do not certify older-tablet performance.

## How to challenge the alternatives

Describe an equally concrete 30-minute sequence for each, then prototype narrowly. A survey is evidence of interest, not proof of sustained enjoyment. Do not ask voters to compare a detailed island fantasy with a vague “help the towns” option.

Ask the same questions after play:

1. What made you want another voyage?
2. Which decision mattered beyond selecting the highest price?
3. Why would you choose another ship?
4. What changed because of your actions?
5. Was sailing enjoyable, or merely travel between rewards?
6. What felt repetitive, confusing or unnecessary?
7. Would you continue after the immediate objective ended?

Useful observations: voluntary next voyages, variety of routes/ships selected, recall of characters or consequences, time spent sailing versus managing menus, and reasons for abandoning an objective. Gather baseline comparison; no numerical success thresholds have been agreed.

Suggested survey options:

- **My island:** sail and trade to build and personalize a harbour of your own.
- **Connected communities:** help existing settlements grow and follow the stories of people who depend on your voyages.
- **Great expedition:** prepare in your own way for a dangerous journey into unfamiliar waters.
- **Other / combination:** explain what appeals and what should be avoided.

## Next decision

**Mockups for the choice (2026-10-23):** [one concrete session per direction, with play time, effort and data files](directions/README.md).

Choose the primary motivation only after comparing the small prototypes or equivalent concrete play sequences. The initial assessment favors ownership (A) and relationships (B); expedition (C) remains a credible challenger. This ranking is advisory and is not Guillaume's selection. Steam, automation and pirates remain later work regardless of which wins.
