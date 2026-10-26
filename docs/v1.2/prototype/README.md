# Prototype scripts (reference only)

The two page scripts that made the mockups behind decisions [0221](../../decisions/0221-an-ultra-quality-level-for-desktop-and-xbox.md) and [0222](../../decisions/0222-a-new-look-smooth-terrain-blue-water-and-forests.md). They are **not game code** and no tool runs them: they patch a running game from outside, with no data, Settings or tests. The build threads read them for the working recipes and numbers, then build the real thing as described in [the v1.2 plan](../plan.md) and the [v1.1 Ultra section](../../v1.1/plan.md#ultra-quality-level-for-desktop-and-xbox).

| File | What it does |
| --- | --- |
| `ultra-effects.js` | Grabs the `GameView` by patching `GameView.prototype.render` once; lowers the camera to about 35° and the sun; neutral tone mapping; 4096 px PCF-soft shadows on every lit mesh; `EffectComposer` with `RenderPass`, `GTAOPass` (water, glows and basic meshes hidden from its normal pass), optional tilt-shift, `OutputPass`. Mode from `window.__fx`: `cam`, `tone`, `ao`, `full`. |
| `new-look.js` | Needs `ultra-effects.js` first (`window.__view`). Rebuilds each island's `terrain` mesh as a smooth height grid, keeps town terraces, colours by height and slope, plants instanced forests, recolours the water from a seabed depth texture, adds haze. `window.__biome = 'tropic'` for the south mix. |

How the mockups were taken (a real game screenshot, no game code changed):

```
npm run shots -- --look -95,-640 --zoom 1.8 --script v-ao.js,docs/v1.2/prototype/ultra-effects.js,tropic.js,docs/v1.2/prototype/new-look.js
```

with `v-ao.js` = `window.__fx='ao';` and `tropic.js` = `window.__biome='tropic';` (one-line files). Sunreach is at `-95,-640`, Saltmere at `285,-150`.
