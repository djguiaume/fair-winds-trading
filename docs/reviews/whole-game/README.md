# The whole game after Phase 4 (review)

Guillaume asked (2026-10-25), before the Phase 5 brief: review the game as a whole and say whether
the roadmap is still the right direction, or what should adapt. Decision:
[0207](../../decisions/0207-the-roadmap-after-phase-4.md) (Proposed). Story view by the head
storyteller: [story-view.md](story-view.md). Art view by the art director: [art-view.md](art-view.md).

Checked on `main` at `901b25c` (after PR #220) with the agent tools: `npm run check` (all ok, 21
quests, 44 island files), `npx vitest run` (1180 tests pass), `npm run balance` and
`npm run balance -- --map phase4` (28 of 28 checks on all three levels), `npm run shots` (the
screenshots here, desktop).

## The game today, in one table

| Part | What a player gets |
|---|---|
| Sailing | Arcade sailing with a no-go zone and tacking, heel, wakes, gusts, wind shifts, island lee, wind zones (trades, doldrums, gales, fog, ash), currents, shallows that refuse deep keels, reefs, drifting bergs, a storm belt, storms, day and night. Every hazard has a switch. |
| Trade | 18 goods (4 raw, 4 crafted, honey and lamp oil, 4 far raw and 4 far crafted), markets that move, orders, help orders, a load on credit when broke. |
| Ships | 7 ships in 3 lines (starter, swift, hauler), 3 upgrade tracks seen on the model, earned at shipyards by standing. |
| Towns | 4 levels, buildings grow with deliveries; 2 outposts per sea founded and grown by the player. |
| Story | Prologue rescue, Rook's thanks, 4 ring arcs, the epilogue, 4 seas × 3 arcs, the closing beat four-winds: 19 story quests, 14 people with voices and portraits. Bots finish it in 1 h 15 to 2 h 30; real players about 3 to 4 h. |
| Home | Skerry with 4 build spots and 8 perks. |
| Sea | The ring in the centre and four seas (south tropic, west fire, north ice, east fog and storm), fog of war, charts handed over by quests. |
| Platforms | Desktop, touch (landscape and portrait), Xbox and other pads, English and French, PWA, save by QR code or file. |
| Tools | Map/sea editor, island builder, quest builder, controls page, tuning panel, and 8 command-line tools. |

## Must-haves for Phase 5 (Guillaume, 2026-10-25)

Whatever option is picked, Phase 5 includes these two:

1. **Fix the home island's build view.** Moored at Skerry, the island shows numbered spot circles
   over the 3D island, a "Skerry · your island" chip and a "Home at Skerry" note, and no harbour
   screen (`src/ui/homePanel.ts`). An arc's reward (`"reward": { "homeSpot": [...] }`) opens a spot;
   the only hint is a 4-second "A new spot on your island" note. Players don't know why the view is
   there, and neither does Guillaume. Direction to mock and pick: the arc giver offers the two
   buildings on the done card, Skerry gets a harbour screen like any port with an **Island** tab
   (spots as a list with the two choices, the warehouse and repairs), and the circles only show while
   a choice waits, as a highlight of the spot that will be built on.
   **Storyteller (2026-10-25):** voice it. The brief's rule 12 changes so the giver names the plot and
   the choice on the done card, with the building names from the build-spot data through placeholders
   ("Ada's plot by the water is yours, captain: {spotA} or {spotB}. Choose at Skerry."); on the next
   docking at Skerry with an unchosen plot, a short arrival card in the giver's voice opens the build
   view straight on that spot.
   **Art director (2026-10-25):** yes, an Island tab in the harbour screen (same style and pad
   navigation as the other tabs). Picking a plot turns the camera to it behind a half-height panel, so
   you still see where it goes; the numbered circles become staked plots in the world with a small
   sign. Docking at Skerry opens the Island tab.
2. **Review the central sea like the outer seas.** The Windward Ring (Saltmere, Port Calda, Westholm,
   Stonehaven, Abbey Head, Watchman Key, Skerry and the islets) was laid out in Phase 1 and never
   raised to the art bible's rule 10 or the seas' density and story checks. The art director: Westholm
   and Saltmere are a few tiny houses on flat green with lone trees and one-tone cliffs, Westholm is
   dark at night, Port Calda is closest to the bar. The review covers each island's look and level of
   detail at every town level and at night, density (`npm run sea -- density`), landmarks and names,
   and fit with the ring arcs and the four seas' letters; then a catch-up pass, screenshots to
   Guillaume. It comes **first** in Phase 5: it is where every player starts.
   **Storyteller:** light story work, no rewrite (the ring arcs are the most varied in the game).
   Check that the story's places read right on the grown map (East Reef gap, Greyback Ridge, Teeth
   Rock, Watchman Key), that each ring port shows its winter damage before its arc and mended after,
   and that the five ring people don't go silent after their arcs (standing orders cover it).
   **Art director:** island by island at the seas' cameras (town, overview, night), at town levels 1
   and 4 with Sunreach beside it: outlines, tiers and ridges; detail per rule 10; lit windows at
   night; one signature per port (Saltmere and Port Calda still need theirs named, with the
   storyteller) and arc payoffs visible; density, reefs and borders with the four seas; the triangle
   budget. Top gaps: man-made shapes (Abbey Head, Lantern Rock, Watchman Key are stacked octagons;
   Greyback Ridge and the long islands are straight extrusions), thin dark towns (few small houses, no
   lit lanes, gardens or boats), and flat green caps with lone ball trees, one-tone tiers and reefs
   that read as scattered pebbles. Sheet: `docs/reviews/art-direction/whole-game/` (PR #225).

## What works

- **The core is right for the audience.** Reading the wind is the game: the compass, the no-go
  zone, knots and point of sail are always on screen, and the four seas each add a sailing problem
  (doldrums, ash, bergs, fog). Balance holds on all three levels.
- **The world looks like one game.** The art bible keeps the four seas apart and together; the chart
  is a pleasure to open ([chart-all.png](chart-all.png)).
- **Everything is data with an editor and a CLI**, so content is cheap: a new quest, island or sea
  is a file, checked by `npm run check`.
- **The voice holds:** warm, plain, kid-safe, in two languages.

## What is weak

1. **The sea is empty of other sails.** No other ship ever sails: only moored boats at the piers. For
   people who like sailing, seeing a fishing boat beat upwind or a coaster run home is half the
   charm, and every later plan (pirates, rival companies, races, steam, escorts) needs ships that
   sail by the same wind. Today nothing in `src/sim` moves a ship but the player's.
2. **The story is one template four times, then stops** (storyteller): letter → bring goods → look →
   bring goods → found → carry. The seas' hazards are scenery, never a step. The 14 people go silent
   after their arc; after four-winds nothing pulls.
3. **Sound is thin.** `audio.json` has one music theme, two effects (creak, foghorn) and the babble
   voices. No sea, wind, sails, gulls or harbour. Sound sits in Phase 7, but it is most of what
   "cozy" feels like.
4. **The harbour hides the town.** The port screen is a dark table over the sea
   ([saltmere-market.png](saltmere-market.png), [saltmere-quay.png](saltmere-quay.png)): while
   trading, you never see the town your deliveries grew, which is pillar 2 ("every delivery
   matters").
5. **Promised and not built:** racing missions (asked 2026-10-19), visible and audible damage (asked
   2026-10-19), ship cosmetics, achievements.
   Visible damage matters more once anything chases the player (art director).
6. **Phase 5 as written does not fit.** The roadmap says "pirate ships that hunt loaded merchants",
   a guns upgrade track and a warship line (ketch, brig, frigate). The storyteller brief says "no
   villains, no deaths, no danger to people, kids can read every line". Guns also close the door on
   Kids mode, and full combat is the costliest system on the roadmap (AI, projectiles, collisions
   between ships, effects on an old tablet).
7. **The roadmap itself is hard to read:** 270 lines, 60 KB, each phase full of history; the
   roadmap picture predates 0120; seeded maps and seasons still listed though the seas are now hand
   made and the story is placed by hand.

## Is the roadmap still the right direction?

**Yes for the game, no for the next step.** The direction chosen in
[0120](../../decisions/0120-communities-and-home-island.md) (community arcs, home island, manual
sailing, no automation) is what made Phases 3 and 4 good, and should stay. What should adapt is
Phase 5 and the order of what comes after it.

## Options for Phase 5

| | Option | What it is | For | Against |
|---|---|---|---|---|
| A | **Pirates as written** | Hostile ships, guns, warship line, combat | It is what the roadmap says | Breaks the voice and Kids mode; most costly; pulls a sailing game toward fighting |
| **B** | **A living sea, then rovers** (recommended) | 5a: other sails on the water and the sea's sounds; 5b: rovers, cozy pirates you outsail and bring home (storyteller); 5c: regattas | Fixes weak points 1, 2, 3 and 6; the ships that sail by the wind are the base for every later plan | Rovers are softer than "pirates"; no fights |
| C | **Finish and ship first** | A v1.0 polish phase: sound, the harbour showing the town, visible damage, standing orders, store plan un-parked | Fastest road to a game people can buy | No new play; the empty sea stays |

### Option B in detail

- **5.0 First:** the two must-haves above (ring review and pass, home island view) and the port
  screen header band (the port's signature, the keeper's portrait, the town level; art director).
- **5a. A living sea.** Other ships sail the same model as the player's (polar, no-go zone, tacking,
  wind zones): fishing boats working near their port, coasters carrying the goods a town makes to
  the towns that want them, now and then a ship from a far sea. They avoid islands and each other,
  dock, and are few (a cap per quality level, measured on `?bench`). Pure scenery at first, plus
  sound: sea, wind in the sails, luffing in irons, gulls, harbour bustle. Data: who sails where in a
  `traffic` file, editable in the sea editor, `npm run sea` and checked by `npm run check`.
- **5b. Rovers** (storyteller's shape, [story-view.md](story-view.md)): crews of young sailors who
  left the islands in the hard winter. A rover boat shadows a loaded ship in its sea and, if it
  comes alongside, takes a share of the hold. Nobody is hurt, nothing is fired, no ship is lost.
  You escape by sailing well: a better point of sail, shallows they can't follow, a lit harbour.
  In each sea someone we know recognises a crew; the captain brings them home, they become the
  outpost's gatherers or crew, and that sea's chases stop. The Pirates switch (rule since 0010)
  turns chases off and the crews are met in a cove instead; each level scales chase rate and toll.
  No guns, no warship line: the answer is speed and draft (a lighter rig, a signal lamp).
- **5c. Regattas.** The racing missions of 2026-10-19 with a friendly rival captain from the living
  sea; quests already time steps (`{par}`), so a race is mostly data plus medals.
- **Alongside, small:** standing orders (short repeatable asks from people whose arc is done, all
  quest data), and the port screen showing the town (art director to mock).

## Guillaume on pirates (2026-10-25, 14:37Z)

"I'm not convinced about pirates either. Unless they are in an extension/dlc in a new sea and stay
only there." So the plan below is updated: **pirates leave the base game.** They become a later
extension with a sea of their own (a natural home: past the Stormbreak, where the great expedition
was planned), and never sail the ring or the four seas. Phase 5 keeps the living sea, sound,
regattas, standing orders and the two must-haves. The rovers idea and the art director's cozy-fight
rules stay on file below for that extension.

## Where the storyteller and the art director differ (for the pirate extension)

Both want Phase 5 cozy and both want the ring pass, the port screen and sound. They differ on
pirates:

- **Storyteller:** no guns, no warship line. Rovers you outsail; they take a share of the hold if
  they come alongside; you bring each sea's crew home. Guns break "no danger to people" and Kids mode.
- **Art director:** pirates fit the look (the reference ad is pirates in this style). Cannon fights
  drawn cozy: muzzle puffs, splashes and wood chips, never fire or bodies; nothing sinks; a beaten
  pirate strikes its flag and flees; boarding costs cargo. Warships ketch, brig, frigate in navy and
  brass.

This is Guillaume's call (question 2). The recommendation stays rovers first, because they need
neither combat nor three new ship models and they fit the story as written; if he wants fights, the
art director's rules keep them cozy, and rovers can still be the first chapter.

## Proposed roadmap changes (Option B)

0. **Phase 5 opens with Guillaume's two must-haves**: the central sea review and catch-up pass, and
   the home island view fixed; then the port screen header.
1. **Pirates leave the base game** (Guillaume): a later extension with its own new sea, never in the
   ring or the four seas. Phase 5 has no chases.
2. **Phase 5 becomes "A living sea"** (rovers left out, kept for the extension): other sails, sea sounds, rovers you outsail and bring home,
   regattas. Pirates keep their name in Settings and a switch.
2. **Drop** the guns track and the warship line ([0035](../../decisions/0035-three-ship-lines.md)
   keeps two lines plus the starter). The `warship` line id stays unused in code.
3. **Racing missions** move from their own section into Phase 5.
4. **Sound** of the sea and harbours (an ambient bed per sea, a harbour bell) and **visible hull
   damage** move from Phase 7 into Phase 5; **flags as data** come with the rovers; ship cosmetics
   stay in Phase 7.
5. **Phase 6 (factions)** becomes "friendly rival companies (maybe)": rival captains in regattas
   and bids for a port's order, never enemies.
6. **Seeded maps and seasons** move to "Out of scope for now"; seeded maps fit only a sandbox.
   Tides stay later (0140).
7. **The great expedition and steam** stay later extensions; both would reuse 5a's ships.
8. **The roadmap is rewritten short:** "Now, Next, Later" on one page with a line per phase and a
   link to its decisions; the long history moves to `docs/roadmap-history.md` unchanged; the
   roadmap picture is redrawn.

## Questions for Guillaume

1. Phase 5: **A**, **B** (recommended) or **C**?
2. Pirates only in an extension with its own sea (your 14:37Z message): agreed, so Phase 5 has
   none. When that extension comes: rovers (storyteller) or cozy cannon fights (art director)? No
   need to answer now.
3. Should Phase 5 aim at a **v1.0** (the base game finished, then the store plan of 0204 comes back),
   or stay v0.5?
4. Rewrite the roadmap short, history kept in its own file: yes or no?

## Screenshots (main `901b25c`, desktop)

- [menu.png](menu.png): the title menu.
- [sailing-ring.png](sailing-ring.png): sailing off Saltmere, in irons, no other sail in sight.
- [saltmere-market.png](saltmere-market.png), [saltmere-quay.png](saltmere-quay.png): the harbour
  screen; the town is behind the dark panel.
- [chart-all.png](chart-all.png): the chart with every sea charted.
- [skerry.png](skerry.png): moored at Skerry, the build-spot view (numbered circles, no harbour screen).
