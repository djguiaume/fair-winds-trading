# 0168. Ground materials and island styles as data

**Status:** Accepted (2026-10-24). A shared piece for the Phase 4 wave 2 seas (north ice, west fire, east fog), agreed with the art director and the west and east sea threads; built by the north sea thread first so the others only add data.

## Context

Island ground could only be `grass` or `rock`, with its colours fixed in `towns.ts` (and the quarry island's rock swapped to cut stone in code), and the island styles (`fish`, `timber`, `grain`, `stone`, `tropic`) were a TypeScript list. The new seas need snow, glacier ice, slate, shingle and cloudberry moor (north), basalt, black sand and lava fields (west), turf and dark cliffs (east), and black or grey beaches. Each would have meant code in the renderer, the checks, the island builder and the island tool, three times over.

## Decision

1. **Grounds are data:** `src/data/palette.json` › `grounds`, one entry per ground with its builder `name`, `top` (flat tops, ramps, slopes), `side` (cliffs), optional `peak` (a mountain's cone), `cap` and `capAbove` (a snow line: a peak's faces above that share of its height), `glow` (a colour that shines at night, for the west's lava cracks, read through `groundColors` and drawn by the thread that adds cracks), `trees: false` (no woods on it) and `beach: true` (a beach a style may use). A colour is a palette name or `#rrggbb`, or a list: then each triangle takes one, picked by a hash of where it is, so snow and shingle get a faint faceted speckle with no texture and no extra draw call (the art director's rule: per face, not noise; snow never pure white).
2. **Styles are data:** `palette.json` › `styles` (walls, roofs as before). A style may swap grounds (`"grounds": { "grass": "snow", "rock": "slate", "sand": "shingle" }`), so an ice island's grass cap is snow without touching the file, while a file can still name any ground outright; the beach is the ground `sand` after the swap. A style may also override palette colours (`"colors": { "path": "#d4dbe2" }`) for its props and paths. `IslandStyle` is now any key of `styles`. The shipped look is unchanged: `stone` swaps `rock` to `cut` (a ground whose peaks stay bare rock), which is what the code did.
3. **First entries:** grounds `sand`, `grass`, `rock`, `cut` (today's), and for the north `snow`, `ice`, `slate`, `shingle`, `moor`; style `ice` (Greenland colours from the art director: oxblood, mustard, slate blue and moss walls, near-black roofs; snow, slate and shingle grounds; trodden-snow paths).
4. **Everywhere the editors and tools reach:** the island checks know every ground and style from the palette; the island builder has a **Style** picker for the island and a **Ground** picker (every ground, showing what the style turns it into) for raised ground, mountains and ramps; `npm run island` takes `--material <ground>` on `plateau`, `mountain` and `ramp`, and a new step `ground <index> [--ramp] --material … --height …` (also in steps files).

## Consequences

- A new ground or style is a palette entry ([content README](../content/README.md#a-new-ground-or-island-style)); the west and east seas add theirs as data.
- Peaks with a snow line are cones with four rings instead of one (about 70 more triangles a peak); everything else costs the same.
- The ground glow and lava rivers are the west sea's to draw on top.
