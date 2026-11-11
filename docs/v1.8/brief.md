# v1.8 brief: A richer look

Guillaume, 2026-11-11: take the picks from the Saltline comparison (mockups and notes: PR #496, `docs/reviews/saltline-lighting/`) into the next release. Look only: no story, no new economy. The look stays our storybook look (art bible, decision 0165): flat-shaded, warm, never grim.

**In:** bloom, sea gusts, ground detail (sand ripples, grass clumps and dry patches), richer houses. **Rejected:** cliff lines on the ground ("looks worse"), so cliffs keep today's strata. **Not in this release (no pick):** sky light probe (fights "never grim"), PCSS contact shadows (barely visible), render-pixel cap (the Xbox memory lever lives in #484).

Every part: switchable in Settings or a quality level it is allowed on, data driven (tuning in data files, CLI plus editor entry per decision 0153), measured with `?bench`, a budget raise only with its reason, an ADR. Mockup code in #496 is the starting point, not game code.

| Order | Issue | Goal | Files | Done when | Effort | Visual | Model |
|---|---|---|---|---|---|---|---|
| 1 | #484 | Ultra holds less graphics memory with the same picture, so bloom fits on the Xbox | Ultra render targets, `budget.json › gpuMemory` | Lower memory at 1920x1080@2 (`npm run perf`), budget lowered, ADR | medium | no | Opus high |
| 2 | #498 | **Sea gusts**: cat's-paw patches running downwind, darker with broken reflections and flecks, calm slicks between | `oceanShader.ts`, `src/data/tuning`, waves controls | On every quality level that has waves; costs under 0.3 ms on phone `?bench`; off with the Waves comfort switch; ocean tool lists the numbers | medium | yes | Opus high |
| 3 | #499 | **Ground detail**: sand ripples, grass clumps, dry patches, as colour and bump; zone edges and cliffs untouched | `fieldGroundGlsl.ts` (mockup patches `src/ground.ts`), tuning | Looks right from chase and classic camera; fades out under 2 px; no new textures; phone `?bench` measured | medium | yes | Opus high |
| 4 | #500 | **Richer houses**, variant per Guillaume's pick (A recommended): footing, overhanging roofs, ridge, three pitches, taller chimney, door step, lean-to. Today's house stays for far and Low | prop recipes (`fish-house`, then the other town styles), a near/far swap, `budget.json` homes group | All town styles done, swap invisible, High/Ultra only, triangles and draw calls measured, ADR | medium | yes | Sonnet (Opus high if the swap needs engine work) |
| 5 | #501 | **Bloom** on Ultra: threshold per time of day (1.05 day, 0.7 night), warm glow on windows and lanterns | `ultraPipeline.ts` (before the grade), `graphics.json` | Visible at night, nothing at day, within Xbox memory after #484, Settings switch, ADR | medium | yes | Opus high |

| 6 | #503 | **Believable towns**: audit every island's terrain and asset placement, fix with the island CLI so towns read as real (houses on flat ground facing the water, streets and quays following the shore) | island files, town layouts, `npm run island`, `chart`, art bible town rules | Rules list, every island audited and fixed, before/after charts, Guillaume's `visual-ok` | high | yes | Opus high |

Guillaume, 2026-11-11: #503 is in v1.8. That makes six parts, so run two waves. Wave 1: #484, #498, #499, #500. Wave 2: #501 (after #484) and #503 (after #500, so layouts fit the new house sizes; it touches island files, so nothing else edits them then).
Order: #484 first and #501 after it (same files). #498, #499, #500 touch different files and run beside #484. One combined visual round for #498 to #501: screenshots to the art director and Guillaume together (desktop, phone for the houses), `visual` label, no `automerge` before `visual-ok`.

Open for Guillaume: houses A or B (A recommended: B's extra detail only shows up close and doubles the triangles); fold #484 in; Fable or Opus (see the message).
Roles: no storyteller (no story work). Art director asked once for the look of all four visual parts.

## Art director rules (v1.8 art director, 2026-11-11)

- **Gusts (#498):** soft patch, at most ~8% lightness off the water ramp, never white or foam, half strength at night, floor `#1d3d7a`, off on Low and Medium.
- **Ground (#499):** normal-only bumps, tints at most ~6% off the zone colour, dry patches warm grass `#a8b45c` on at most 15-20% of a grass zone, none on rock, slate, lava, snow or town lanes, no `fract()` lines.
- **Bloom (#501):** Ultra only, needs a rule 1 exception line in the art bible. Strength ~0.25-0.35, small radius, high threshold by day, lower at night so only lit windows, lanterns and moon glow; sailcloth and foam never bloom. No sky probe unless night stays above `#1d3d7a`.
- **Houses (#500):** variant A (picked by the art director; Guillaume still to confirm), "outline" means silhouette parts, not ink lines. Roofs stay in the style palette; shutters use the style's trim colour; footing a darker warm-grey band; chimney caps warm charcoal; no chimneys on tropic; only Bram's glassworks glows. Homes at most ~130 triangles, lit windows kept.
- **One review round:** JPG up to 1280 px, same camera before and after: ring town zoom 1.4 day and night plus overview; Sunreach town day and night; Rimewick, Fogwatch, Emberhold town day; open-water chase with gusts off, default, strong, plus dusk (phone 844x390); sand and grass close-ups; bloom on/off at night and golden hour; one Low versus Ultra pair. To the art director and Guillaume together.
