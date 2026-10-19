# 0022. Trading UI integration and tablet budget

**Status:** Accepted, 2026-10-19.

## Context

The player synchronized Google AI Studio work into [Fair-wind-trading-2-](https://github.com/djguiaume/Fair-wind-trading-2-) and asked to integrate it into this original repository. The import at commit `9303ca9` contains a trading panel, shipyard, port labels and Captain/Kids modes, but lacks the simulation and rendering source and contains an unresolved CSS conflict. It cannot replace the working project wholesale.

## Decision

Adapt the plain-DOM UI into the existing TypeScript/three.js game. Preserve the working simulation, strategic map, quiet compass help, saves, dependency stack and Pages deployment. Do not bring over the unrelated React, Google GenAI or server scaffolding. Repair the CSS conflict and align label classes with the stylesheet.

- Docking opens Market/Shipyard and pauses simulation and sailing inputs; Return to Sea closes it. The persistent dock button reopens it.
- Both modes use the real economy quotes and transaction APIs, with disabled invalid actions and inline failure feedback. Ship switching works in both directions and respects cargo capacity.
- Captain/Kids mode persists in settings. Port buttons show nearby ports and set explicit destinations, including Stonehaven, without mutating the legacy practice course. Destinations are session-only, like the practice-course index.
- The modal traps keyboard focus, handles Escape, restores focus and retains scroll/focus after transactions. The cargo summary is a real button. Reduced-motion preferences disable pulsing dock feedback.
- Upgrade copy describes current effects; hull durability has no damage gameplay until hazards arrive.

## Tablet budget

Scenery stays in one merged draw call with no new textures (0021). Low quality has no shadow maps, a 48-by-48 ocean grid, 36 wind streaks, a maximum device ratio of 1 and a **750,000-pixel drawing buffer**. The drawing-buffer cap can lower resolution below CSS size on large tablets; DOM text remains sharp. Medium and High use 1.25M and 2.5M pixel caps respectively.

On Low, shoreline-distance loops run per ocean vertex (2,401 vertices), then interpolate, instead of running at every ocean pixel. Foam is static. Medium and High retain detailed per-pixel shoreline shading. This trades shoreline precision for reduced fragment work. Touch devices reporting four or fewer cores or at most 4 GB memory start on Low; automatic frame monitoring can step quality down further from higher levels. Port labels update at 10 Hz and avoid per-frame DOM construction. Removed backdrop blurs from labels and the modal.

## Consequences and validation

Vitest covers real DOM transactions in both modes, exact quoted gold changes, upgrades, ship purchase/switch cargo limits, failures, preference persistence and modal keyboard behavior. Existing simulation, economy, save, map and compass tests remain. The DOM environment (`happy-dom`) is development-only; runtime dependencies remain three.js alone.

These are code and budget checks, not measured tablet FPS. Before calling the old-tablet baseline complete, use the actual target tablet: Low and Auto, portrait and landscape, docking/trading, crossing both passages, offshore sailing, resume from save, and repeated menu/modal transitions. Show FPS in settings and check sustained responsiveness and memory over a longer session. No device-specific performance guarantee is implied.
