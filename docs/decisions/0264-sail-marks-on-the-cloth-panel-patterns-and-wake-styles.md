# 0264. Sail marks on the cloth, panel patterns and wake styles

**Status:** Proposed (2026-11-01), with the #418 visual round.

## Context

v1.4 (#418, docs/v1.4/customisation.md) adds logos, more sail patterns, the racing number truly on the sail and wake styles. The old racing number (decision 0217) was boxes set at one point of the belly, so its ends floated off or sank into the curved sail. The art director's rules (issue #418): one logo, mainsail, upper third, centred, about 35% of the sail's width; damage draws above it; patterns and wakes cost no draw call; wakes keep their length and width, no glow above the foam, patterns and sparkle on High only. Guillaume: wakes may be any colour.

## Decision

- **Marks** (`src/render/models/sailMarks.ts`): a logo or the racing number is flat triangles laid out upright on the flat sail, each corner mapped back to the cloth's own (u, v) and lifted by the same belly, merged into the sail mesh (no draw call). Two copies, one readable from each side; the sail material shows a copy only from its side (following the model matrix's handedness, since a sail filling to the other side is a negative scale) and draws marks `boat-look.json › marks.lift` toward the camera, so the cloth between their corners never covers them. A corner over a torn or patched panel drops its triangle (damage draws above). The mainsail carries it; square riggers the main course. The racing number hides the logo; the player carries `marks.player` while a race runs.
- **Logos** are read from the item's SVG without a DOM (`emblem.ts`: polygon, rect, circle and ellipse as octagons, paths with curves and arcs in a few pieces, transforms, holes by containment), at most `rules.json › maxTriangles` per copy.
- **Patterns** (`sailPatterns.ts`, pure, shared with the flat swatches): shapes on the cloth's panel grid; each panel's two triangles split along the diagonal that follows the shape, so chevrons and diamonds get clean slanted edges for no extra triangle. Six besides plain: bands, stripe, panels, halves, chevron, diamond. The foot and head upgrade bands keep their rows and draw over the pattern in the colour `patterns.bandColours` names; a pattern other than bands takes the sails-3 stripe rows (the head band and topsail still mark sails 3), so it reads at every level.
- **Wake styles** (`wakeStyle.ts`): uniforms on the player's one wake mesh: dashes, a thin double line on each edge, soft twinkles toward the tail that only fill the foam's own alpha, and the item's tint (any colour). Below High, tint only. Settings › Wake styles off draws the plain wake.
- The player's boat (`playerBoat.ts`) reads the ship's stored look (decision 0263) and rebuilds only when something it shows changes. `?wear={…}` item ids override it for screenshots and the model sheet (`models.html?wear=…&number=FW 1`).

## Consequences

Adding a logo stays one JSON and one SVG; a pattern kind is a case in `sailPatterns.ts` plus its numbers in `boat-look.json`. A logo costs at most twice its triangles (one copy a side), patterns and wakes nothing. Old saves and the rival's number need no change.
