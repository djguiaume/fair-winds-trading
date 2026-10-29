# 0237. Drawn coast must agree with the sailed coast

**Status:** Proposed (2026-10-28).

## Context

Smooth ground (0235) and hand sculpting (0232) let the drawn ground part from the coast the sim
sails by (collision, berths, routes). A sculpted hill in the sea, or a cut through the shore, would
look like land or water that the boats treat the other way. Issue #273.

## Decision

- **One authority per side, and they must agree.** The coast outline in the island file (and a
  barrier island's or sandbank's outline) is the sim's coast. The height field's zero contour is the
  drawn coast. We do not derive the sim coast from sculpted terrain: an edit that moves the drawn
  coast away from the outline is an **error** (`coast` island check), so the two never part silently.
  To move a coast, edit the outline.
- **Measure:** every sample of the canonical field (`terrain.json › cell`) is land or sea on each
  side (a lake's water is sea on both). Where they disagree, the distance to the outline is the gap
  (`src/sim/coastAgreement.ts`); the worst gap per island is reported, gaps beyond
  `terrain.json › coast › tolerance` are errors.
- **Tolerance 1.5 units.** The shipped ground differs from its outline by less than the grid can
  show (under 0.45 units, 0235); the dock keeps 2 units of clear water round a sloop (`berths`) and a
  hull is 5.5 units or more, so a drawn shore 1.5 units off never puts a boat on land or a dock in
  the sea. A test keeps the tolerance under the dock margin.
- **Quality never moves the coast.** The lower qualities draw `fieldLod` copies of the canonical
  field; `coastReport` checks Low, Medium and High against the same outline.
- **Buildings** stand on terrace ground above `coast › buildingMinHeight` at every level they exist
  (`support`); **harbours**: no ground is drawn above the sea in the water a sloop docks in, at a
  port's first and top level (`harbour-water`, `npm run check` and the sea editor).
- **Overlay:** `npm run chart -- --coast [--quality low|medium|high]` draws the sailed and the drawn
  coast of every island and red discs (with the gap) where they part; the island builder shows the
  `coast` and `support` issues on the island.

## Consequences

- Sculpting cannot silently grow or shrink an island. Reefs, shallows and ice have no height field
  and stay out of the comparison (their water colour is the depth bake, 0233).
- The field covers the coast plus `terrain.json › margin` (8 units); an edit past that changes nothing
  drawn, so it cannot part the coasts either.
- Cost: the island checks build the field at each level a building stands (about 7 s more for all 44 files in `npm run check`; the island builder runs its checks in a worker); the sea editor runs the map checks once per edit on cached fields.
