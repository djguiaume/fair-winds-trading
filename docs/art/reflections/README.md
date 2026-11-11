# Sea reflections of boats and islands (issue #285, decision 0292)

Ultra's planar reflections: the boats, the islands and the drawn sky mirrored on the water.
Shots: Ultra, desktop, headless (SwiftShader), off Saltmere at (235, -125) heading 80, the
turnable camera at its Ultra tilt of 36°.

| Sheet | What |
| --- | --- |
| [1-saltmere-sheet.jpg](1-saltmere-sheet.jpg) | Mirror on, mirror off (today's sky reflection alone), night, the chase view |
| [2-boats-close.jpg](2-boats-close.jpg) | Close: the boats' hulls, sails and masts and the shore band, on and off |
| [3-gale-and-high.jpg](3-gale-and-high.jpg) | A 24 kn gale with big waves (the reflections break up with them); High with its degraded variant switched on (`--tune '{"graphics.quality.high.mirror": true}'`) |

How to look at it: `npm run shots -- --quality ultra --at 235,-125 --heading 80 --yaw 80 --tilt 36 --sail`
(`--query off=mirror` for the comparison, `--chase` for the close view). On a device:
`?bench&quality=ultra` then `?bench&quality=ultra&off=mirror`, and subtract.

Numbers: `graphics.json › reflection` (`npm run tune -- list graphics`), the level flag
`graphics.json › quality.*.mirror`. Settings › Display › "Boat and island reflections".
