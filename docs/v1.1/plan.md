# v1.1 — "The Sailing Club" (potential plan)

Status: **potential plan**, not scheduled. Nothing here starts before v1.0 ships, and it does not
change the Phase 5 plan ([brief](../phase-5/brief.md)). Written from Guillaume's notes of
2026-10-25.

## The idea

The first update after v1.0 is **bug fixes plus new races**.

- **Working title: "The Sailing Club"**, picked over "Gotta go fast" because it fits the game's
  calm tone. The Head storyteller names the update; this title stands until they do.
- It builds on the Saltmere Regatta ([0217](../decisions/0217-the-saltmere-regatta.md)): Wren
  Tally, *Kestrel*, races as quests with a `raced` goal, pars set by the balance bots on all three
  levels, `npm run race`.

## What is in it

1. **Bug fixes** gathered from v1.0 play (playtests, the old-tablet test, reports).
2. **New races**, as quests like today's eight, with their words from the storyteller and their
   pars written by the bots (`npm run race -- --all --pars --write`).
3. **Fixed storm positions in races** (below), so a storm to dodge gives a course its character.

## Fixed storms in races

**Today:** storms are generated from the voyage's seed and drift across the sea
(`src/sim/storms.ts`). A quest can only switch them off with `storms: false`
(`src/sim/quests.ts`), and every race does, so the pars stay fair.

**Planned:** a race file lists its own storms instead.

- Each storm has a **position**, a **size**, a **strength** and an optional **slow drift**.
- They are the **same on every run**, so the bots sail around them when they set the pars, and
  each level stays fair.
- The race's storms replace the seeded ones while it runs (seeded storms stay held, as today).
- Placed by **dragging in the quest builder**, or with the CLI:
  `npm run race -- <id> --storm --at x,y` (with size, strength and drift options, and a way to
  move or remove one), matching the editors-plus-CLI rule.
- The **Settings › Storms** switch still turns them off; the pars must then still make sense
  (the bots set pars with and without the storms, or the race keeps one set of pars that holds
  either way: to decide when it is built).
- The quest checks (`npm run check`) check the storms: inside the sea, not on the start, finish or
  a mark, and the course still sailable round them.
- Needs its own decision (ADR) when it is built.

**When:** saved for the new v1.1 races. If Guillaume wants it in one of today's races sooner, it
can be built then.

## Open questions

- The update's name (the Head storyteller).
- How many new races, and where (the storyteller and the map; maybe a club house or regatta board
  at Saltmere, see the 0217 thread's note on keeping races in each harbour's Quay).
