# 0172. South sea look polish: tropic grounds, jungle woods, night lamps

**Status:** Proposed (2026-10-24). The polish pass the art director asked for in its [south sea review](../reviews/art-direction/south/README.md), approved by Guillaume; screenshots in [docs/reviews/art-direction/south/polish](../reviews/art-direction/south/polish/README.md).

## Context

The south sea ([0152](0152-south-sea-sunreach-layout.md)) used the ring's B2 grass, sandstone cliffs and sand, so Sunreach read as a ring island with palms. Its outer arms and summits were big bare green surfaces, the town was nearly dark at night, Palm Key's hill was one smooth green pyramid, and Juno's tea house, the port's signature ([art bible](../art/art-bible.md) §3.5), read small from far. Grounds became data in [0168](0168-ground-materials-and-island-styles-as-data.md), so the south can have its own without code.

## Decision

1. **Tropic grounds** in `src/data/palette.json`: `coralsand` (a whiter coral beach, `#f5ecd4` / `#f1e6c8`), `jungle` (a deeper, warmer green cap `#5aa63a`…, with warm ochre and red-brown cliff faces `#b8743f` / `#a8603a` / `#c08048`, old volcanic rock) `terrace` (the same jungle cap over lighter ochre risers `#c08048` / `#c88c55`, for Sunreach's two town tiers, so the risers between house terraces do not fight the roofs, art director's note) and `ochre` (bare crater rock, no trees). The `tropic` style swaps `sand` → `coralsand`, `grass` → `jungle`, `rock` → `ochre`, and paints its paths a paler coral (`#dccb9c`). Every tropic island (Sunreach, the South Arm, Palm Key, Lone Palm) takes it without its file changing.
2. **Jungle woods:** a new tree recipe `woodland-jungle` (a palm, or a low wide broadleaf crown in the new `jungle` palette greens), used by Sunreach, the South Arm and Palm Key, with denser woods (more tries, closer spacing, smaller cliff margin). The town terraces stay open because trees keep off homes and lanes as before.
3. **Palm Key's hill** is two jungle tiers with an ochre rock peak (`plateau`, `plateau`, `mountain --material rock`), and its woods grow up the tiers (the old clear circle over the hill is gone).
4. **Tea house:** Sunreach's tea house is a little bigger (size 1.45 → 1.6, the most its terrace takes) and its roof is a named palette colour, `teaRoof`, a brighter jade (`#2a8f6e`) that stands out from the jungle green.
5. **Night:** twelve more `lamp-post`s along Sunreach's two lanes from level 1. They use the lit-window material, so no lights are added.

## Consequences

- Sunreach is 5607 triangles at level 4 (budget 6000, a warning above 5000), the South Arm 5095: still one batched mesh each.
- New tropic islands made with the builder or `npm run island -- new` default to `woodland-jungle` (the most used tree of their style).
- The island golden hashes of the four tropic islands changed (`tests/island-files.test.ts`).
- A data fix on the way: two `null` points in a South Arm ground outline were removed.
