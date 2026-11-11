# v1.8 brief: A richer look

Guillaume, 2026-11-11: take the picks from the Saltline comparison (mockups and notes: PR #496, `docs/reviews/saltline-lighting/`) into the next release. Look only: no story, no new economy. The look stays our storybook look (art bible, decision 0165): flat-shaded, warm, never grim.

**In:** bloom, sea gusts, ground detail (sand ripples, grass clumps and dry patches), richer houses. **Rejected:** cliff lines on the ground ("looks worse"), so cliffs keep today's strata. **Not in this release (no pick):** sky light probe (fights "never grim"), PCSS contact shadows (barely visible), render-pixel cap (the Xbox memory lever lives in #484).

Every part: switchable in Settings or a quality level it is allowed on, data driven (tuning in data files, CLI plus editor entry per decision 0153), measured with `?bench`, a budget raise only with its reason, an ADR. Mockup code in #496 is the starting point, not game code.

| Order | Issue | Goal | Files | Done when | Effort | Visual | Model |
|---|---|---|---|---|---|---|---|
| 1 | #484 | Ultra holds less graphics memory with the same picture, so bloom fits on the Xbox | Ultra render targets, `budget.json › gpuMemory` | Lower memory at 1920x1080@2 (`npm run perf`), budget lowered, ADR | medium | no | Opus high |
| 2 | new | **Sea gusts**: cat's-paw patches running downwind, darker with broken reflections and flecks, calm slicks between | `oceanShader.ts`, `src/data/tuning`, waves controls | On every quality level that has waves; costs under 0.3 ms on phone `?bench`; off with the Waves comfort switch; ocean tool lists the numbers | medium | yes | Opus high |
| 3 | new | **Ground detail**: sand ripples, grass clumps, dry patches, as colour and bump; zone edges and cliffs untouched | `fieldGroundGlsl.ts` (mockup patches `src/ground.ts`), tuning | Looks right from chase and classic camera; fades out under 2 px; no new textures; phone `?bench` measured | medium | yes | Opus high |
| 4 | new | **Richer houses**, variant per Guillaume's pick (A recommended): footing, overhanging roofs, ridge, three pitches, taller chimney, door step, lean-to. Today's house stays for far and Low | prop recipes (`fish-house`, then the other town styles), a near/far swap, `budget.json` homes group | All town styles done, swap invisible, High/Ultra only, triangles and draw calls measured, ADR | medium | yes | Sonnet (Opus high if the swap needs engine work) |
| 5 | new | **Bloom** on Ultra: threshold per time of day (1.05 day, 0.7 night), warm glow on windows and lanterns | `ultraPipeline.ts` (before the grade), `graphics.json` | Visible at night, nothing at day, within Xbox memory after #484, Settings switch, ADR | medium | yes | Opus high |

Order: #484 first and #5 after it (same files). #2, #3, #4 touch different files and run beside #484. One combined visual round for #2 to #5: screenshots to the art director and Guillaume together (desktop, phone for the houses), `visual` label, no `automerge` before `visual-ok`.

Open for Guillaume: houses A or B (A recommended: B's extra detail only shows up close and doubles the triangles); fold #484 in; Fable or Opus (see the message).
Roles: no storyteller (no story work). Art director asked once for the look of all four visual parts.
