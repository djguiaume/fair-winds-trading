# Ground detail (issue #499, decision 0297)

Before and after, Ultra, same camera. Left: today (`?off=cover`). Right: with the ground cover.

- [chase.jpg](chase.jpg): Saltmere by day and night, Sunreach, chase camera.
- [classic.jpg](classic.jpg): Saltmere, and the north shore of Sunreach by day and night, classic camera.
- [close-ups.jpg](close-ups.jpg): sand and grass up close.

Re-run a pair: `npm run shots -- --quality ultra --chase --sail 0 --speed 0` and the same with
`--query off=cover` (Sunreach: `--at -95,-485 --heading 180`; classic: drop `--chase`, add
`--look -95,-548 --zoom 0.9`, or `--moor saltmere --zoom 0.6`).

Numbers: `npm run tune -- list terrain | grep cover`, or the `?tune` panel under Terrain.
Which ground wears what: `cover` in `src/data/palette.json › grounds`.
