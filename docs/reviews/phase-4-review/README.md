# Phase 4 review before release

Checked on `main` at `afc2d5a` (merge of PR #198), 2026-10-25, against the roadmap's Phase 4 section,
the scope ([0137](../../decisions/0137-phase-4-biomes-and-founded-outposts.md)), the story
([0147](../../decisions/0147-phase-4-story.md), [storyteller brief](../../story/storyteller-brief.md#phase-4-the-four-seas))
and the "done" pattern of the Phase 3 release ([0138](../../decisions/0138-phase-3-release.md)).
Decision: [0188](../../decisions/0188-phase-4-review-and-release-gate.md).

Tools run: `npm run check` (all ok: seas, 44 island files, 17 quests, perks), `npm run balance` on the
ring and on `--map phase4`, `npm run chart -- --sea phase4`, `npm run shots` on `--sea phase4`.

## What is done on main

| Area | On main | Decisions |
|---|---|---|
| The grown sea: ring in the centre, four equal quarters | yes, `?map=phase4` (`src/data/seas/*.json`, `grown.json`) | 0137, 0152, 0179 |
| South, tropical: Sunreach, Coral Line, Palm Key, shallows that refuse deep ships | yes, art pass done (benchmark) | 0152, 0172 |
| West, fire: Emberhold, the Smoulder, lava rivers, ash zone, Warm Run, Cinder Isle `after:emberhold-glass` | yes, eruptions built | 0171, 0176, 0178, 0181 |
| North, ice: Rimewick, Floe Line, drifting bergs, Snowberry Pack `before:rimewick-jam` | yes | 0170 |
| East, fog and storm: Fogwatch, Stepping Stones, fog banks, the Race, the Stormbreak, waterfall | yes | 0167, 0169, 0173, 0175 |
| Even density in every sea | yes | 0180, 0181 |
| Wind zones, currents, Settings switches (Wind zones, Currents, Storm belt, Bergs, Eruptions, haze per kind) | yes | 0140, 0144, 0145, 0167, 0170, 0178 |
| Fog of war, charts handed over by quests | yes | 0156 |
| Far goods (8 goods, "no raw goods, no crafting", ring port towns buy) | yes, in data and sim | 0146, 0150 |
| Founding outposts (`site`, `landed`, `found`) | yes | 0157 |
| Town levels in the new seas (main ports Town → Port town, outposts Hamlet → Town) | yes, all 8 ports in data | brief, PR #181 |
| Land that rises or clears after a quest | yes | 0166 |
| Story: south (3 quests), west (3), north (3) | yes, 9 quests | 0155, 0158, 0171, 0170 |
| Editors and CLI: sea editor + `npm run sea`, island builder + `npm run island`, quest builder + `npm run quest` (found, landed, erupt rewards, quest tags), `chart`, `shots`, `balance` | yes | 0153, 0161, 0164 |
| Quest builder, sailing lessons, quest cards, controller (sailing, menus, Xbox) | yes | 0141, 0142, 0162, 0163, 0164, 0183, 0184, 0185 |

## Gaps that block the release

1. **The grown sea is still a dev sea.** A normal game (no `?map=`) still sails today's ring alone;
   the four seas exist only at `?map=phase4`, with its own save and a "Phase 4 sea (… laid out)"
   badge (`src/main.ts`, around line 180–250). Releasing Phase 4 means the grown sea becomes the main
   game's sea: the badge goes, ring saves carry over (the ring is unchanged and the new waters start
   fogged, so a save's ports and quests stay valid), FW2 save codes keep working, the map editor and
   the tools default to it, and `?bench` runs on it (desktop now; Charlotte's tablet whenever she can,
   not blocking).
2. **The east story is not built.** No `westholm-letter`, `fogwatch-amber` or `outpost-east`
   quest; Elias Morrow and Pip Holt are not in `characters.json` (no portraits, voices);
   Amber Strand cannot be founded. The brief has the east's names and Elias's Stormbreak line but
   no step table yet. The thread "Write the east sea's quests" owns this.
3. **Balance on the grown sea fails.** `npm run balance -- --map phase4`: economy 5/10, levels 3/9
   on all three difficulties. Sloop legs 113 / 121 / 117 s median (target 40–90 s), the cutter
   "never" on every level, top route 47 %, repairs 12–33 % of income. Part of this is the tool: the
   bots trade with every far port from the first minute, while the game opens the seas one by one
   through the story, and the targets are the ring's early game. Needed: the balance bots play the
   grown sea as the game does (the ring first, each sea once its letter is done) with late-game
   targets for the far-goods routes, then tuning where it still fails, on all three levels.
4. **A full playtest of a new game on the grown sea, all three difficulties,** after 1 to 3:
   prologue, the ring arcs, then each sea's three arcs in order, with screenshots for Guillaume
   (`npm run quest -- play <id> --step N --shots`).
5. **Open PRs land or close first:** #193 (density wording), #195 (basalt boulders, 0182), #199
   (controller buttons on quest cards, 0187).

## Smaller things seen (to fix with gap 1, art director to confirm)

- The moored port's "<port> · your island" label sits under the quest target pill at the top of the
  screen (all four ports in the shots).
- Chart labels collide by the Calving Grounds: "The Cold Sea (cold sea)" runs into "The Calving
  Grounds".
- `npm run shots -- --moor sunreach` frames the hillside, not the boat at the quay.
- The chart's market list shows every far good (obsidian, amber…) before their seas are charted.
- `--moor` makes the port "Home at <port>" in the shots (a tool side effect, harmless).

## Left for later on purpose (not blocking)

- Outpost build spots (repairs, storage, shelter), left out of 0157.
- Xbox: a bigger couch text size and a no-typing save transfer, waiting on Guillaume's test (0183).
- The big-event panel (0174), an idea, not to be built until Guillaume asks.
- `npm run check` warning when a sea's density drops under the target (0180).
- Seeded maps and seasons (moved later by 0137); tides (0140).
- Charlotte's old-tablet `?bench` run: any time, never blocking.

## Screenshots (main, `?map=phase4`, desktop)

- [chart-phase4.png](chart-phase4.png): the whole grown sea, labelled (`npm run chart -- --sea phase4`).
- [chart-in-game-desktop.png](chart-in-game-desktop.png): the in-game chart of a new voyage, outer seas fogged.
- [sunreach-desktop.png](sunreach-desktop.png), [emberhold-desktop.png](emberhold-desktop.png),
  [rimewick-desktop.png](rimewick-desktop.png), [fogwatch-desktop.png](fogwatch-desktop.png): moored at each main port.

## Build threads proposed

| Thread | Does | Asks |
|---|---|---|
| Make the grown sea the main game | gap 1 + the small UI things | art director for the label overlap |
| Write the east sea's quests (already running) | gap 2 | head storyteller, Guillaume sees portraits and cards |
| Balance the grown sea | gap 3, tool first then tuning | storyteller on prices vs story order |
| Phase 4 playtest and release | gaps 4 and 5, then v0.4.x notes and ADR like 0138 | Guillaume sees the screenshots |
