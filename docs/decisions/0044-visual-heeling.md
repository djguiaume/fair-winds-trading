# 0044. Visual heeling: the boat leans with the wind

**Status:** Implementation for review, 2026-10-20 (Guillaume said yes to the proposal). Numbers are starting values to tune in play.

**Context:** The boat model already tilted a little, but the tilt followed the speed polar and jumped instantly with every change, so it barely read as the wind pushing on the sails. Guillaume likes the current wind feel and wanted the boat to heel like a real one: more on a reach, little running downwind, a lurch in gusts, and different for a wide, heavy hull than for a tall, slim rig. The game must stay smooth on an old tablet and a phone ([0006](0006-desktop-and-mobile.md)).

**Decision:**

- **Purely visual.** `src/render/heel.ts` turns the wind the boat feels into a roll of the boat model (`BoatPose.heel`). The simulation, speed and controls do not change.
- **What sets the heel:**
  - Point of sail: none in irons or while the sails flap, the most from a close reach to a beam reach, falling to about an eighth of that dead downwind.
  - Wind strength: the wind the boat feels, so weather shifts ([0026](0026-slow-weather-shifts.md)), the calm lee of an island and faster flanks and channels ([0027](0027-islands-shape-the-wind.md)) all show. It grows a little faster than the wind (power 1.25): about 14° for a stock sloop on a beam reach in the 14 kn breeze, never past 23°. That is 1.3× a realistic heel (a small sloop sails at 10 to 20° in a fresh breeze, heavy cargo ships 5 to 10°): Guillaume asked for it on 2026-10-20 so the lean reads from the high camera.
  - Sail area: reefing stands her up.
  - Gusts: wind above its last 4 seconds' average adds an extra lean, so the boat lurches as a gust arrives and settles after.
  - Ship class: `HEEL_FACTOR` per class, 1 = sloop. Swift line (cutter 1.05, schooner 1.15, clipper 1.05) leans most; warships (ketch 0.85, brig 0.75, frigate 0.65) and haulers (hoy 0.75, fluyt 0.6, indiaman 0.5) stand stiffer, as in [0035](0035-three-ship-lines.md). An unknown class uses 1.
- **Motion:** a damped spring follows the target heel, so the hull rocks a little past the new angle when the wind changes and settles. Medium and High use a lively feel (1.8 s roll, some overshoot); **Low** uses a calmer, fully damped one (2.6 s, no overshoot, half the gust lurch). Small fixed steps keep it stable at any frame rate.
- **Cost:** a few multiplications per frame and one rotation already applied to the model: no extra draw calls, geometry or textures on any quality level.

**Consequences:**

- Players see the wind strength and the point of sail on the boat itself, on top of the compass and streaks ([0040](0040-visible-wind-strength.md)).
- New ship models only need an entry in `HEEL_FACTOR` (all planned classes already have one).
- Tuning knobs live in `src/render/heel.ts`: `BASE_HEEL`, `MAX_HEEL`, `HEEL_FACTOR`, `HEEL_FEEL`.
- Screenshots (phone, landscape): [sloop on a beam reach](../screenshots/heel-sloop-beam-reach-phone.png), [sloop running](../screenshots/heel-sloop-running-phone.png), [cutter on a beam reach, other tack](../screenshots/heel-cutter-beam-reach-phone.png).
