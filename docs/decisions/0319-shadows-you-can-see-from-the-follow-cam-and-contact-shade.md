# 0319. Shadows you can see from the follow cam and contact shade

**Status:** Accepted (2026-11-16). Issue #550, part 1 of 2 (part 2: sun glitter and haze).

## Context

High and Ultra drew a shadow map, but from the follow cam nothing seemed to cast a shadow: the box
sat round the boat, behind most of what the follow cam sees; the sun stood high, so shadows were
short; the sky light was so strong that shade was barely darker than sun; and the sea, most of the
picture, took no shadow at all. Everything looked placed on the scene, not standing in it.

## Decision

- **The box follows the view.** It centres from the camera's target toward the middle of the sea on
  screen (`graphics.json` › `shadows.lead`, at most `maxLead` box half-sides away), snapped to whole
  shadow texels so its edges do not crawl. From above the two points are close.
- **High gets Ultra's shaped sun** (`shadows.high`: lower and turned 30°, a 2048 px lean map, a
  wider box). These numbers left `view.ts` for data; the shared code is `src/render/sunShadows.ts`.
- **Deeper, bluer shade** (art bible rule 3): `shadows.contrast` (0.3) of the sky light moves into
  the sun, at the same brightness on sunny level ground, so only what the sun does not reach gets
  darker, lit by the blue sky alone. The top view keeps its vibrancy (top-view sea ΔE ≤ 3.4 against
  before; land ≤ 7.4 where the new shadows fall).
- **The sea takes shadows** on High and Ultra (`src/render/seaShadow.ts`): the boat, quays and
  cliffs darken the water (`shadows.sea` 0.35) and hide the sun's glint; the sky's reflection stays.
  The boat's soft blob now lies away from the light (`shadows.blobLift`).
- **Contact shade**: props bake a per-vertex `contact` (1 at the foot, 0 from
  `shadows.contact.height` up) when built; the land material darkens by it times one shared strength
  (`shadows.contact.shade` 0.45), 0 below High. No pass, no texture.
- Switches: Settings › Shadows now shows on High too; Settings › Contact shade is new;
  `?off=shadows`, `?off=contact` (`graphics-switches.json`).

## Consequences

- Cost (headless, 1280×800): High +4 MB graphics memory (the 2048 lean map against three's 1024
  RGBA map), +1 to 2 draw calls, same triangles; Ultra 334 MB, unchanged, under its 355 MB budget.
  `budget.json` unchanged. The sea's lookup is five depth compares per water pixel on High and Ultra.
- One extra float per land vertex for the contact shade.
- Real-device speed still to read in the device round (#377): `?bench&quality=high` against
  `&off=shadows` and `&off=contact`.
- Sheets: `docs/reviews/v1.12/light-depth/`.
