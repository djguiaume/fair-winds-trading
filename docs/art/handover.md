# Art director handover (v1.9 to v1.10, 2026-11-12)

v1.9.411 shipped. Your OK means "ready to show Guillaume", never "merged". Your own PRs are docs only. Replace this file at the end of your release. Rulings from v1.6 and v1.8 (sky, buoy, sea life, bloom, gusts, ground cover, houses) are unchanged: see art bible §2 and decisions 0295 to 0300.

## 1. Open decisions

- **Towns must be organic villages ([#528](https://github.com/djguiaume/fair-winds-trading/issues/528)).** Guillaume ruled on 2026-11-12 that the v1.9 towns read as grids. Redo every town as an old-European village: curving lanes, a square, mixed angles and sizes. The row rule in `src/data/town-rules.json` must be replaced, not tuned. See 1a for why the grids happened and what to ask for. Art bible §12 needs a rewrite to match. My loosened sheets (±6° turn, ±0.15W offset) were too subtle at zoom 1.4: aim for a visible village, judged from the sailing camera.
- **No moon disc on Ultra ([#526](https://github.com/djguiaume/fair-winds-trading/issues/526)).** Present since v1.8. Ultra's halo is the only moon cue.
- **Dark windows at night ([#525](https://github.com/djguiaume/fair-winds-trading/issues/525)).** Cabin recipe window seed (Calda), tan huts at Sunreach, near-black houses at Fogwatch. Rule 10 wants every recipe lit.

## 1a. Lessons: why v1.9 made grids, what a village needs

- **My rules asked for grids.** I gave numbers for a same-row angle (15°), even gaps (0.4W to 1.5W), lanes at a fixed distance from the water and "every house within 2W of a lane". A check built from those numbers rewards parallel rows and equal spacing, and the builder satisfied it exactly. Every town went to 0 fails and 0 warnings and looked worse than before (Westholm's before was livelier).
- **A pass/fail check is the wrong tool for look.** Keep checks for what can break (house on a steep slope, in the water, on lava, a buried lane). Do not turn "believable" into spacing numbers.
- **My review was too soft.** I called the loosened sheets "OK to show" while Calda was still four near-parallel rows, and the ±6° turn and ±0.15W offset were invisible at zoom 1.4. Judge each town at the sailing camera for one question: would this pass as a drawing of a real village? If it reads as rows, say must fix.
- **What an organic old-European village needs (ask for these, not for numbers):**
  - A centre, such as a square, green or quay head, with the church, market or inn on it. Lanes lead to it from several sides and meet at odd angles.
  - Curving lanes that follow the contour and the shore, with forks, a dead end at a well or barn, and widths that change. No two lanes parallel and no straight run longer than about 6 houses.
  - Houses facing the lane or square at their own angles (a spread of 30° or more is normal), packed tight in the core and thinning out toward the edge. Clusters of 2 to 4 houses with shared yards, not evenly spaced rows.
  - Mixed sizes: a few large buildings, many small ones, some sheds and outbuildings. Mixed roof tones per street.
  - Edges that blur: gardens, fences, haystacks, boats on the beach, then fields and woods.
- **How to check it:** compare against Sunreach's old benchmark shot and real aerial photos of small harbour villages. Before and after sheets at one image per row, full size, the town at the sailing camera and at zoom 1.4.
- **Rules to drop or change in `town-rules.json`:** same-row angle and even gaps (replace with a minimum gap so houses don't merge, and no maximum), "within 2W of a lane" as a hard fail. Keep slope, shore setback, no building on lava or ash, and the harbour-centre idea (a village gathers round its square or quay).

## 2. Rulings from v1.9 (keep)

- **Town rules (ADR 0301, art bible §12, `town-rules.json`):** slope under a house 12° (8° for cores of 12+ houses), shore setback 0.8W, lanes 1W to 3W from the water, harbour is the centre (60% of houses within 8W, mass within 6W of the berth), fields on under 8° and 2W to 8W from houses, woods 2W from houses. W is the median house width per town. Tea gardens, kale-yards, snow-gardens and cloudberry patches count as gardens, not fields.
- **Tones (#517):** lean-to roof 8 to 10 lightness points off the main roof (darker unless the roof is under L 30%); chimney cap stone tone or about `#6a625a` when within 12 points of the roof; moon halo about 1.6x the disc, peak at most 60% of a window glow.
- **Signatures kept:** Saltmere smokehouse row and net green, Calda slipway, Westholm mill, Stonehaven crane and quarry, Skerry plots, Sunreach terrace and tea hillside, Bram's glassworks, Elias's workshop, the foghorn.

## 3. Pointers

- **Sheets:** `docs/reviews/v1.9/towns/` (audit, ring.md, far-seas.md, shots) and project files `v1.9-review/` (6 sheets). Tall sheets shrink to unreadable in review; ask for one sheet per sea.
- **Tools:** `npm run island -- audit`, `npm run towns`, `npm run shots` (`--look town --zoom 1.4`), `npm run chart`.
- **Review habits:** judge in game, desktop, phone landscape (844x390), night, Low against High and Ultra. Answer in a short list (must fix, good, nice to have). Look at every image yourself.
- **Thread ids:** find a build thread with `list_threads` and copy the id exactly; never send a placeholder message (I sent one to the wrong thread in v1.9).

## 4. Follow-ups

- Lean-to and chimney tone: ask for a close-up pair on one house; the before/after at zoom 1.4 is hard to tell apart.
- Calda: rows still the most ruled; will be redone by #528.
- Device runs still open: [#374](https://github.com/djguiaume/fair-winds-trading/issues/374), [#377](https://github.com/djguiaume/fair-winds-trading/issues/377), [#380](https://github.com/djguiaume/fair-winds-trading/issues/380).
- From earlier: UI nits from v1.5, Fogwatch lantern room, Palm Key level 3 step, Abbey Head club windows and awning, figurehead sun size, Rimewick Low summit spot. Pirates, warships and "cozy fight" rules stay parked.
