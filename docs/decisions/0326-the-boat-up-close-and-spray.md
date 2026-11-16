# 0326. The boat up close and spray

**Status:** Accepted (2026-11-16). Built for v1.13 "Soft and rich" (#553, #554); Guillaume reviews the sheets once at the end of the release.

## Context

The v1.9 whole-game review (`docs/reviews/whole-game-v1.9/README.md`, section 4) found the boat, on screen every second of the follow cam, read as a model: nobody aboard, a flat sail, a boom that jumped across, a tiller that never moved, and the same picture at 2 kn as at 7 kn. The art director's conditions for v1.13 (`docs/reviews/art-direction/v1.13/README.md`): sail belly, helmsman and tiller first, thin lines, deck detail last; spray as opaque low-poly foam bits, never white, none under 3 kn; a camera lean of at most 3°, slow, off with reduced motion; the far model unchanged. `refinedBoat.ts` had grown to 837 lines and had to be split before anything was added.

## Decision

- **Split the refined builder** by part: rig types and deck helpers (`refinedRig.ts`), stern castle, deck fittings and cargo, gaff sails, headsails, square rigs, standing and running rigging. Every ship's triangles and meshes stay exactly as before.
- **A close-up model for the player's boat only** (`BoatModelOptions.closeUp`, `boatCloseUp.ts`): a helmsman (prop recipe `boat-sailor`, the boat's look colours), hands per class from `graphics.json › closeUp.hands`, a tiller that turns with `BoatState.rudder`, two coiled lines. The crew shows only while the follow cam is in, never on Low or Ultra-low; traffic boats and previews keep the far model.
- **Sails that trim**: belly scaled by the point of sail (flatter close-hauled, fuller running), and the boom eased at a set swing rate in `RigPose`, so a gybe swings across and the cloth fills on the new side as the boom crosses.
- **Spray** (`boatSpray.ts`, owned with the crash debris by `boatSplashes.ts`): one instanced mesh, at most 64 bits in fixed arrays; bow spray from 3 kn to full at 7 kn and more into head seas, a lee splash when the heel grows fast (a gust), a burst on a bump. Off on Ultra-low. Numbers in `waves.json › spray`.
- **Camera lean**: the follow cam rolls with a share of the heel, at most 3°, eased slower than the heel (`SeaMotion.cameraLean`, `waves.json › motion`). Settings › Motion reduced or off sets `SeaMotion.steady`, which also stops the camera riding the waves. No new Settings switch.
- Option A (helmsman alone on the sloop) ships: the art director picked it, since in option B (`closeUp.extraHands` 1) the second hand merges into the helmsman from the follow cam and costs triangles on every ship.

## Consequences

- Draw calls: +1 on the player's boat in both views (the tiller left the hull mesh), +1 in the follow cam (the crew), +1 while spray flies. Triangles: 200 to 530 per ship (budget and argument in [docs/art/boat-up-close.md](../art/boat-up-close.md)).
- Sailing, races and balance are unchanged: everything here is drawing only.
- The fleet's crew is data: a new ship needs only a `closeUp.hands` entry (the tuning tests ask for one per class).
- `refinedBoat.ts` is under 400 lines; new rig parts go in their own modules.
