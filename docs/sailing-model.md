# Sailing model

How boats move in Fair Winds Trading, and which numbers to change to tune the feel. Code: `src/sim/` (no three.js imports, unit-tested in `tests/`). Decisions: [0007](decisions/0007-arcade-sailing-with-tacking.md), [0011](decisions/0011-phase-0-prototype-choices.md).

## Conventions

- The sea is a 2D plane: x east, y north, 1 unit ≈ 1 m. The renderer maps it to three.js as `(x, 0, -y)`.
- Angles are compass bearings in radians (0 = north, clockwise).
- Wind `from` is where the wind comes from (sailor convention). The **true wind angle** (TWA) is the angle between the bow and the wind: 0 = bow into the wind, 180° = wind from astern. Positive when the wind comes over the starboard (right) side.
- The simulation runs at a fixed 60 steps per second, independent of the frame rate.

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
