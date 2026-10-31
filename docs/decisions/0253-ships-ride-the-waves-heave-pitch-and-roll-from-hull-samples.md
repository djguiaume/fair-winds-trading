# 0253. Ships ride the waves: heave, pitch and roll from hull samples

**Status:** Proposed (2026-10-31). Issue #283, v1.3.1.

## Context

v1.3 drew real waves (0245, 0248-0250) but the ship only rose with the sea under two points and
pitched by their slope, with the pitch applied about the world's east-west axis (a roll when she
sailed east or west). The art director's brief for #283: roll with the swell, not every ripple
(about 1.5 s), roll at most 6° on a sloop or schooner, 4° fluyt, 3° indiaman, pitch 5° / 3.5° /
2.5°, up to about 1.5x in a storm, no bow burying, no HUD tilt, Gentle sea motion respected, waves
off = no ride.

## Decision

- `src/render/boatRide.ts` `BoatRide`: four points of the shared sea (`SeaWaves.heightAt`, the same
  field the ocean draws): bow and stern `bowStern` × her length apart, both sides `beam` × her beam
  apart, from her `wakeHull` (her ship file's hull × `HULL_SCALE`). Rise = their mean, smoothed
  `heaveSec` (0.1 s); pitch and roll = the slopes between them, smoothed `tiltSec` (1.5 s).
- Caps by hull length: `small` (18 m: 6° roll, 5° pitch) to `big` (28.6 m: 3°, 2.5°), blended
  between; a full storm opens them by `storm` (0.5). A soft limit (tanh), so no hard stop.
- Driven by the world's time: same at any frame rate, still when paused, reset if the clock goes
  back. Euler order YXZ: heading, then pitch about her own beam, then roll about her keel; the sail
  heel (0044) adds inside the model, so mast, rigging, lantern and cargo follow.
- Alongside a berth (`trade.dockedAt`) the tilt eases out over `dockSec` (2 s); the rise stays.
  Waves off (Low, Ultra-low): rise only, no tilt. Gentle sea motion: `motion.gentle` of the tilt.
- The far-sea visitor and Kestrel ride the same way; the instanced small boats keep their light
  two-point float. All numbers in `waves.json › motion` (`?tune` Waves tab, `npm run sea -- waves`).

**Rise is the sea's, not the brief's ±0.25 / 0.4 / 0.6 m.** The v1.3 sea stands about ±1 unit at
14 kn and ±2.8 in a storm; a ship that rose less would have crests over her deck. Measured (2 min,
every ship, 20 kn and storm, head and beam seas): rise ±0.9 at 14 kn, ±2.6 in a storm; roll up to
6° (sloop, storm, beam), pitch up to 5.5°; the bow keeps at least 0.4 units of freeboard (tern,
storm, head sea), the indiaman 1.5. `motion.heave` under 1 trades rise for wet decks.

## Consequences

- Drawing only: the sim, polars, grounding, berths and races never read the ride (#284 adds
  bounded sailing effects).
- Cost: four height lookups per full ship model (about 10 µs each frame for the player).
- Contact sheet: [docs/reviews/boat-ride/ride-sheet.jpg](../reviews/boat-ride/ride-sheet.jpg) (High, `?waves=storm` and `wind`).
