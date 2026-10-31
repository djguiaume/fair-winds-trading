# Fair Winds Trading — Roadmap

A low-poly sailing and trading game for the browser, for people who like sailing. Reading the wind is
the game; deliveries grow the towns; the community arcs build your home island. Cozy: no villains, no
danger to people.

One picture for phones: [roadmap-image/roadmap.png](roadmap-image/roadmap.png) (source
`roadmap-image/roadmap.html`, render with `node docs/roadmap-image/shot.cjs`). The full history of
each phase, with every decision as it was taken, is in [roadmap-history.md](roadmap-history.md).
Versions: `v0.<phase>.<deploy>` ([0042](decisions/0042-light-versioning.md)), a GitHub release per
phase ([releases](releases/README.md)). Direction set in [0120](decisions/0120-communities-and-home-island.md)
and reviewed after Phase 4 in [0207](decisions/0207-the-roadmap-after-phase-4.md)
([review](reviews/whole-game/README.md)).

## Rules that hold in every phase

- Desktop, touch (landscape first, portrait must look good) and game controllers; smooth on an old
  tablet ([0006](decisions/0006-desktop-and-mobile.md), [0116](decisions/0116-performance-priorities.md)).
- Everything is data, editable in the editors and with a command-line tool
  ([0093](decisions/0093-data-driven-content-and-authoring-tools.md), [0153](decisions/0153-command-line-tools-for-agents.md)).
- Every hazard has a Settings switch, and every story step works with it off; balance is checked on
  all three difficulty levels ([0083](decisions/0083-difficulty-levels.md)).
- Active play only: nothing happens while the game is closed or paused.
- Every look follows the [art bible](art/art-bible.md); every line follows the
  [storyteller brief](story/storyteller-brief.md).

## Done

| Phase | What it gave | Release |
|---|---|---|
| 0 | Sailing that feels good: wind, no-go zone, tacking, touch and keys | in v0.1 |
| 1 | One-captain trading on the Windward Ring: markets, orders, shipyard, sloop and cutter, chart, tutorial, English and French | [v0.1.50](releases/v0.1.50.md) |
| 2 | Living settlements: town levels, workshops, rare goods, weather, storms, day and night, difficulty levels, save transfer | [v0.2.73](releases/v0.2.73.md) |
| 3 | Story and tools: the rescue prologue, Skerry, four community arcs, the epilogue; content as data, editors, tuning panel, quest engine | [v0.3.129](releases/v0.3.129.md) |
| 4 | Four seas round the ring (tropic, fire, ice, fog and storm), founded outposts, wind zones, currents, fog of war, far goods, twelve new arcs and four-winds; Xbox and pads; the agent tools | [v0.4.226](releases/v0.4.226.md) |
| 5 | A living sea, the base game finished: Skerry's build choice, the ring caught up, the port in the harbour screen, other boats, sounds of the sea, the Saltmere Regatta, standing orders, hull damage | [v1.0.253](releases/v1.0.253.md) (1.0) |

## Phase 5 — A living sea: released as 1.0 ([v1.0.253](releases/v1.0.253.md), [0219](decisions/0219-version-1-0-release.md))

Chosen by Guillaume on 2026-10-25 ([0207](decisions/0207-the-roadmap-after-phase-4.md)). Brief:
[phase-5/brief.md](phase-5/brief.md). Phase 5 ends with **v1.0**, the base game finished; then the
store plan of [0204](decisions/0204-selling-on-android-iphone-and-xbox.md) comes back.

1. **First, Guillaume's must-haves:**
   - The **home island's build view** made clear: the arc giver names the plot and its two buildings,
     Skerry gets a harbour screen with an Island tab, staked plots on the island.
   - The **central sea reviewed** like the outer seas (looks at every town level and at night,
     density, landmarks, the story's places), then a catch-up pass.
2. **A harbour screen that shows the port:** a header with its signature, the keeper and the level.
3. **Other sails on the water:** fishing boats, coasters and far-sea visitors that sail by the same
   wind as the player, few and capped per quality level, as data in the sea editor and `npm run sea`.
   Built in [0215](decisions/0215-other-boats-on-the-sea.md) (21 fleets, 26 boats).
4. **Sounds of the sea:** waves, wind in the sails, luffing, gulls, a harbour bell, a bed per sea. Built in [0209](decisions/0209-sounds-of-the-sea.md).
5. **Regattas in the story** (Guillaume: with an NPC and rewards): races against a friendly rival
   captain, unlocked through the story, with medals and prizes. Built in
   [0217](decisions/0217-the-saltmere-regatta.md): Wren Tally and *Kestrel*, 3 ring races, 4 sea
   races and the Four Winds Cup, pennants and the Cup on Skerry.
6. **Standing orders** ([0214](decisions/0214-standing-orders-people-ask-again.md)): small repeatable asks from people whose arc is done, so the cast keeps
   talking after the story.
7. **Visible hull damage** at each quarter of the hull lost, cleared by repair.
8. **Release v1.0:** a full playtest on all three levels and the old-tablet test.

## Now and next, after 1.0 (not scheduled)

- **v1.1, "The Sailing Club"** (**released**, [notes](releases/v1.1.282.md), [plan](v1.1/plan.md)): a turnable camera, and Wren's sailing club at
  Abbey Head with new races (some with a squall in a fixed place to sail round) and a best-times board.
  Also a game-like UI skin, style E ([0220](decisions/0220-a-game-like-ui-skin-style-e.md)): same
  screens, new materials, font and icons, so the interface no longer reads as AI-made.
  And an **Ultra quality level** for desktop and Xbox ([0221](decisions/0221-an-ultra-quality-level-for-desktop-and-xbox.md)):
  tone mapping, soft shadows, ambient occlusion, better water, a lower camera tilt; phones unchanged.
- **v1.2, "a new look"** (**released**, [notes](releases/v1.2.313.md), [0222](decisions/0222-a-new-look-smooth-terrain-blue-water-and-forests.md)): the
  *Traffic Architect* look Guillaume approved, on every quality level: smooth rolling terrain from the
  same island data, shores sloping into the sea, depth-coloured blue water, dense forests, haze.
  Build guide: [v1.2/plan.md](v1.2/plan.md), [brief](v1.2/brief.md); sculpting scope in [0230](decisions/0230-v12-scope-terrain-sculpting-and-the-ocean-moves-to-v13.md), ocean waves moved to v1.3. Look v2 becomes the default at the end (#350), `?look=v1` keeps the old look. #255 closed: no known bugs.
- **v1.3, "Waves you can see"** (**released**, [notes](releases/v1.3.324.md), [0251](decisions/0251-version-13-release-waves-you-can-see.md), tracker #279): wind- and storm-driven waves, depth-aware coasts, scalable GPU water,
  ocean controls. Plan: [v1.3/plan.md](v1.3/plan.md); wave model [0245](decisions/0245-shared-wave-model-and-cpugpu-contract.md) (#280), coasts [0248](decisions/0248-coast-calms-the-waves-by-depth-shelter-and-berths.md), look [0249](decisions/0249-gpu-waves-shade-by-their-own-normals-storm-water-greys.md), on by default from Medium up with Settings › Waves and comfort switches [0250](decisions/0250-waves-on-by-default-from-medium-up-with-ocean-comfort-contro.md) (#286). **v1.3.1, "Boats that ride them"** (**released**, [notes](releases/v1.3.334.md), [0258](decisions/0258-version-131-release-boats-that-ride-them.md), tracker #356): heave, pitch and roll, bounded wave effects on sailing.
  Island and boat reflections are an idea (#285).
- **v1.4, "Visible upgrades"** (tracker #294): sail, hull and hold upgrades visible on every ship, per-ship looks,
  shipyard preview. **v1.4.1, "Cosmetics and free sailing"** (#357): cosmetics and figureheads, Free Sailing.
- **v1.5, "The far seas' story"** ([plan](v1.5/plan.md), tracker #358): data-only story release before the store
  build: a hazard step per sea, far-goods asks, a chapter after four-winds. Storyteller leads.
- **The store plan** ([0204](decisions/0204-selling-on-android-iphone-and-xbox.md), parked): after a stranger
  playtest (#364), a licence decision and a trailer from the v2 look. Order: **Steam with a free web demo first,
  phones second, Xbox last.**
- **Polish and extras:** ship cosmetics (sail colours, flags, figureheads), achievements, a real
  **sandbox** mode (everything unlocked, nothing saved; needs its own decision), the **Kids mode**
  rework ([0043](decisions/0043-shelve-kids-mode.md)), "play with these controls" in the editors.
- **Event panel** for big story events ([0174](decisions/0174-event-panel-for-big-story-events.md)),
  only when Guillaume asks.

## Later extensions (each its own decision, maybe paid)

- **Pirates, in a sea of their own** (Guillaume, 2026-10-25): never in the ring or the four seas;
  for example past the Stormbreak. The storyteller's rovers (crews you outsail and bring home) and
  the art director's cozy-fight rules are on file in the [review](reviews/whole-game/README.md).
- **The great expedition** past the storm belt ([extension plan](reviews/progression/extensions.md)).
- **Steam and harbour logistics** ([0097](decisions/0097-progression-candidates-and-later-extensions.md)):
  one steam launch first; automation only if it proves better than sailing by hand.
- **Friendly rival companies (maybe):** rival captains in regattas and bids for a port's order,
  never enemies.
- **Tides** ([0140](decisions/0140-wind-zones-and-currents.md)) and moving a voyage to a console
  without typing (needs a server).

## Out of scope for now

- Combat in the base game, guns and a warship line.
- Seeded maps and seasons: the seas and the story are placed by hand (a seed would fit only a
  sandbox).
- Multiplayer, online leaderboards, and any server.
- Offline progress or catch-up.
