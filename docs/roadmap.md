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

- **v1.1, "The Sailing Club"** ([plan](v1.1/plan.md)): bug fixes, and Wren's sailing club at
  Saltmere with new races (some with a squall in a fixed place to sail round) and a best-times board.
  Also a game-like UI skin, style E ([0220](decisions/0220-a-game-like-ui-skin-style-e.md)): same
  screens, new materials, font and icons, so the interface no longer reads as AI-made.
- **The store plan** ([0204](decisions/0204-selling-on-android-iphone-and-xbox.md)): phones first,
  Xbox after asking ID@Xbox.
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
