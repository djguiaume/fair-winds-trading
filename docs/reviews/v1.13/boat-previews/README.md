# Boat previews on the game's sea and sky (#629)

Free Sailing setup and Boat looks, Medium, 1280 x 800 and phone landscape. Decision 0328.

| Sheet | What it shows |
| --- | --- |
| `before-after-desktop.jpg` | Before / after: Saltmere morning (09:00 breeze), Night off Rimewick (23:00 calm), Rain off Westholm (11:00 rain), Boat looks |
| `before-after-phone.jpg` | The same on a phone held sideways (the canvas now runs behind the pages) |
| `preview-vs-game.jpg` | The preview (left) beside the follow cam at the same hour (right), day and night |

Knobs: `src/data/boat-preview.json › sea` (hours, weather, wind) and `views.whole` (tilt 10, fov 30,
margin 0.8: lower than before so the horizon and sky show). Draw calls, preview canvas: +1 on
every level; triangles +6k Low, +14k Medium, +30k High.

Make again: `npm run shots -- --list` with entries `{ "query": "free", "cards": true }`, plus
`"click": ".fs-preset:nth-child(4)"` (night) or `".fs-looks"` (Boat looks).
