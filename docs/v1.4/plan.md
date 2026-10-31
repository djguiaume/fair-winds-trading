# v1.4 "Visible upgrades": design (#295)

Brief: [brief.md](brief.md). Decision: [0259](../decisions/0259-visible-upgrade-identity-panels-bands-rubbing-strakes.md). Prototype sheets: [prototype/](prototype/). Status: **prototype awaiting art director and Guillaume; nothing fleet-wide starts before.**

## Inventory (extend, do not discard)

Classes: sloop, cutter, schooner, clipper (swift line); hoy, fluyt, indiaman (hauler line). Each has `refined` model code in `src/render/models/*Details.ts` plus shared `refinedBoat.ts`/`hullGeometry.ts`. `ShipUpgrades` has `sails`, `hold`, `hull`, each 1 to 3: sails 1 patched, 2 new canvas and extra jib, 3 stripe and topsail; hull 2 painted band, 3 copper; hold more crates and barrels. Damage (0208) and flags (0217) sit on top and stay.

## Prototype

Cutter (small, swift) and indiaman (large, hauler), base / middle / max / mixed, in the engine, colours only. Three sail looks: A panels and borders, B bands, C cut and luff tabling. Hull rubbing strake is common to all. **Recommended: B**, the only one that reads at max on both boats. Weak spots: at night the pale bands fade (sail emissive); the phone strip was cropped from the sheet viewer, not the real phone camera, so phone legibility needs a game-camera check in the build.

## Sail, hull, hold identity (spec)

- Sails: 1 mismatched patches, no band. 2 uniform canvas, class-colour foot band. 3 foot and head bands plus centre stripe (topsail kept). Mechanical effects unchanged.
- Hull: 1 bare, 2 class band plus tan rubbing strake, 3 band, brass rubbing strake, copper bottom.
- Hold: unchanged crate and barrel counts; fittings (tarp, lashing) are a later option.
- Class silhouettes and rigs untouched; damage patches stay warmer and darker than upgrade colours.

## Cosmetic slots (proposal, data-driven in a catalogue file, validated by `npm run check`)

| Slot | Colour channels | Limits |
| --- | --- | --- |
| sail pattern | 1 (band colour) | one of plain, band, stripe; never covers the sail number |
| hull band | 1 | uses palette swatches only |
| figurehead | 0 | one per hull, mount point per class, "none" always available |
| masthead flag | 0 | regatta pennants earned, never selectable otherwise |

Rules: reserved hazard colours (storm, night warning) and earned pennants are not in the swatch list. Every cosmetic works on every class and upgrade level; figurehead mounts are per-class data. Unequipped is the default and costs nothing.

## Catalogue, budgets, Free Sailing (proposal)

- About 8 swatches, 3 sail patterns, 6 figureheads (names by the storyteller), 4 Free Sailing presets (swift, hauler, all-max, all-base).
- Budget: colours only, zero extra triangles for sails and hull; a figurehead is at most about 60 triangles, one draw call merged into the hull mesh.
- **Open for Guillaume:** are cosmetics free, earned, or priced? No progression prices are assumed here.
