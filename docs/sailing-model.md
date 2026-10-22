# Sailing model

How boats move in Fair Winds Trading, and which numbers to change to tune the feel. Code: `src/sim/` (no three.js imports, unit-tested in `tests/`). Decisions: [0007](decisions/0007-arcade-sailing-with-tacking.md), [0013](decisions/0013-phase-0-prototype-choices.md).

## Conventions

- The sea is a 2D plane: x east, y north, 1 unit ≈ 1 m. The renderer maps it to three.js as `(x, 0, -y)`.
- Angles are compass bearings in radians (0 = north, clockwise).
- Wind `from` is where the wind comes from (sailor convention). The **true wind angle** (TWA) is the angle between the bow and the wind: 0 = bow into the wind, 180° = wind from astern. Positive when the wind comes over the starboard (right) side.
- The simulation runs at a fixed 60 steps per second, independent of the frame rate.

## Wind the boat feels (`src/sim/wind.ts`)

- **Sea wind** (`windAt`): the map's prevailing wind, plus slow weather periods on the trading map (every 3 minutes the direction veers or backs up to 75° from the last period, drifting round the whole compass with a gentle pull to the prevailing wind, and the strength becomes ×0.8–1.15, easing over 60 s, [0026](decisions/0026-slow-weather-shifts.md), [0064](decisions/0064-wind-from-every-quarter.md)), plus regions of the sea where it bends up to ±40° and ±15 % stronger or weaker ([0064](decisions/0064-wind-from-every-quarter.md)), plus small gusts and swing. It is sampled at the boat's position. Each period is also a weather state (calm, breeze, rain or gale) that sets its strength range, and moving storms turn the wind round their centre and blow up to ×1.9 harder ([0067](decisions/0067-weather-states-and-storms.md)). Above 21 kn only a quarter of any extra wind drives the boat (`drivingWind`). Being pressed too hard throws cargo overboard: the wind she feels × point of sail × sail area, past the equivalent of 19.5 kn on a full-sailed beam reach for 3 s, or a hard gust while already pressed; breeze, rain and tacks never do ([0067](decisions/0067-weather-states-and-storms.md), [0074](decisions/0074-forgiving-cargo-overboard.md)). The sails control warns first: it turns amber past 18 kn (a gust could throw cargo) and red past 19.5 kn, reading the press right now so that the warning comes before the loss ([0078](decisions/0078-press-warning.md)).
- **Islands** (`windEffectAt`, [0027](decisions/0027-islands-shape-the-wind.md)): up to 55 % less wind right behind an island, fading over 70 units downwind; up to 10 % more beside one island's flank and 20 % more in a channel between two. Sandbanks don't block wind.
- `world.seaWind` is the open-sea wind; `world.wind` (what the boat, compass and HUD use) includes the island effects.
- **Heel** (`src/render/heel.ts`, [0044](decisions/0044-visual-heeling.md)): the boat model leans with `world.wind`, the point of sail, sail area, gusts and the class's `HEEL_FACTOR`. Render-only: it never changes speed or steering.

## Hazards (`src/sim/hazards.ts`, [0032](decisions/0032-reef-strikes-and-shallows.md), [0038](decisions/0038-hull-damage-from-any-crash.md))

- Within 14 units of a reef the hull drags: up to 0.6/s extra braking × the ship's `draft` (sloop 0.7, cutter 1, up to 1.8 for the indiaman).
- Striking a reef takes 6 hull points per knot lost; a damaged hull sails up to 25 % slower until repaired.
- Ramming a rocky shore or a pier takes 5 hull points per knot lost beyond a free 2-knot bump; sandbanks and the sea's edge are soft ([0038](decisions/0038-hull-damage-from-any-crash.md)). Piers are solid segments out to the pier head.

## Each step (`stepBoat` in `src/sim/boat.ts`)

1. **Sails** ease toward the requested step (0, ½, full) at 1.4 per second.
2. **Rudder** follows the steering input quickly. Turn rate = `turnRate × rudder × steerage`, where steerage grows from `minSteerage` (stopped) to 1 at `steerageSpeedKn`.
3. **Target speed** = `polar(TWA) × windKn × speedRatio × sail`.
4. **Speed** eases toward the target: at `accel` when speeding up, `decel` when slowing down, `ironsDecel` when inside the no-go zone. Turning hard costs a little speed (`turnDrag`).
5. **Leeway**: a small drift downwind (`leeway × windKn`, more with sails up). With no drive, it slowly pushes the boat backwards, which is what makes being "in irons" feel like a mistake.
6. **Move**: `(heading vector × speed + drift) × 1.6 units/s per knot`.
7. **Collisions** (`src/sim/collision.ts`): islands are circles; the boat is pushed out and loses speed in proportion to how head-on the hit was. The sea is a disc (`boundsRadius`).

## The sloop's polar curve

| TWA | 0–44° | 45° | 55° | 70° | 95° | 125° | 155° | 180° |
|---|---|---|---|---|---|---|---|---|
| Fraction of top speed | 0 (no-go) | 0.42 | 0.68 | 0.88 | **1.0** | 0.93 | 0.80 | 0.70 |

With 14 kn of wind, the sloop does ~8.7 kn on a beam reach, ~5 kn close-hauled and ~6 kn dead downwind.

## Tuning knobs (`SLOOP` in `src/sim/ship.ts`)

| Field | Value | Raise it to… |
|---|---|---|
| `noGoAngle` | 45° | make upwind harder (more tacking) |
| `speedRatio` | 0.62 | make the boat faster overall |
| `accel` | 0.55 /s | pick up speed sooner |
| `decel` | 0.30 /s | lose speed sooner when coasting (harder tacks) |
| `ironsDecel` | 0.9 /s | punish pointing into the wind harder |
| `turnRate` | 62°/s | turn faster |
| `minSteerage` | 0.4 | turn better when slow |
| `turnDrag` | 0.18 /s | make hard turns cost more speed |
| `leeway` | 0.045 | drift more downwind |

`tests/course.test.ts` runs a simple tacking autopilot around the practice course; it prints leg times (about 80 s for the upwind leg, 15 s for each reach) and fails if a lap becomes impossible or too long, which catches tuning that breaks the course.
