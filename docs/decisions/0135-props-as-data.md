# 0135. Buildings and props as data

**Status:** Accepted (2026-10-24): Guillaume chose the hybrid (JSON recipes + palette) on the decision card. Nothing is built yet. Asked by Guillaume after the ship files of [0109](0109-one-file-per-ship.md): "a list of buildings with each building's geometry, colour etc", first checking the best way. Full comparison, prototype and before/after picture: [reviews/props-as-data](../reviews/props-as-data/README.md).

## Context

The 43 prop types the island files place (homes, town buildings, workshops, farm and stone pieces, trees, rocks, landmarks) are TypeScript functions in `src/render/models/props.ts` and `landmarks.ts`, and their colours are constants there (`C`, `STYLE`). Where they stand is already data (island files, [0101](0101-island-files-built.md)); what they look like is not, so a new building or a colour change needs code, against [0093](0093-data-driven-content-and-authoring-tools.md). The home island's `buildings.json` ([0126](0126-home-island-build-spots.md)) holds prices and effects; its buildings are drawn by tagged props.

Options weighed: a recipe file per prop (primitive shapes + a palette), the ship pattern (numbers into one builder + named code parts), glTF files, or a hybrid. glTF is the standard for artist-made meshes, but this project builds its assets in code and has no 3D modeller; it would also break the island golden hashes and complicate palettes and variants.

## Decision

1. **Hybrid recipes.** One file per prop, `src/data/props/<id>.json`, loaded with `import.meta.glob`, holding its catalogue flags (`group`, `home`, `building`, `water`, `edge`, `fit`…) and a list of **parts**: shapes (`box`, `cyl`, `gable`, `hip`, `dome`, `ico`, `dodeca`, `torus`, `plane`, `windows`, `use` another prop, `part` = a named code part), placement (`at`, or ordered `ops`), and colour by name.
2. **Colours in `src/data/palette.json`**: named colours and walls/roofs per island style. A recipe uses the island's style unless it fixes one.
3. **Variety from the island file's existing fields**: `variant` picks colours and options (`if`), `shape` (0 to 1) sets sizes through `vars`; `repeat` for rows of posts or sails; `extends` for named variants (`windmill-bare`). Numbers may be small expressions (`"h / 2"`), read by a safe reader compiled once at load, never `eval`.
4. **Code where data cannot reach**: shapes computed from a layout (docks, piers, ramps, stairs, lanes, terrain) stay in `towns.ts`; a shape numbers cannot describe (the slipway's lofted hull) is a named code part, as in `shipParts.ts`. glTF can be added later as one more shape kind if an artist joins.
5. **Guards**: the port leaves the island golden hashes unchanged; each prop has a triangle budget by group (homes 120, buildings 400, small props 160, trees 60), checked by a test and shown on the model sheet; the island's 6,000-triangle check stays.
6. **Tools**: the island builder lists prop types from the files; the model sheet gets a prop view with triangle counts; `palette.json` becomes a Colours section in `?tune`. A recipe editor in the builder is a later option.

## Consequences

- A new prop (or a new home building's look) is a JSON file: no code unless it needs a new kind of shape.
- No visual or performance change from the port: the same triangles are built. The prototype matches the code vertex for vertex for the fish house (20 variant/shape pairs), market hall, windmill and bare windmill.
- Work after approval: PR 1 the port (reader, palette, 43 files + landmarks, checks, budget test, how-to), after the home island thread's warehouse and weather-glass work merges, since both touch props; PR 2 model sheet prop view and `?tune` colours; later, optional, a recipe editor and a `model` field on home buildings for the build card picture.
