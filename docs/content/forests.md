# Forests (the new look, decision [0236](../decisions/0236-instanced-forests-from-biome-recipes.md))

The new look (`?look=v2`) grows each island's forest from [`src/data/forests.json`](../../src/data/forests.json) and the island file's `woods`. The classic look keeps its own woods (`tree`, `tries`, `spacing`).

## An island's woods

- Woods off (`tries` 0): no forest. Turn them on by painting woods in the island builder (Ground tab, 🌲) or `npm run island -- <id> woods --at x,z --r 0.2`.
- Painted woods (`areas`) grow thick; with none painted, clumps cover the biome's share of the free ground in `area`.
- `density` multiplies the biome's cover (and thins or thickens painted woods): builder field **Forest density**, or `npm run island -- <id> woods --density 1.3`. 0 = none; left out = 1.
- `size` is the trees' size, as in the classic look; clearings (🪓, `woods.clear`) stay clear.
- See the result without the game: `npm run island -- <id> check --forest [--level 2]` prints the trees by kind and how many Low, Medium, High and Ultra draw.

## forests.json

- `kinds`: a tree model: `prop` (a recipe in `src/data/props/`), its fixed `vars`, `scale` (a range, × the island's `woods.size`) and `tints` (colours each tree's model is multiplied by; `#ffffff` = as modelled).
- `styles`: island style → biome. Every style in `palette.json` needs one (`npm run check`).
- `biomes`: `cover` (share of the free ground, 0 to 1), `minHeight` (world units: off the beach), `maxSlope` (degrees) and `trees`: kinds with a `share` (weight) and `from`/`to` (where they grow, as shares of the island's highest ground, 0 to 1).
- `clear`: world units kept free round lanes, piers, build spots and the harbour camera's line to each house; `houseWidths` round houses.
- `quality`: the `share` of trees each level draws (the same trees, fewer on lower levels) and whether they cast `shadows`.
- `spacing` (grid step in tree sizes), `jitter`, `sink`, `clump` (noise scale, octaves, `fill` = how full a clump or painted wood is, `ragged` edge).
