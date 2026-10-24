# East sea review: Fogwatch (ADR 0172)

Real captures of the Phase 4 dev sea (`?map=phase4`), taken with `npm run shots` and `npm run chart`. Decision: [0172](../../decisions/0172-east-sea-fogwatch-the-stepping-stones-and-fog-banks.md). The fog banks' haze is [0169](../../decisions/0169-haze-fog-banks-and-ash-clouds-as-wind-zone-kinds.md) ([its review](../haze/README.md)). Waiting on Guillaume's look.

## The labelled map

![Labelled map of the east sea, with Saltmere → Fogwatch sailed](chart.png)

The whole Phase 4 sea, for where the east sits: [chart-wide.png](chart-wide.png).

`npm run chart -- --sea phase4 --view 380,-200,1000,620 --route saltmere,fogwatch`. The Stepping Stones (basalt skerries) close the sea at about 520 from the centre, from 46° round to the Coral Line; the one gateway is **Gannet Sound** (78.5° to 85.5°, a red and a green buoy and a light). Inside: Fogwatch with its sheltered voe facing the ring, the Giant and his Wife (two sea stacks), Lamb Holm, Puffin Holm in the Haar, Amber Strand (the outpost site) north beyond the Grey Murk, and the Race, a 2 kn north-going current with Broch Isle beyond it. The storm belt's band (y 230 to 340, x 600 to the edge) is left open for its own thread.

| Leg (sloop, Fair winds) | Time |
|---|---|
| Saltmere → Fogwatch (through Gannet Sound) | 68 s |
| Fogwatch → Amber Strand | 73 s |
| Fogwatch → Sunreach | 132 s |

## Fogwatch

A Faroese harbour town: tarred black and whitewashed turf-roofed houses with red frames, boathouses and drying sheds on the quay, a foghorn tower on the north point, sheep and standing stones on the fells.

![Approach through the voe](fogwatch-overview-desktop.png)
![The town and quays](fogwatch-town-desktop.png)
![The fells behind the town](fogwatch-fells-desktop.png)
![At night](fogwatch-night-desktop.png)
![Portrait](fogwatch-portrait-portrait.png)
![Charted on arrival](fogwatch-approach-desktop.png)

## The islets

| | |
|---|---|
| ![The Giant and his Wife](giant-and-wife-desktop.png) | ![Lamb Holm](lamb-holm-desktop.png) |
| ![Broch Isle beyond the Race](broch-isle-desktop.png) | ![Puffin Holm in the Haar](puffin-holm-desktop.png) |

## Amber Strand (outpost site, before founding)

Dune sand and marram grass, amber on the beach. Its port opens with the `outpost-east` arc (not written yet).

![Amber Strand](amber-strand-desktop.png)

## Sea

| | |
|---|---|
| ![Gannet Sound, the gateway](gannet-sound-desktop.png) | ![Inside the Haar](the-haar-desktop.png) |

The steps that made the sea and Fogwatch, as data: [sea-steps.json](sea-steps.json), [fogwatch-steps.json](fogwatch-steps.json).
