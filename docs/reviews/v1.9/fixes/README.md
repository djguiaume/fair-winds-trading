# v1.9 small fixes (#517)

`town-before-after.jpg`: Fogwatch-style town (dark and turf roofs), before left, after right, `npm run shots -- --look 730,10 --zoom 1.4`.

Rules: lean-to roofs and chimney caps follow `palette.json › roofTones` (`src/render/models/roofTones.ts`). Moon halo: `graphics.json › sky.sun.moonGlow` and `moonGlowDeg`. `moon-high-ultra.jpg` (release lead): night sea, High left and Ultra right, `npm run shots -- --chase --heading 250 --time 668 --at 0,-150` with `--tune` `{"camera.chase.pitchDeg": 2}` to bring the moon into frame. The halo is soft on High; Ultra draws no moon disc at all, also on v1.8.402 (#526).
