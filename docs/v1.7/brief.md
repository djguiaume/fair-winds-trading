# v1.7 brief: Tidy, smooth, shiny

Guillaume, 2026-11-05: scope C + A.d + B.b + B.a. This release auto-merges and the lead validates, even visual parts. Only #477 needs Guillaume's approval (`visual-ok`). Avoid v1.6 files until v1.6 ships.

| Order | Issue | Goal | Files | Done when | Effort | Visual | Model |
|---|---|---|---|---|---|---|---|
| 1 | #422 | Split the five quest code files past 400 lines | `src/sim/quests.ts`, `questLibrary.ts`, `src/editor/quest/doc.ts`, `form.ts`, `src/ui/questView.ts` | None over ~400 lines; check, test, PR rules pass; no behaviour change; line in `docs/content/README.md` | high | no | Opus high |
| 2 | #392 | One HTML file per screen, stylesheets split by component | `index.html`, Vite include plugin, six big `src/ui/*.css` | Same `dist/index.html` DOM and CI sheet; no file over ~400 lines; ADR | medium | no change | Sonnet |
| 3 | #405 | Phone fluidity notes (reference game) into budgeted targets | `docs/` perf notes | Short note of what to borrow, or dropped with a reason | low | no | Sonnet |
| 4 | #285 | Ultra-only boat/island reflection prototype with ship/defer gate | Ultra render pass, ocean material, tuning | Prototype measured at 1080p; ADR with ship or defer | medium/high | yes | Opus high |
| 5 | #477 | Walkers and dock workers on quays | town layouts, one instanced mesh, data file, CLI, editor | See issue; **needs Guillaume's `visual-ok`** | high | yes | Opus high |

Run #422 and #392 first and alone (they touch files others edit); #405 can run beside them (docs only). Then #285 and #477 together (different areas).
Role threads: no story work; art director asked once for #285 and #477 looks.
