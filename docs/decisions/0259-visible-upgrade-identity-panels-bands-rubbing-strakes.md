# 0259. Visible upgrade identity: panels, bands, rubbing strakes

**Status:** Accepted (2026-11-01). Guillaume: "Go with B, but it will be changed by the logos and more patterns issue anyway. Free is OK at the moment." Logos and patterns: #418.

## Context

The fleet already shows three levels each of sails, hull and hold (decisions 0077 to 0081), but at sailing camera the sails look alike except the sails-3 stripe, and the hull only gains a band and copper. v1.4 wants every upgrade to read at a glance without changing speed, capacity or prices.

## Decision

Sail variant **B "Bands"**. Sails 1 stays patched canvas; sails 2 gets clean canvas with a class-colour foot band; sails 3 adds a head band and the centre stripe. Hull gets a rubbing strake (leather tan at 2, brass at 3) between the band and the copper. Hold stays as is (more crates and barrels). Variants A (panels and borders) and C (cut and luff tabling) were weaker at camera scale. Cosmetics, slots and compatibility are in `docs/v1.4/plan.md`.

Availability (Guillaume OK, 2026-10-31): sail colours and patterns are free; figureheads and pennants are earned through story or regatta wins; no coin prices; the Tern stays a single gift.

Customisation is a full slot system (sail colour, pattern, logo; hull colour; figurehead; flag; wake trail; sets), one data file per item with an `unlock` of free or earned (a paid kind later, not built), its own screen: [customisation.md](../v1.4/customisation.md). Cosmetics never change sailing.

## Consequences

Only colours change, no new geometry, so budgets are unchanged. Prototype patch: `docs/v1.4/prototype/prototype.patch`. Night washes out pale bands; build thread must check the emissive sail colours (see 0208).
