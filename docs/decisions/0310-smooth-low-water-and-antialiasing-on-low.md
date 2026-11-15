# 0310. Smooth Low water and antialiasing on Low

**Status:** Proposed (2026-11-15).

## Context

Low (issue #548) showed large square tiles of blue in the sea, the flat facets of its coarse 48-segment grid, and stair-stepped edges on the boat and the shore, because its reduced picture had no antialiasing. It is what a weak phone gets and where Auto lands when frames are slow, so it read as broken, not simple.

## Decision

- Low's water shades with one smooth light; only the crest colour shows the swell. Flat facets stay on Medium and up, where the waves give them a reason (`oceanShader.ts`).
- Low turns multisampling on (`graphics.quality.low.antialias`), at the same 400k-pixel picture. The upscale was already smooth (bilinear canvas scaling).

## Consequences

- The Low sea is plainer than before, on purpose. Triangles and draw calls are unchanged.
- Multisampling costs fill rate on a weak tablet. It is one tuning value to turn off again; the real-tablet `?bench&quality=low` check joins #377.
