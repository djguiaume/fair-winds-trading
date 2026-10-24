# South sea review: Sunreach (ADR 0152)

Real captures of the Phase 4 dev sea (`?map=phase4`), for Guillaume's review before anything is merged. Decision: [0152](../../decisions/0152-south-sea-sunreach-layout.md).

## The plan

![Labelled map of the south sea](schema.png)

Drawn from the data (`src/make-schema.cjs`); routes are schematic.

## The chart

| Desktop | Portrait |
|---|---|
| ![](chart-desktop.png) | ![](chart-portrait.png) |

## Sunreach

![Sunreach from above](sunreach-desktop.png)
![The town on the inner shore](sunreach-town.png)
![The west entrance](sunreach-west-entrance.png)

| Phone landscape | Phone portrait |
|---|---|
| ![](sunreach-landscape.png) | ![](sunreach-portrait.png) |

## The way in and the Narrows

![The Keeper's Passage, buoyed and lit](keepers-passage.png)
![A sloop crossing Palm Key Narrows](narrows-sloop.png)
![An indiaman refused by the Narrows](narrows-indiaman.png)

## Around the sea

![Palm Key, the outpost site, with its daymark](palm-key.png)
![Lone Palm](lone-palm.png)
![Wreck Reef](wreck-reef.png)
![Sugar Bar](sugar-bar.png)

## Regenerating

- `node src/make-south.cjs` writes `src/data/seas/south.json` and the four island files (once; after that edit them in the island builder).
- `npx vite --port 5199`, then `node src/capture.cjs [name ...]` for the screenshots.
- `node src/make-schema.cjs` for the plan.
