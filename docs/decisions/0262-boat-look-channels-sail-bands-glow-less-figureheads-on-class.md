# 0262. Boat look channels: sail bands glow less, figureheads on class mounts

**Status:** Proposed (2026-11-01), with the #296 visual round.

## Context

Variant B (decision 0259) paints the upgrade levels on the sails and hull. The prototype's bands went grey, worst at night: the sails' material adds a flat white glow (0.22) to every panel, so a saturated band is washed toward the canvas. The cosmetic slots (docs/v1.4/customisation.md, #297) also need colour channels and a place for figureheads on every class.

## Decision

- Each sail vertex carries a `glow` weight; the sail material scales its white glow by it (one shader edit, same material and draw calls). Canvas, patches and damage keep weight 1, so their 0208 colours are unchanged; bands and stripe use `boat-look.json` › `sails.bandGlow` (0.3), so they keep their class colour day and night.
- Bands by row (`boatLook.ts` › `sailRow`): sails 2 the foot row, sails 3 the head row and the two centre rows too. Sails with fewer than six rows (square courses) skip the stripe, so canvas stays between the bands.
- Colour channels, `BoatModelOptions.look` (`BoatLook`): sail cloth, sail band, sail stripe, hull band, hull strake, figurehead. Unset channels take the class stock: ship file `bandColor` and the new `sailBandColor` (swift blue, hauler teal), and `boat-look.json` for the per-level canvas, the tan / brass strake and copper. A chosen strake shows at hull 2 and 3; copper stays the hull-3 sign.
- A figurehead is a prop recipe (decision 0135) scaled to the ship file's `figureheadMount` (`size`, `drop` below the stem head) and merged into the hull mesh, so it follows heave, pitch, roll, heel and previews for no draw call. No mount, no figurehead or an unknown recipe draws none.

## Consequences

No new geometry for colours; one float attribute per sail vertex. `npm run check` checks the class colours and mounts. The catalogue (#297) maps its resolved look onto these channels; patterns other than bands, logos and wakes are #418. `models.html?look={…}` previews a look on any sheet.
