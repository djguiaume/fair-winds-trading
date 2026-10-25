# 0214. Other boats on the sea

**Status:** Proposed (2026-10-25).

## Context

The Phase 5 brief (ADR 0207, `docs/phase-5/brief.md`, part 4, "living sea") asks for other boats
that sail and tack like the player's. There are three kinds: fishing boats near their port,
small coasters on lanes between ports, and rare visitors from the far seas. They must sail by the
real wind, never ram, dock, show a light at night, and be capped per quality level. The old
tablet is GPU-bound (0006, 0115). They must be data (0093), editable in the sea editor and its CLI
(0153, 0161), checked by `npm run check`, and switchable in Settings because they could annoy.
The later regatta thread builds on this.

The storyteller laid the fleets, names and quest tags (`plan/story/phase5-words.md` C). The art
director set the look: home colours, cream sails never pure white, a livery band for each far sea,
no brass pennant (the player keeps the only one), a style D label, and a lantern plus a masthead
light at night.

## Decision

- **Data.** Each map or sea file has a `traffic` list of fleets: `{id, kind, home, to?, names[],
  path?, grounds?, ship?, livery?, tags?}`. Each name is one boat. `path` holds the marks between
  the two harbours; a fishing fleet has `grounds` (x, y, r). Tags (`after:`, `before:`, …) show
  and hide a fleet like a sea mark, and a fleet whose port is not founded stays off the sea. The
  tuning lives in `seamanship.json › traffic`: caps `atOnce` {low 3, medium 6, high 10}, ranges,
  helm numbers, dwell and casts, and per kind the ship class, speed share and scale. 21 fleets
  with 26 boats ship (7 on the ring and 14 in the four seas). Visitors and outer-sea coasters wait
  for their sea's outpost quest.
- **Sailing** (`src/sim/traffic.ts`). Boats use the player's own `stepBoat` (polar, no-go zone,
  rudder) in the wind where they are (zones and island shelter), with currents, and
  `resolveCollisions` against land, reefs, piers and the sea edge.
  - The helm plans by sailing time. Each lane mark has a grid of the time to reach it by water in
    this wind, rounded to 15°, with eight neighbours. Upwind stretches cost what beating up them
    costs, and the current helps or hinders. The helm scores every heading she can sail, plus both
    close-hauled courses, by where that heading takes her in the same time.
  - She keeps her tack until the other gains clearly and `minTackSec` has passed, unless land is
    ahead. She bears away a little after a tack to build speed.
  - By a harbour, or pinned against a shore and slow, she lowers sail and rows (sweeps, 2 kn), so
    a lee shore never traps her.
  - She waits at each harbour for 20 to 60 s, and a fishing boat makes 3 to 6 casts on its
    grounds with sails down.
  - Only the nearest `cap` boats within `activeRange` sail. A sleeping boat wakes only out of
    sight, unless the view jumped.
  - A touch with the player is a soft bump (a `bump` event) with no damage. Two traffic boats push
    apart.
  - Traffic is not saved: a loaded voyage puts the boats back from the seed.
- **Checks** (`src/sim/trafficChecks.ts`). The quick checks are run by `npm run check`, the editor
  and the CLI. They cover ids, names, kinds, ports, ship classes, and every lane in open water,
  using the quest-moved land the fleet sails among.
  - The sail check runs with the route checks (`npm run check` routes, and `tests/traffic.test.ts`
    on the game sea). One boat of every fleet sails out and home alone in winds from N, E, S and W
    with the currents on. It must not give up a mark and must be home within its time budget.
  - All 84 runs pass. Watchman Key's oil lane is laid by hand through the reef gap north of Gull
    Hook. The planner's lane went up the current, where a hoy cannot beat against it.
- **Lanes** are laid by the route planner (`routeLane`). It keeps `laneRoom` (12) more water than
  the hull needs, or half that, or just clear, where a passage is narrower. It tries open water
  just off a harbour mark the planner cannot reach, and pulls the result straight.
  - In the CLI: `npm run sea -- add fleet --sea south --kind coaster --home sunreach --to
    palm-key --names "A,B" --route`, and `set fleet <id> --route` or `--path "x,y …"`.
  - In the sea editor: the Add fleet tool, the fleet panel (kind, ports, names, ship, livery,
    stands, Route), and draggable marks on the chart's "Other boats" layer.
- **Look** (`src/render/traffic.ts`). Fishing boats and coasters are prop recipes
  (`traffic-fishing`, 76 triangles; `traffic-coaster`, 252; `traffic-sail`), coloured by the home
  island's style (`boatBand` per style in the palette).
  - They are instanced: one draw for every hull of a kind and colour, one for each of its sails.
    Each sail swings by the player's boom rule.
  - A visitor is her class's real model with the `livery*` band. Only one is drawn at a time.
  - Sails are a warm cream (`boatSail`), red-brown on the east's fog and strand islands. A boat
    with her sails down (at a harbour, on her nets) keeps the sail half up, streaming downwind,
    so every boat shows the wind.
  - Boats heel a little and pitch on the waves. At night small warm lamps (the lit-window colour,
    no halo, never brighter than the player's lantern): a fishing boat shows a stern lamp, and a
    coaster or visitor a stern lamp and a masthead pin.
- **HUD.** "{name}, out of {port}" (« {name}, de {port} ») fades in within `labelRange` (30) of
  the nearest boat, never on one lying at a harbour or on her nets.
- **Settings.** Settings › Other ships switches them off. The quality level sets the cap.

## Consequences

- The sea has company: a few boats near every port of the ring, more as the outer seas open.
- The regatta thread can reuse the helm, the time grid and the soft bump for racing boats.
- Each mark's time grid costs a few milliseconds the first time a boat sails for it in a new wind,
  and is then kept (24 per fleet). The sail check takes about 9 s for the game sea.
- Hand-laid lanes such as Watchman Key's must be re-checked when the map changes there.
  `npm run check` names any lane that runs onto land.
- Not done yet, and named for follow-up: smaller wakes for traffic boats, the visitor's two-pose
  far mesh (today it is the full model, one at a time), deck cargo by the home port's first good,
  and a `?bench` run with traffic on the old tablet.
