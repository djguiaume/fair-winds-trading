# v1.1 — "The Sailing Club" (potential plan)

Status: **potential plan**, not scheduled. Nothing here starts before v1.0 ships, and it does not
change the Phase 5 plan ([brief](../phase-5/brief.md)). Written from Guillaume's notes of
2026-10-25.

## The idea

The first update after v1.0 is **bug fixes plus new races**.

- **Name: "The Sailing Club"** (« Le Club de voile »), picked over "Gotta go fast" because it
  fits the game's calm tone, and confirmed by the Head storyteller on 2026-10-25.
- **Pitch** (storyteller): "Wren opens a sailing club at Saltmere: new courses round the islands,
  a few with a squall to sail around, and a club board for your best times." / « Wren ouvre un
  club de voile à Saltmere : de nouveaux parcours autour des îles, certains avec un grain à
  contourner, et un tableau du club pour vos meilleurs temps. »
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
- **Story rule** (storyteller): no race text may depend on a storm. With Storms off the course
  still runs, and the lines mention "weather" or "squall" only as flavour, as Elias does with the
  Stormbreak.
- Needs its own decision (ADR) when it is built.

**When:** saved for the new v1.1 races. If Guillaume wants it in one of today's races sooner, it
can be built then.

## Open questions

- How many new races, and where (the storyteller and the map).
- The club board for best times: where it lives (Saltmere's Quay, or a board of its own) and
  what it shows.

## Candidate: a camera the player can turn

Guillaume asked on 2026-10-25 whether the camera could be moved: the right stick on a controller
(click it to reset), right-click drag on a PC, and something that works on a phone. This is a
**feasibility check only**: nothing is built, and it is a candidate for v1.1, not a commitment.

**Verdict: feasible, medium size.** The camera is one small piece of code: `src/render/view.ts`
`render()` places it at a fixed pitch (`CAMERA_PITCH` 58°) and distance (`BASE_DISTANCE` 110 ×
zoom), always looking north, easing after a target a little ahead of the boat. Turning it means
adding a **yaw** (round the boat) and a limited **tilt** to that one placement. The sim, the
steering and the saves do not care where the camera looks.

### Controls

| Device | Turn the camera | Reset | Clashes today |
| --- | --- | --- | --- |
| Controller | Right stick left/right turns round the boat | Click the right stick (RS) | The right stick's up/down is zoom (`controls.json` › `sea.zoomAxis: "ry"`); keep it. RS is free at sea (the chart uses it for "fit", a different context). Port screens use the right stick to scroll, but only while a menu is open. |
| PC | Right-button drag (left/right turns, up/down tilts) | Double right-click, or a key such as Home | Left drag steers and the wheel zooms (`src/input/input.ts`); the right button is ignored today, so it is free. The canvas must block the browser's context menu. |
| Phone / tablet | **Two-finger drag** sideways turns, two fingers up/down tilt; a pinch zooms | A small "reset view" button that shows only while the camera is turned | One finger anywhere steers (`input.ts` drag). When a second finger lands, the steering drag is dropped (rudder back to 0) and the gesture becomes the camera; it never steers again until all fingers lift. Phones have no zoom gesture today, so the pinch is a bonus. |

The touch choice keeps one finger = steer, which every player already knows. Its one rough edge:
the first finger steers for the moment before the second lands. That blip is short (the rudder
eases), and it can be hidden by holding the rudder for ~80 ms after a touch starts if playtests
show it.

### What assumes a north-up camera today

- **Wind compass** in the HUD (`src/ui/hud.ts`): drawn north-up; it must turn with the camera
  (or show a small north mark), or the player reads the wind wrong.
- **Rain** (`src/render/rain.ts`) spreads its drops for a camera looking north; it needs the yaw.
- **Focus views** (Skerry's plots with `PLOT_CAMERA`, harbour approach, quest `--look` shots)
  shift the target with north-up maths: the turned camera resets (eases back) while one of these
  is active.
- Quest arrows, port labels and pier positions already project through the camera
  (`screenBearing`, `project`), so they keep working.
- The far plane and fog are set from the camera distance, so yaw changes nothing there; **tilt**
  does, because a flatter camera sees farther.

### Performance on the old tablet

Turning (yaw) costs nothing: the same amount of sea is on screen, the ocean grid and the
140-unit shadow box follow the target and are square. **Tilt** is the risk: looking flatter
shows more islands, towns and sky, and the tablet is fill-rate bound (ADR 0005/0115). So the tilt
range stays narrow (about 50° to 70°, data-driven) and the far plane still stops at the fog. Check
with `?bench` at both tilt limits before merging; if the tablet drops, ship yaw only.

### Settings

- **Settings › Camera › "Turn the camera"** (on by default): off keeps today's fixed view and
  ignores the right stick's sideways, right-drag and two-finger drag, for players who like the
  map-like north-up view.
- **"Camera comes back by itself"** (off by default): eases back behind north after a few seconds
  without camera input.

### Data, editor and CLI (ADR 0093, editors-plus-CLI rule)

- The camera numbers move out of `view.ts` into data: default pitch, tilt range, distance, zoom
  range (today `clamp(zoom, 0.6, 1.7)`), turn speed per stick, degrees per pixel for mouse and
  touch, the ease time and the reset ease. They sit in the tuning data with `tuning-meta`
  entries, so the editors' Tuning page and `?tune` edit them.
- The controller axis and reset button go in `controls.json` › `sea` (`orbitAxis: "rx"`,
  `actions.resetCamera: ["rs"]`), edited on the editors' Controls page and checked by
  `npm run check -- --only controls`.
- CLI: `npm run shots -- --yaw 40 --tilt 52` takes screenshots from a turned camera, and
  `npm run shots -- --pad "rx=0.8:800,rs:100"` already fakes the stick and the reset.

### Size

About **one build thread and one PR**: camera placement and easing in `view.ts`, the three
inputs in `input.ts`/`gamepad.ts`, the compass and rain fixes, the Settings rows, the data and
meta entries, the `shots` options, tests, and an ADR. Then Guillaume's playtest on the Xbox, a
phone and the old tablet. Similar in size to the harbour screen header (ADR 0211).
