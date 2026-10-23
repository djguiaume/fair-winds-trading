# 0122. Community arcs: the people, their steps and the building pairs

**Status:** Accepted, 2026-10-23 (Guillaume, after one round of feedback). Names are placeholders.

## Context

[0120](0120-communities-and-home-island.md) chose about 4 community arcs of about 3 steps, each changing its port visibly and ending with a choice of two buildings for the home island. The story, the people and the buildings were left open. Guillaume asked (2026-10-23) for placeholder names so the art direction can start, and how long the story should be compared with similar games.

## Decision

The full proposal is [docs/story/community-arcs.md](../story/community-arcs.md). In short:

1. **The tutorial becomes the prologue** (Guillaume's idea, 2026-10-23): you start at sea, learn the controls, follow a foghorn to a wreck, rescue Saltmere's harbourmaster and take him home; he gives you a run-down island; the first trade follows as today.
   **Four arcs, each about its town's trade**, open together after it: Saltmere (fish: find the shoals past the reef), Port Calda (timber: rebuild the slipway, fetch a mast tree, launch a pilot cutter), Westholm (grain: the mill) and Stonehaven (stone: a lighthouse on the reef, which leads you to Watchman Key). Watchman Key and Abbey Head arcs come later.
2. **Steps mix kinds:** at most one plain delivery per arc and at least one step about sailing well (precision near a reef, gates, a timed run with free retries). Every step works in the starter ships and with night and storms switched off.
3. **Each arc changes its port in a specific way** (boats and buoys at sea, a building at every level, a good made one level earlier, one level up once, a lit reef), never as extra growth.
4. **Four pairs of sidegrade buildings** with 10 to 25 % modifiers: Lookout or Pilot house, Workshop or Rigging loft, Warehouse or Bakehouse, Weather glass or Boathouse. Six change numbers that already exist; home storage and the wind forecast are new.
5. **Length target: 3 to 5 hours of story** (prologue + 4 arcs), 6 to 8 hours for everything, estimated from the balance test's leg times; in line with small cozy games (A Short Hike, Alba, Lil Gator Game: 1.5 to 3 h main story).
6. **Provisional "comes back later" rule, as a suggestion to try:** 4 arc spots and 2 spare spots; passed-over buildings can go on a spare spot for gold after the story.

## Consequences

- The quest engine gets a concrete list of step kinds (the doc's "What the quest engine needs"), and the home island work gets 6 spots and 8 buildings.
- The tutorial changes order and setting (its lessons stay); skipping it, and old voyages, still get the island from the harbourmaster at Saltmere.
- The characters' look work can draw the six people from the doc's table.
- The arcs are written as `src/data/quests/` files, `characters.json` and `buildings.json`, with English and French text.
