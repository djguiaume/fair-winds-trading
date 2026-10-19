# 0023. Visible pier markers and explicit docking

**Status:** Accepted, 2026-10-19.

## Context

The player stopped at a visible pier but could not access trading. The screenshot has neither the captain stats nor harbour labels from 0022. Verification of the live HTML confirmed it still served the preceding release while the merged trading release's GitHub Actions job was queued. Missing trading UI on that release explains why no market could be opened; we did not reproduce a simulation docking failure in the current code.

There was also a real discoverability problem: labels projected from island centres disappear when the pier is visible but the island centre is outside the camera view. The player requested an icon/name on the dock or island.

## Decision

Export each pier head's exact world coordinates during the existing seeded island build, using the same transformation as the geometry. Cache those four anchors on the merged mesh. Project a compact anchor icon, port name and approach cue from the pier head, with a pointer toward the dock. Keep island geometry, seeds, docking ranges and save data unchanged. No additional geometry, textures, draw calls or repeated model generation are needed.

Nearby ports show their marker within 100 units of the shoreline; off-screen pier heads remain hidden. The selected objective still shows when on screen. Labels show “Trading harbour”, “Slow down to dock”, “Tap to dock & trade” or “Docked · Tap to trade” as appropriate. Keep the floating label compact; the market panel continues to show production and demand details.

Allow the harbour button to dock explicitly when within the existing range and below the existing speed limit. Explicit and automatic docking share `tryDock` validation. A click from farther away still sets a navigation destination; a click while docked reopens trading. Place the mobile trade button above the sail controls.

Add the Git revision to the main menu so future stale-deployment reports can identify the running build. The original GitHub Actions → GitHub Pages pipeline remains the publishing path; a merged change is not assumed to be live until deployment succeeds.

## Validation

Regressions check exact correspondence between anchor coordinates and the rendered pier board, both ships stopping beyond all four real pier heads and opening the real trade panel, explicit docking speed/range constraints, and a visible pier marker when its island centre is off screen. Full simulation/DOM suite: 95 tests. These checks do not imply the queued hosted deployment has completed or that a specific physical tablet was tested.
