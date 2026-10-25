# 0210. Skerry's build choice: staked plots and the Island tab

**Status:** Proposed (2026-10-25). Mockups agreed by the art director and the head storyteller; waiting on Guillaume's OK of the [mockups](../reviews/skerry-build/README.md) and the real screenshots.

## Context

Guillaume, 2026-10-25 (Phase 5 must-have, [brief](../phase-5/brief.md) part 1): "players don't understand what is the special view on their home island and why it's there. I don't understand either. You get buildings as reward, choose the one you want, build it. Where does this UI/view come into play."

Since [0126](0126-home-island-build-spots.md) an arc's thanks said only "go and pick something for your island" (storyteller brief rule 12: don't name the buildings), and mooring at Skerry put dashed and glowing circles over the 3D island with "Tap to build" and a toast. Nothing said which plot was new, who gave it, or what the two buildings were until a circle was tapped, and the card then covered the sea. Nothing on the island itself showed a plot.

## Decision

1. **The thanks names the plot.** A quest whose reward has `homeSpot` names its two buildings with `{spotA}` and `{spotB}` (EN "a warehouse", FR "l’entrepôt": `building.<id>.a` in i18n), filled by `stepParams` (`plotParams` in `questView.ts`). Storyteller brief rule 12 becomes: "The done card thanks, then names the plot and the two buildings with placeholders, and sends the captain to Skerry to choose." Words by the head storyteller.
2. **The giver waits by the stake.** The first mooring at the island in a session with a given plot not built shows the giver's card (`<text>.plot.copy`, title "Choose your building", tag "Your plot"); its button "To the island" opens the Island tab on that plot. The giver speaks, not Rook: they came over to stake the plot, which says where it comes from.
3. **A harbour screen at the captain's island**, built like a port's (style D, same header, tabs, footer and controller focus): an **Island** tab listing every plot (the ones to build first, then by number; a given plot named for its giver, "Maren's plot"; a plot still to come "Plot 3" with who will stake it and its two buildings; built plots with their effect; spares while a passed-over building waits, for gold) and the **Warehouse** tab ([0136](0136-warehouse-forecast-and-perks-as-data.md)) once there is one. Repairs sit in the footer. Mooring opens it; Set sail closes it; the island's name at the top of the sea HUD opens it again.
4. **Choosing a plot** halves the screen (right half in landscape, bottom 60 % in portrait), hides the sea HUD, turns the camera to the plot and closer (`view.setFocus` with a screen shift), and draws a brass ring on the ground around it. The two buildings and their Build buttons sit beside it. "All plots" or B goes back.
5. **Plots are staked on the island**, visible from the sea, no special mode: the floating circles are gone. A plot the captain can build on has four stakes with flag ribbons, a cream string, a tall pennant pole and a sign with its number painted on; a plot still to be given has short bare stakes. The run-down prop on a plot stays inside the stakes until it is built. They are prop recipes (`plot-stakes`, `plot-stakes-bare`, `plot-ring`, about 150, 40 and 120 triangles), named in `buildings.json` › `plots`; the camera's zoom and shift on a chosen plot are `buildings.json` › `plotCamera`. `islandLook` / `homeLooks` in `home.ts` give each spot a building or a plot state; `homeView` adds the stakes at the spot (variant = its number).

## Consequences

- Tools: the quest builder lists the plot line for a quest that gives a plot and fills `{spotA}`/`{spotB}` in its preview; its checks (and `npm run quest -- check`, `npm run check`) say when such a quest's thanks lacks them or its plot line is missing. The island builder's "As chosen" shows plots with no building staked. `npm run shots` takes `--offer spot-2`, `--built spot-1=workshop`, `--island-tab` and `--choose spot-2`; `--moor` now shows the island with its screen closed.
- No save change: the plot states are worked out from `offered` and `built`.
- The giver's card shows once per session per plot (the cards' `questSeen`), so a captain who sails off without choosing is reminded on a later voyage.
- The art director's numbers: town budget 200 triangles per prop; stakes `post` wood, ribbons and pennant `flag`, string `cream`, sign `plank`; ring the HUD's brass, opaque, flat on the ground, no glow.
