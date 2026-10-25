# Sea edge follows any outline (decision 0202): test section

A test section, a 360×320 rectangle sticking out east (`test-section.diff`, **not shipped**), added with
`npm run sea -- add edge --sea east --outline "900,-160 1260,-160 1260,160 900,160"`.

| Shot | What |
|---|---|
| ![](1-seam-buoys.jpg) | The north seam from the sailing camera: the buoy line curves out of the old rim into the section |
| ![](2-section-corner.jpg) | The section's far corner, rounded |
| ![](3-round-rim-unchanged.jpg) | Today's rim, unchanged |
| ![](4-in-game-chart.jpg) | In-game chart: the section is new water, fogged |
| ![](5-chart-test-section.jpg) | `npm run chart`: the rim is one line, no trace of the join (the faint dotted box is the edge's own outline, editor only) |
