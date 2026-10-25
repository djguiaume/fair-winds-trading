# 0217. The Saltmere Regatta

**Status:** Accepted (2026-10-25, Guillaume approved the screenshots).

## Context

The Phase 5 brief (ADR 0207, `docs/phase-5/brief.md` part 5, `docs/phase-5/story.md`) asks for
regattas in the story: races against a friendly rival captain, unlocked through the story, with
medals and prizes. The storyteller set the cast, words, gold, pennants and the Cup in
`plan/story/regatta-words.md` (project files): Wren Tally and her cutter *Kestrel*, the Saltmere
Regatta after `fair-winds`, three ring races, one race in each outer sea, and the Four Winds Cup.
Racing gives pride, not power: no perk. The start is a horn, never a gun (the game has no
weapons). Races must be quests on the quest engine (0125), data (0093), editable in the quest
builder and an npm command (0153), fair on all three levels (0083), and built on the other boats'
helm (0215) and standing orders (0214).

## Decision

- **A race is a quest.** It has a `race` block `{series, gold: {bronze, silver, gold}, pars:
  {ship → {fair, captain, salt} seconds}}`, an optional `starter` (who speaks at the line,
  `<text>.race.start`), `offer: true`, its own pinned `wind` and `storms: false`, and one step
  whose goal is the new **`raced`** condition `{start: gate, marks: points, finish: gate,
  within?}`. A gate is two points: the committee boat's end, then the pin's. The step's `moveTo`
  puts the boat behind the line. `checkQuests` refuses a race that is a main quest, a lesson, a
  standing order, has a reward, or more than one step, and a `raced` goal outside a race.
- **The race** (`src/sim/questLibrary.ts › raced`, three slots: state, hundredths, progress).
  A 10 s sequence ends on the horn (`regatta.json › countdownSec`); it only counts down while the
  sea is on screen. The start line counts when crossed toward the course from the far side, after
  the horn; over early, the captain goes back and crosses again. Marks are rounded in order within
  16 units (`within`), then the finish line is crossed. Docking mid-race, or the pill's ×, gives
  the race up: a race never finished is offered again, one finished before keeps its record.
- **Medals and gold** (`src/sim/regatta.ts`, `src/data/regatta.json`). The pars are per ship class
  and level; gold is the par, silver par × 1.15, bronze par × 1.35. A class with no par is held to
  the slowest. Each medal pays its gold the first time it is won (a first gold pays all three):
  ring 60/120/200, seas 120/240/400, Cup 250/500/800, about 5,700 in all. The best time and medal
  are kept in the quest's progress, in the JSON save and the FW2 save code. A race finished once
  is done (`questsDone`) and can be sailed again from the result card or the Quay.
- **Series and pennants.** A series is won with silver or better in each of its races (the ring
  3, the seas 4, the Cup 1). Its id counts as done, so props can wait on it: the Four Winds Cup
  stands on Skerry's pier (`regatta-cup` prop, `after:regatta-cup`). The latest series won flies
  at the masthead as a pennant from `src/data/flags.json` (flags as data: shape, bands from the
  mast out, size), drawn as one vertex-coloured mesh (`src/render/models/flag.ts`).
- **Kestrel** (`src/sim/rival.ts`) is a living-sea boat (0215) with a `racer` block: she waits at
  the line beside the captain, sails the course on the other boats' helm at the horn (no give-way,
  sweeps only when pinned), finishes on the finish line, then leaves. Her speed is scaled so she
  finishes about on the captain's silver time on that ship and level (`rival.pace`), so beating
  her is silver everywhere. A cutter in white with Wren's red band, cream sails and her red and
  white burgee. Not saved: a voyage loaded mid-race starts her again at the line.
- **Pars from the bots** (`src/sim/raceBot.ts`). A racer of each ship class sails each course from
  its start in its pinned wind with each level's currents, every quest's land in place.
  `npm run race -- <id> --pars --write` writes the pars. The big hulls (fluyt, indiaman) and the
  hoy cannot get round some courses on the bots' coarse grid; their pars are worked out from the
  others by speed ratio and listed as estimated.
- **Courses** (charts in `docs/reviews/regatta/`): Round the Gap (Kit's East Reef gap buoys), the
  Calda Dash (Saltmere to Port Calda), Round Greyback (from Port Calda, Ines starting), the
  Narrows Run (round Palm Key from Sunreach; the Narrows are a shallow keel's short cut, the long
  way stays open), Round the Smoulder (from Emberhold, clear of the eruption site), the Floe Line
  Race (from Rimewick, off the ice), the Stormbreak Crossing (from Fogwatch, holds with storms
  off) and the Four Winds Cup (out of Saltmere, a mark off each sea's gateway, finishing at
  Skerry). Each sea race opens with that sea's outpost; the Cup after `four-winds`.
- **Screens.** The course pill shows "Horn in 7", then "Cross the start line", "Mark 2 of 3",
  "To the finish line" (short forms on a phone held upright), the clock, and × to retire; it
  points at the next line or mark, the next mark carries the quest ring, and the chart draws the
  course in yellow. The starter's line shows at the start, the horn sounds (`race-horn`) with a
  toast. The result card (Wren, pleased) gives the medal, her line for it, the time against
  Kestrel's, a new best, the series won and its pennant, the gold, and **Race again**. A race's
  offer shows the medal times for the captain's ship and the gold of each; the Quay lists the
  regatta book: each race of that harbour sailed before, its best and medal, Race again.
- **Marks** are prop recipes (0135): a tall yellow racing mark, an orange pin, a white committee
  boat dressed with bunting bow to masthead to stern and chunky signal flags (orange start, blue
  finish). Each line is drawn on the water as cream dashes from its boat to its pin
  (`SeaMarks`), riding the waves. They are sea marks of the running race
  (`race-mark`, `race-pin`, `race-committee`, `race-finish`) and chart dots.
- **Wren's standing order** (`standing-wren`, 0214): after the three ring races are finished,
  timber, grain and stone at Saltmere, in the storyteller's words.
- **Authoring.** Quest builder: a Race switch on the quest form (series, medal gold, starter,
  pars), the gate fields, and the marks and both lines' ends dragged on its chart. CLI:
  `npm run race` (list; `<id>` course and medal times; `--pars [--write]`, `--all`; `--start`,
  `--finish`, `--add --at`, `--mark N --at|--remove`; `--overlay file.json` for `npm run chart`).
  `npm run check` runs the race checks with the quest checks.

## Consequences

- Races are a small, one-off share of income: about 7 % of a full Fair winds game, 11 % on
  Captain and 13 % on Old salt (from `npm run balance -- --map phase4`: ring and late rates over
  the time to found every outpost). The economy bots are unchanged and pass on all three levels.
- A race is fair on every ship and level because its pars come from the same sailing model; a
  new course needs `npm run race -- <id> --pars --write` after any change to it or to the map.
- The fluyt, indiaman and hoy pars are estimates where their bots stick; a better bot helm can
  replace them later.
- In-game screenshots of a race in motion need a scene script: headless Chromium runs the game
  too slowly for the horn to go in a shot.
- *Kestrel*'s sail number K 7 is block strokes painted through her mainsail
  (`BoatModelOptions.sailNumber`), a child of the sail so it fills and furls with it. UI words not in the storyteller's file (pill lines, "Enter the race", "The regatta
  book", medal names) were written to match and can be changed in the language files.

## Play-test fixes (2026-10-25)

Guillaume's first play-test: the lines were too short for two boats side by side, and *Kestrel*
sailed through the fishing boats and into the captain. Now every start and finish line is at
least `regatta.json › minLine` (80) long, which a quest check enforces. The captain starts mid-line.
*Kestrel* waits along the line with both hulls and `rival.berth` of clear water between them,
always behind it. Past the finish she sails on `rival.runOut` (40) before lying to. She bears away
from the captain and the other boats close ahead, is kept apart from them, and a touch slows both
her and the captain. The Calda Dash finishes 38 units further south, clear of the boats waiting off
Port Calda's dock. Every other boat (0215) now touches as an oval rather than a circle: its radius
along the keel and `seamanship.traffic.abeam` (0.42) of it across, at `touch` 1.1. The old round
circle stood far out from a hull's sides. The pars were sailed again.
