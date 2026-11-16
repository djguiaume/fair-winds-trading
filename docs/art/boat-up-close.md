# The boat up close (issues #553, #554, decision 0326)

What the player's boat adds when the camera is near, and what it costs. Numbers live in
`graphics.json › closeUp` and `waves.json › spray` (`npm run tune -- list graphics.closeUp`,
the `?tune` panel's Graphics and Waves tabs).

## What she shows

- **A helmsman** at the tiller on the weather side, in her look's colours (coat in the hull band,
  cap and sou'wester flap in the sail band, no face: art direction for v1.13). He leans out
  against the heel and walks across in a tack. Recipe `src/data/props/boat-sailor.json`.
- **Hands**: `closeUp.hands.<ship>` more sailors along the weather rail (sloop, cutter and the
  racers 0, schooner, clipper, hoy and fluyt 1, indiaman 2). `closeUp.extraHands` adds one to
  every ship: 0 is detail option A, 1 is option B.
- **A tiller that turns** with the helm (to port to turn her to starboard). The hoy, fluyt and
  indiaman keep their own fixed helm from their deck details.
- **Sails that trim**: flatter close-hauled (`bellyCloseHauled`), fuller running
  (`bellyRunning`); the boom swings across a tack or gybe at `boomSwingDegPerSec` instead of
  jumping, and the sail fills on the new side as it crosses.
- **Two coiled lines** on deck, by the mast and by the helm (`closeUp.coils`).
- **Spray** (`waves.json › spray`): nothing under 3 kn, a small bow curl at 4 to 5 kn, a clear bow
  spray at 7 kn and more into head seas; a splash to leeward when a gust heels her; a burst
  when she bumps a quay or a shoal. Opaque low-poly bits in a foam colour under `#f6f9fb`.
- **The follow cam leans** with her heel, at most 3° and slower than the heel; Settings › Motion
  reduced (or off) steadies it and stops the camera riding the waves.

The far view, traffic boats and the previews keep today's model: only the player's boat is built
with `closeUp`, the crew shows only when the follow cam is in (`setCloseUp`), never on Low or
Ultra-low, and spray is off on Ultra-low.

## Triangle and draw budget per ship

Measured on each ship at upgrade level 3 (`tests/boat-close-up.test.ts` holds every ship under
900 added triangles). A sailor is 108 triangles, the two coils 96.

| Ship | Far model | Option A adds | Option B adds |
|---|---|---|---|
| Sloop, cutter, tern, tern pilot, tern yawl | 743 to 961 | 204 | 312 |
| Schooner, clipper | 1071, 1359 | 312 | 420 |
| Hoy, fluyt | 999, 1699 | 312 | 420 |
| Indiaman | 2167 | 420 | 528 |

- **Draw calls**: the tiller is its own mesh on the player's boat (+1 in both views, it left the
  hull mesh to turn); the crew is one mesh for every sailor (+1, follow cam only); the spray is
  one instanced draw (+1 while any flies). Traffic boats are unchanged.
- **Why it is worth it**: the boat is on screen every second of the follow cam (the v1.9 review's
  biggest miss against Saltline: nobody aboard, nothing moving). 200 to 500 triangles is under
  a tenth of one town house cluster; the two to three draws stay inside the follow-cam budget
  (`tools/performance/budget.json`).
- **Spray**: at most 64 bits of 20 triangles (1280 triangles at the very most, about 300 in a
  steady 7 kn run), fixed arrays, nothing allocated per frame.
