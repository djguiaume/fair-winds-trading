# 0208. Visible hull damage

**Status:** Accepted (2026-10-25, Guillaume after the art director's round). Part 9 of the Phase 5 brief ([docs/phase-5/brief.md](../phase-5/brief.md), decision 0207); look from the art director's section 6 ([docs/reviews/art-direction/phase5/README.md](../reviews/art-direction/phase5/README.md)), agreed with the art director on 2026-10-25.

## Context

Hull damage has been in the game since decisions 0032 and 0038 (reefs, shores, piers, ice and
boats all knock points off), but only the HUD showed it: a crash looked the same as a soft bump,
and a hull at 20 % sailed with the same clean paint and full canvas as a new one. Guillaume's note
of 2026-10-19 asked for debris and a splash on impact and a model that changes every 20 to 25 % of
hull lost, cleared by repair. Combat later (pirates are out of the base game, but the extension
needs this) is unreadable without it, and reef and coast crashes get it for free.

## Decision

- **Four steps** from the hull's condition (`damageStage` in `src/sim/hazards.ts`), at the
  `seamanship.damage` thresholds in `src/data/tuning/seamanship.json` (75, 50 and 25 % shipped,
  editable in `?tune` under "Hull damage you can see"):
  1. **Scuffed** (below 75 %): warm darker patches (the strake's colour mixed 40 % toward warm
     charcoal `#2e2219`, never grey) on the band, the strake under it and the deck inside the rail.
     The art director suggested a quarter; it did not read at the sailing camera, so 40 %. The
     deck patches are there because the game camera looks down on her and sees little topside.
  2. **Patched** (below 50 %): every sail takes the stock patched canvas plus four big patches
     (two panels each way) of warm, plank-toned canvas that shows about 30 % darker
     (`STYLE_D.damagePatches`, written darker than it looks because the sails' material adds a
     flat glow), so the step reads at the sailing camera even on stock sails; a sails-3 racing
     stripe stays, as the ship's identity.
     One stretch of gunwale on the `rail` station is broken off, its ends in bare wood.
  3. **Torn** (below 25 %): holes in the main sail (or each mast's lowest course) at the `tears`
     cells, showing the sea or night sky through them, no transparency: one big four-panel hole
     on the small ships (several small ones were lost at the camera), three on the fluyt and
     indiaman; and a standing list of `listDeg` toward `listSide` (6°, 5° on the fluyt and
     indiaman). A pump spout was tried and dropped: it only read on the model sheet.
  Repair clears it: the step follows the condition, so the model is rebuilt clean.
- **Damage places are data per ship file**: a `model.damage` block in each `src/data/ships/*.json`
  (`scuffs`, `rail`, `tears`, `listDeg`, `listSide`; stations along the hull as fractions of length,
  and a side). A file without one gets `DEFAULT_DAMAGE` (`src/data/ships.ts`). `npm run check`
  checks the blocks (a new `ships` area); docs/content/README.md says how to write one.
- **The model is rebuilt on a new step**, not swapped per frame: the step is part of the boat's
  key in `GameView`, like the upgrade levels, so a crash that crosses a threshold (or a repair)
  rebuilds once. Scuffs, patches, holes and the broken rail are merged into the existing hull and
  sail meshes: no extra draw call at any step.
- **On impact** (a `crash` or `reef-strike` event): a chunky splash of foam-coloured
  (`PALETTE.foam`, never pure white) icosahedra that rise at her bow and fall back, and planks a
  little darker than the palette's `plank` that drift off both sides on the swell and sink over
  `debrisSeconds` (4 s). Counts are `planks` and `splash` (6 each, 12 at most). Shared by every
  impact in `src/render/impactDebris.ts`: one instanced draw per kind, hidden while nothing is
  afloat, opaque, nothing glows at night. And a **thud**: a new synthesised effect (`thud` in
  `src/data/audio.json`, `playThud` in `sfx.ts`), a low knock and a crack of filtered noise pitched
  so phone speakers play it. The sounds thread (brief part 5) may replace it with a recording.
- **The HUD hull bar and figure step with the model**: brass (`--brass`) when scuffed, the red as
  before when patched, a deeper red (`--red-deep` `#d8402e`) when torn. The figure was storm
  amber, which means storm on the chart (art bible §8), so it is brass now.
- **Tools**: `npm run shots -- --hull 40` sets her condition, `--crash 250` throws up a splash that
  long before the shot. The model sheet has `models.html?view=damage&ship=indiaman` (the four
  steps) and `&damage=0..3` on any view; `node tools/ship-models/capture.cjs damage` writes
  `docs/art/game-models/damage/<ship>.png`.

## Consequences

- No new draw calls at any step; two instanced draws for a few seconds after a crash. A rebuild costs one boat build (a shipyard purchase does
  the same) only when a step changes.
- The model is not a per-point gauge: within a step it looks the same, by design.
- A new ship file works without a `damage` block, but should get one so the rail break misses its
  castle and its holes suit its sails.
- The list is a look only; the sim's heel and speed are unchanged (the leak penalty already slows
  a damaged hull).
- Reviewed with the art director in one round (2026-10-25): 40 % scuffs and deck scrapes, 6°/5°
  list, no pump spout, bolder patches and one big hole on small ships.
