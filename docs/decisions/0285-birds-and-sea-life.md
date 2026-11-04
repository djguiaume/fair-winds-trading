# 0285. Birds and sea life

**Status:** Proposed (2026-11-04), part of v1.6 (#476). Waits on Guillaume's `visual-ok`.

## Context

Only the player's boat and the other ships moved on the sea; gulls were a sound only (`seaBed.ts`). Guillaume asked for birds and sea life in v1.6 (2026-11-04): gulls, terns, dolphins, a whale and fish shoals, cheap on a phone, data driven, switchable like the other annoyances. People on the quays are a separate issue, not v1.6.

## Decision

- **Drawn only.** Sea life lives in the view (`src/render/seaLife.ts`), never in the sim, the save or the balance. The rules shared by the view, the checks and the tests are plain TypeScript in `src/sim/seaLife.ts` (counts by quality and night, where a creature lives, a dolphin's leap, a whale's surfacing).
- **Birds** (`seaBirds.ts`): one instanced mesh per bird model (gull, tern), wings beating in the vertex shader (vertices lift by how far they lie from the body, so any bird recipe flaps), no per-frame allocation. A flock circles its home: `harbour` (the nearest pier head), `reef` (terns) or `wake` (a few gulls astern of her while she sails within reach of a coast). A flock comes down from the sky when its home is near and climbs away when it is not, so nothing pops; fewer by night (`night` share).
- **Dolphins** (`seaSwimmers.ts`): now and then a pod comes in their waters, rides abeam (or circles her when she is slow) and leaps in turn; under water they are not drawn. **The whale**: now and then she surfaces 30 to 55 units off the bow in deep water, blows, rolls along the top and dives with her flukes up (a body mesh and a blow mesh, drawn only while she is up).
- **Fish shoals** (`fishShoals.ts`): one see-through instanced mesh of dark fish just over the sea under each shoal's middle, so wave crests cover them as if they swam below; each fish turns whole round its shoal's middle in the shader. A shoal left behind is placed again round the boat where fish live. This is the one new transparent mesh (art bible rule 8): a dark shadow in the water needs it, and it is one draw call.
- **"Depth" is distance from shore** (`shore: [min, max]` units from the nearest island's beach): cheap, the same on every look, and close enough to the baked seabed depth for where fish, dolphins and whales are seen.
- **Data** (decision 0093): `src/data/sea-life.json` holds every count, size, speed, timing, sea list and place, and the share drawn at each quality level (High and Ultra all, Medium 75%, Low half, Ultra-low none). Models are `life-*` prop recipes in `src/data/props/` (group `life`, budget 120 triangles), colours palette names (art bible rule 2). The editors' **Sea life** page and `npm run life` share `src/editor/seaLife/doc.ts` (decision 0153); `npm run check` runs its checks.
- **Settings › Sea life** with the hazards and annoyances; off, nothing is drawn. `?off=life` turns it off for a device run (`?bench` against `?bench&off=life`).
- **The calls follow the birds**: a sea call can be `near: { birds: [kinds], range }`. The ring's and the west's gulls cry near the drawn gulls, the south's terns near the terns. With sea life hidden (switched off, Ultra-low) the view answers 0, so the sea sounds as before.

## Consequences

Measured headless at High on the new look (`npm run perf`, sailing and docking): +2 to 3 draw calls and about +1,400 triangles, inside `tools/performance/budget.json` (sailing 28 of 35 calls, docking 34 of 42), so the budget is not raised. Worst case, everything at once: 6 draw calls (two bird models, dolphins, whale and blow, shoals). Phone, tablet and Xbox `?bench` with and without `&off=life` are for Guillaume's device round. `npm run shots -- --life dolphins|whale` calls them for a screenshot; `--query off=life` turns them off. Tests: `tests/sea-life.test.ts`.
