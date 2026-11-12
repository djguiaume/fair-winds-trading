# v1.9 small fixes (#517)

`town-before-after.jpg`: Fogwatch-style town (dark and turf roofs), before left, after right, `npm run shots -- --look 730,10 --zoom 1.4`.

Rules: lean-to roofs and chimney caps follow `palette.json › roofTones` (`src/render/models/roofTones.ts`). Moon halo: `graphics.json › sky.sun.moonGlow` and `moonGlowDeg`. Not captured: the night sea with the moon on High and Ultra (the shots tool's camera never framed the moon); to check on a device.
