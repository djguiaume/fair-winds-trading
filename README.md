# Fair Winds Trading

A top-down, low-poly sailing and trading game for the browser. You sail with (and against) the wind to carry goods between island settlements and watch them grow. The next progression direction is under review: build a personal harbour island, connect existing communities, or prepare for a great expedition. Steam and automated logistics are deferred to later work.

**Play the current prototype:** https://djguiaume.github.io/fair-winds-trading/ (desktop, phone or tablet).

## Status

The sailing/trade prototype now uses the selected **Staggered passages** map: existing ports plus strategic barriers, sandbanks and an open eastern route. Existing prototype trading saves migrate. The sea now extends to radius 440, with distinct coastal scenery and four outer landmarks ([overview](docs/maps/expanded-overview.png), [details](docs/maps/coastal-details.png)). Dock to buy/sell goods, upgrade ships or buy the Cutter; Captain/Kids interfaces and port labels are integrated. Contracts, minimap and settlement growth remain planned. Low graphics has a 750,000-pixel render budget and simpler shoreline shading; actual older-tablet performance still needs device testing.

The original Phase 0 practice map remains in the repository: one sloop, wind with a real no-go zone (tack to go upwind), a practice course of buoys around a few islands, keyboard and touch controls. See the [roadmap](docs/roadmap.md).

## Documentation

- [Roadmap](docs/roadmap.md): phased plan, current progression review and deferred extensions.
- [Story and progression options](docs/reviews/progression/README.md): three competing directions, market references, pros/cons and prototype questions; no direction selected.
- [Later extensions](docs/reviews/progression/extensions.md): steam/harbour logistics and pirates, balancing, risks and fit with each direction.
- [Decisions](docs/decisions/): one file per decision (ADR style), newest number last.
- [Sailing model](docs/sailing-model.md): how boats move and which numbers tune the feel.
- [Art pipeline](docs/art-pipeline.md): how to swap boat and island models.
- [Screenshots](docs/screenshots/): the game as it looks now.
- [Mockups](docs/mockups/): 3D vs 2.5D look comparison.
- [Visual reference](docs/reference/): screenshots from the _Privateers: Pirate Wars_ ad that inspired the art style.

## Development

Needs Node 22+.

```sh
npm install
npm run dev      # local server with hot reload (add --host to try it on a phone on the same Wi-Fi)
npm test         # simulation and DOM integration tests (Vitest)
npm run lint     # ESLint + Prettier
npm run build    # static site in dist/
```

Every push to `main` is tested and published to GitHub Pages by `.github/workflows/deploy.yml`. Add `?debug` to the URL to get the game objects as `fwt` in the browser console. Add `?perf` for a frame-rate readout with a Copy button for device tests (decision 0148). `?bench` runs the automatic device benchmark (decision 0153).

### Layout

| Path                 | What                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| `src/sim/`           | Game state and rules: wind, sailing, collisions, course. Plain TypeScript, no three.js. |
| `src/data/`          | Maps as JSON (Phase 0: `phase0-map.json`).                                              |
| `src/render/`        | three.js scene: ocean shader, camera, wake, wind streaks, quality levels.               |
| `src/render/models/` | Boat and island models behind a swappable interface.                                    |
| `src/input/`         | Keyboard, mouse and touch mapped to the same actions.                                   |
| `src/ui/`            | HUD, trading/shipyard, port labels and settings (plain DOM).                            |
| `tests/`             | Vitest simulation, map, render-budget and DOM integration tests.                        |
