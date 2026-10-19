# Fair Winds Trading

A top-down, low-poly sailing and trading game for the browser. You sail with (and against) the wind to carry goods between island settlements, watch them grow, and eventually run a fleet on automated trade routes that reach farther and harder-to-sail waters.

**Play the current prototype:** https://djguiaume.github.io/fair-winds-trading/ (desktop, phone or tablet).

## Status

Phase 0, the sailing prototype: one sloop, wind with a real no-go zone (tack to go upwind), a practice course of buoys around a few islands, keyboard and touch controls. See the [roadmap](docs/roadmap.md).

## Documentation

- [Roadmap](docs/roadmap.md): phased plan from sailing prototype to full trade network.
- [Decisions](docs/decisions/): one file per decision (ADR style), newest number last.
- [Sailing model](docs/sailing-model.md): how boats move and which numbers tune the feel.
- [Art pipeline](docs/art-pipeline.md): how to swap boat and island models.
- [Screenshots](docs/screenshots/): the game as it looks now.
- [Mockups](docs/mockups/): 3D vs 2.5D look comparison.
- [Visual reference](docs/reference/): screenshots from the *Privateers: Pirate Wars* ad that inspired the art style.

## Development

Needs Node 22+.

```sh
npm install
npm run dev      # local server with hot reload (add --host to try it on a phone on the same Wi-Fi)
npm test         # simulation unit tests (Vitest)
npm run lint     # ESLint + Prettier
npm run build    # static site in dist/
```

Every push to `main` is tested and published to GitHub Pages by `.github/workflows/deploy.yml`. Add `?debug` to the URL to get the game objects as `fwt` in the browser console.

### Layout

| Path | What |
|---|---|
| `src/sim/` | Game state and rules: wind, sailing, collisions, course. Plain TypeScript, no three.js. |
| `src/data/` | Maps as JSON (Phase 0: `phase0-map.json`). |
| `src/render/` | three.js scene: ocean shader, camera, wake, wind streaks, quality levels. |
| `src/render/models/` | Boat and island models behind a swappable interface. |
| `src/input/` | Keyboard, mouse and touch mapped to the same actions. |
| `src/ui/` | HUD and settings (plain DOM in Phase 0). |
| `tests/` | Vitest tests for the simulation. |
