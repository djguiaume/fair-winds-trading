# 0262. Boat look channels: sail bands glow less, figureheads on class mounts

**Status:** Proposed (2026-11-01), with the #296 visual round.

## Context

Variant B (decision 0259) paints the upgrade levels on the sails and hull. The prototype's bands went grey, worst at night: the sails' material adds a flat white glow (0.22) to every panel, so a saturated band is washed toward the canvas. The cosmetic slots (docs/v1.4/customisation.md, #297) also need colour channels and a place for figureheads on every class.

## Decision

- Each sail vertex carries a `glow` weight; the sail material scales its white glow by it (one shader edit, same material and draw calls). Canvas, patches and damage keep weight 1, so their 0208 colours are unchanged; bands and stripe use `boat-look.json` › `sails.bandGlow` (0.3), so they keep their class colour day and night.
- Bands by row (`boatLook.ts` › `sailRow`): sails 2 the foot row, sails 3 the head row and the two centre rows too. The foot band is `sails.footBand` (1.8) rows deep so it reads along a boom from the game camera (art director, #296). Sails with fewer than six rows (square courses) skip the stripe, so canvas stays between the bands.
- Colour channels, `BoatModelOptions.look` (`BoatLook`): sail cloth, sail band, sail stripe, hull band, hull strake, figurehead. Unset channels take the class stock: ship file `bandColor` and the new `sailBandColor` (swift blue, hauler dark teal), and `boat-look.json` for the per-level canvas and copper. The 0259 tan / brass rubbing strake is dropped from the stock look: under the class band it read olive and muddy (art director, #296); the hull reads band at 2, copper at 3. A chosen strake (cosmetic) shows at hull 2 and 3.
- A figurehead is a prop recipe (decision 0135) scaled to the ship file's `figureheadMount` (`size`, `drop` below the stem head) and merged into the hull mesh, so it follows heave, pitch, roll, heel and previews for no draw call. No mount, no figurehead or an unknown recipe draws none.

## Consequences

No new geometry for colours; one float attribute per sail vertex. `npm run check` checks the class colours and mounts. The catalogue (#297) maps its resolved look onto these channels; patterns other than bands, logos and wakes are #418. `models.html?look={…}` previews a look on any sheet.
