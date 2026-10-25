# Skerry's build choice: mockups (Phase 5, part 1)

Guillaume, 2026-10-25: players don't understand Skerry's special build view (floating numbered
circles over the island, "Tap to build", a card over a frozen sea). The [Phase 5
brief](../../phase-5/brief.md) part 1 replaces it. Words from the head storyteller
(project files `plan/story/phase5-words.md`, section A), look agreed with the art director (one round).

All frames are drawn in the real game with `npm run shots` (decision 0163): the mockup's parts are
[`mockup/mockup.css`](mockup/mockup.css) and the scripts beside it, the staked plots are the real
`plot-stakes` recipes on a copy of Skerry's island file.

```
npm run shots -- --list docs/reviews/skerry-build/mockup/shots.json \
  --style docs/reviews/skerry-build/mockup/mockup.css --sizes desktop,landscape,portrait \
  --out docs/reviews/skerry-build/mockup/shots
```

![overview](mockup/overview.jpg)

| # | What | Shots |
|---|---|---|
| 0 | Today, for comparison | [desktop](mockup/shots/0-today-desktop.jpg), [portrait](mockup/shots/0-today-portrait.jpg) |
| 1 | The arc's done card names the plot and both buildings (Maren: "a warehouse or a bakehouse") | [desktop](mockup/shots/1-done-card-desktop.jpg), [landscape](mockup/shots/1-done-card-landscape.jpg), [portrait](mockup/shots/1-done-card-portrait.jpg) |
| 2 | First docking at Skerry with the plot not chosen: the giver's arrival card, "To the island" | [desktop](mockup/shots/2-arrival-card-desktop.jpg), [landscape](mockup/shots/2-arrival-card-landscape.jpg), [portrait](mockup/shots/2-arrival-card-portrait.jpg) |
| 3 | Skerry's harbour screen, Island tab: every plot, the free one first, who gives the others | [desktop](mockup/shots/3-island-tab-desktop.jpg), [landscape](mockup/shots/3-island-tab-landscape.jpg), [portrait](mockup/shots/3-island-tab-portrait.jpg) |
| 4 | Choosing: the screen halves, the camera turns to the plot, a brass ring on the ground | [desktop](mockup/shots/4-plot-chosen-desktop.jpg), [landscape](mockup/shots/4-plot-chosen-landscape.jpg), [portrait](mockup/shots/4-plot-chosen-portrait.jpg) |
| 5, 6 | From the sea, day and night: staked plots replace the circles; the free plot has a pennant and a numbered sign | [day](mockup/shots/5-staked-from-sea-desktop.jpg), [night](mockup/shots/6-staked-night-desktop.jpg) |

## Built (decision [0210](../../decisions/0210-skerrys-build-choice-staked-plots-and-the-island-tab.md))

The same frames from the game as built, with no mockup parts:

```
npm run shots -- --list docs/reviews/skerry-build/shots.json --sizes desktop,landscape,portrait \
  --out docs/reviews/skerry-build/built
```

| # | What | Shots |
|---|---|---|
| 1 | Maren's thanks (the real `done.copy` with `{spotA}`, `{spotB}`) | [desktop](built/1-done-card-desktop.jpg), [portrait](built/1-done-card-portrait.jpg), [French](built/1-done-card-desktop-fr.jpg) |
| 2 | Mooring at Skerry: Maren by her stake | [desktop](built/2-arrival-card-desktop.jpg), [landscape](built/2-arrival-card-landscape.jpg), [portrait](built/2-arrival-card-portrait.jpg), [French](built/2-arrival-card-desktop-fr.jpg) |
| 3 | The Island tab | [desktop](built/3-island-tab-desktop.jpg), [landscape](built/3-island-tab-landscape.jpg), [portrait](built/3-island-tab-portrait.jpg), [French](built/3-island-tab-desktop-fr.jpg) |
| 4 | Plot 2 chosen | [desktop](built/4-plot-chosen-desktop.jpg), [landscape](built/4-plot-chosen-landscape.jpg), [portrait](built/4-plot-chosen-portrait.jpg) |
| 5, 6 | From the sea, day and night | [day](built/5-staked-from-sea-desktop.jpg), [night](built/6-staked-night-desktop.jpg) |
| 7 | Later: the warehouse built, Kit's plot given, the spares open for the bakehouse | [desktop](built/7-built-desktop.jpg), [portrait](built/7-built-portrait.jpg) |
| 8 | The warehouse and lookout standing, the other plots staked | [desktop](built/8-warehouse-built-from-sea-desktop.jpg) |
