# South sea review: Sunreach (ADR 0152)

Real captures of the Phase 4 dev sea (`?map=phase4`), reviewed by Guillaume ("Ok for all", 2026-10-24). Decision: [0152](../../decisions/0152-south-sea-sunreach-layout.md).

## The plan

![Labelled map of the south sea](schema.png)

Drawn from the data (`src/make-schema.cjs`); routes are schematic.

## The chart

| Desktop | Portrait |
|---|---|
| ![](chart-desktop.png) | ![](chart-portrait.png) |

### Wind zones charted once sailed

After sailing in all three named zones: a dashed edge in the kind's colour and the name with its kind. In portrait (whole sea) the names stay off until you zoom in, like the other place names; Sunreach Sound's name shows once zoomed in.

| Desktop | Portrait |
|---|---|
| ![](chart-zones-desktop.png) | ![](chart-zones-portrait.png) |

![Zoomed in on Sunreach: Sunreach Sound, sheltered water](chart-zones-zoomed.png)

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

## Cardinal marks

All four (north, east, south, west, left to right), then the two placed at the Narrows reef ends:

![The four cardinal marks](cardinals-lineup.png)
![North cardinal at the Narrows north reef](cardinal-north.png)
![South cardinal at the deep channel](cardinal-south.png)

## Around the sea

![The Glass, doldrums south of Wreck Reef](the-glass.png)
![The deep channel round the Narrows reef, inside The Trades](deep-channel.png)
![The tea gardens across the Sound](sunreach-tea-gardens.png)

The [design review](design-review.md) explains the look.

![Palm Key, the outpost site, with its daymark](palm-key.png)
![Lone Palm](lone-palm.png)
![Wreck Reef](wreck-reef.png)
![Sugar Bar](sugar-bar.png)

## Regenerating

- `node src/make-south.cjs` writes `src/data/seas/south.json` and the four island files (once; after that edit them in the island builder).
- `npx vite --port 5199`, then `node src/capture.cjs [name ...]` for the screenshots.
- `node src/make-schema.cjs` for the plan.
