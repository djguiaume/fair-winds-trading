# Phase 5 brief — A living sea, to v1.0

Decided by Guillaume on 2026-10-25 ([0207](../decisions/0207-the-roadmap-after-phase-4.md),
[review](../reviews/whole-game/README.md)): Option B, with regattas that fit the story ("with some
NPC for it and rewards"), and Phase 5 ends at **v1.0**, the base game finished. No pirates in the
base game. Written with the head storyteller ([story section](story.md)) and the art director
([art section](../reviews/art-direction/phase5/README.md), PR #227).

The rules of the [roadmap](../roadmap.md#rules-that-hold-in-every-phase) hold: data with an editor
and a CLI for everything, a Settings switch for anything that gets in the way, every step works with
it off, balance on all three levels, the old tablet, screenshots to Guillaume before any look merges.

## The work, in order

| # | Part | What | Story | Art | Tools and data |
|---|---|---|---|---|---|
| 1 | **Skerry's build choice** (must-have) | The arc giver's done card names the plot and its two buildings; the next docking at Skerry opens an arrival card in the giver's voice and a harbour screen with an **Island** tab (plots, warehouse, repairs). Picking a plot halves the panel and turns the camera to it. Staked plots (stakes, string, a sign) replace the UI circles. Mockups first. | Brief rule 12 changes; building names from the build-spot data through placeholders (`{spotA}`, `{spotB}`) | Plot prop, camera move, Island tab in style D | Placeholders in the quest builder and `npm run quest -- check`; the stake prop as data |
| 2 | **The central sea review and pass** (must-have) | Review every ring island like the outer seas (town and overview cameras, night, town levels 1 and 4, Sunreach beside it), then the catch-up pass: Westholm and Saltmere first, then Stonehaven, Abbey Head, Port Calda, Skerry's waters, the small islands, open water. | Story places read right on the grown map (East Reef gap, Greyback Ridge, Teeth Rock, Watchman Key); each port shows the winter's damage before its arc and the repair after; signatures for Saltmere and Port Calda named with the art director | Shape and cliff bands, no empty planes, lamp-lit lanes and windows, reefs that read as reef, about 6k triangles per island until `?bench` | `npm run island`, `npm run sea -- density`, `npm run chart`, `npm run shots` |
| 3 | **Harbour screen header** | A cached view of the port at its level, its name and palette accent; the keeper's portrait, the town level and the next growth in today's empty space; the Quay tab's empty state shows the quay. | — | Header band per port | The view from the port's island file; no hand-made pictures |
| 4 | **Other sails on the water** | Fishing boats near their port (the `fishingBoat` prop with a lug sail, ~350 triangles), a new small coaster on port lanes (~900, deck cargo, home colours), rare far-sea visitors (fluyt, indiaman, schooner at a far level of detail, a liveried band per sea). They sail by the real wind (polar, no-go zone, tacking, zones, currents), never ram (a soft bump), dock, and show a stern lantern at night. At once: Low 3, Medium 6, High 10; one instanced draw per kind. | Names and home ports from a data list ("Kit's boats"); no speaking skippers | Boats in style D, coloured by the sea's style | A `traffic` block in the sea files (kinds, home ports, lanes, counts), in the sea editor and `npm run sea`, checked by `npm run check`; `?bench` and the old tablet confirm the caps; a Settings switch (Other ships) |
| 5 | **Sounds of the sea** | One bed per sea, a harbour bell, sail flap and luffing in irons, a crash thud, the regatta horn and gun, a theme variation per sea and a regatta theme. | — | — | Every sound a line in `src/data/audio.json`, volume in Settings |
| 6 | **Regattas** | The **Saltmere Regatta** run by **Wren Tally**, a friendly rival skipper with the cutter *Kestrel*; Rook keeps the times in his book. 8 races: a ring series of 3 after `fair-winds`, 4 sea races (one after each outpost: the Coral Line shallows, a lap of the Smoulder, up the Floe Line, across the Stormbreak in a lull; each sea's keeper starts it), and the **Four Winds Cup** after `four-winds`, finishing at Skerry. Fixed buoys and a pinned wind, bronze, silver and gold pars per ship class, a personal best; nothing fails and every race can be sailed again. *Kestrel* sails the course beside you as a living-sea boat. | Wren's look, voice and lines; keepers' new lines | Yellow numbered racing buoys, a start and finish line on the water, a chequered flag, a committee coaster with bunting, race liveries and sail numbers, quay bunting and spectator boats with `during:` tags, the course in yellow on the chart | Races are quests (`quest buoy`, `quest wind`, timed steps); medals and pars in quest data; pars set by `npm run balance` on all three levels |
| 7 | **Rewards: pennants and the Cup** | Gold the first time each medal is won; a masthead pennant per series won (ring, seas, cup); the Cup on Skerry's pier and a line in Rook's book. No perk, so trade balance stays put. | — | Pennants and flags | **Flags as data** (also the base for cosmetics later); the Cup an `after:` prop |
| 8 | **Standing orders** | Anyone whose arc is done sometimes asks, on the Quay tab, for a good their port wants, in their own voice; one ask at a time per port, ignorable, no deadline. | A pool of 3 to 4 lines per person (15 people with Wren) | — | Help orders with a speaker; frequency in a data file; reward through `helpReward` |
| 9 | **Visible hull damage** | A splash, drifting planks and a crash sound on impact; the model changes every 25 % of hull lost (scuffs; a patched sail and a missing rail; a torn sail and a list); repair clears it. | — | Damage parts per ship | Damage parts as data per ship file |
| 10 | **v1.0 release** | A full playtest of a new game on all three levels, the old-tablet `?bench`, no open PRs, notes and an ADR like 0206; the menu shows v1.0. | — | Art director signs off the set | `npm run shots`, `npm run balance`, `?bench` |

1 and 2 start first (Guillaume's must-haves) and do not wait for anything else. 3, 4 and 5 can run
alongside. 6 needs 4 (Wren's boat) and 7; 8 can start once 1 is done (it shares the Quay tab work).
9 is independent. 10 is last.

## Build threads proposed

| Thread | Parts | Asks |
|---|---|---|
| Make Skerry's build choice clear | 1 | storyteller (rule 12 lines), art director (plot prop, camera), Guillaume (mockups) |
| Review and polish the central sea | 2 | art director (checklist, sign-off), storyteller (places, signatures) |
| Show the port in the harbour screen | 3 | art director |
| Sail other ships on the sea | 4 | art director (boats), storyteller (names); performance on `?bench` |
| Add the sounds of the sea | 5 | art director |
| Race in the Saltmere Regatta | 6, 7 | storyteller (Wren, races), art director (buoys, flags), balance (pars) |
| Let people ask again (standing orders) | 8 | storyteller |
| Show hull damage | 9 | art director |
| Release v1.0 | 10 | everyone; Guillaume sees the playtest |

## Done when (v1.0)

- Guillaume finds Skerry's build choice clear in a new game, and the ring passes the art director's
  review beside Sunreach.
- Other ships sail every sea within the tablet budget; the sea and the harbours have sound.
- The 8 regattas and their rewards play on all three levels; the cast speaks after the story.
- Hull damage shows; balance passes; the full playtest is seen by Guillaume; v1.0 is tagged.
