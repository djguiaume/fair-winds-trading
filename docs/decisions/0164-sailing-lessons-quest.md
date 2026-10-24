# 0164. Sailing lessons quest

**Status:** Proposed (2026-10-24).

## Context

Since the tutorial became the rescue prologue ([0127](0127-prologue-rescue-tutorial.md)) and skipping it still plays its story ([0160](0160-skipping-the-tutorial-keeps-its-story.md)), the title menu's "Replay tutorial" restarted the whole first voyage: the foghorn and Rook's rescue a second time, after he had already given the captain Skerry. Guillaume asked (2026-10-24) for a real tutorial quest about navigation only, in open water, voiced by Rook, and chose a fixed course off Saltmere with the player taken there, buoys shown only while the lesson runs, a steady wind that goes back to normal afterwards, all as quest data the engine and the quest builder support. The head storyteller approved Rook's lines (story-neutral: no rescue, Skerry or arcs, playable before or after the prologue; no reward) in `plan/sailing-lessons/` of the project files.

## Decision

- **A new lesson quest, `sailing-lessons.json`** (`start: asked`, `lesson: true`, `storms: false`, no reward), five steps on Rook's practice course off Saltmere: hoist and lower sails, find the no-go zone (3 s in irons), tack up to buoy A (dead upwind, at least two tacks), reach to buoy B (6 s on a beam reach), run home and dock at the home port. Rook's lines are in quotes on the coach bubble, English and French (`lessons.*`).
- **The menu line**: "Learn to sail & trade" while the tutorial is unseen, "Continue tutorial" while it runs, and afterwards **"Sailing lessons"** ("Continue the lessons", step N/5, while they run), on the title menu and the pause menu (the same panel). It starts the lessons from wherever the voyage is; it is disabled only while the prologue story runs without its coach. "Replay tutorial" is gone and the first voyage stays a one-time prologue.
- **Engine, all quest data** (also in the quest builder):
  - Step **`moveTo`** `{ x, y, headingDeg? }`: when the step begins the boat is taken there, sails down, off the pier, no course set (a `moved` event snaps the camera). Not on loading a save.
  - Quest **`marks`**: the quest's own sea marks (the existing `SeaMarkDef`, with a new `buoy-yellow` practice buoy, larger than a channel buoy, with a yellow X top mark), drawn at sea and on the chart **only while the quest runs**.
  - Quest **`wind`** `{ speedKn, fromDeg? }`: a steady breeze held over every step without its own `wind` while the quest is tracked; the sea's wind comes back as soon as it is not. The lessons hold 10 kn from 30°.
  - Conditions **`point-of-sail`** `{ point, holdSec }` (in-irons, close-hauled, beam-reach, broad-reach, running, the HUD's own `pointOfSail`) and **`tacked`** `{ count }`: the bow crossing the wind while within 90° of it; bearing away past abeam forgets the side, so a gybe round is no tack.
- **`npm run quest`** (Guillaume's rule: every editor feature has a CLI): `quest move <id> --step N --at x,y [--heading]`, `quest buoy <id> --at x,y [--name --type]` (or `<n> --at|--name|--type|--remove`), `quest wind <id> [--step N] --speed kn [--from deg]` (`--clear`), `--dry`. The edits are the builder's own (`setStepMove`, `addQuestMark`, `removeQuestMark`, `setWind` in `src/editor/quest/doc.ts`); the file is written as the builder exports it, then the quest's checks run.
- **Quest builder**: quest Wind and Sea marks rows (+ buoy tool on the map), a step's "Move boat to" row (+ boat tool), the marks and the boat start drawn on the chart.

## Consequences

- Any quest can now hold its own wind, show its own buoys and take the boat somewhere: races and timed events ([roadmap](../roadmap.md), fixed difficulty parameters) can use the same data.
- Starting the lessons moves the boat even mid-voyage; cargo, gold and quests are untouched, and the boat is left docked at Saltmere at the end.
- The course lies in the ring sea, which stays the centre of every map ([0137](0137-phase-4-biomes-and-founded-outposts.md)).
