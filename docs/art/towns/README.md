# Growing towns (mockups for decision 0060)

Static renders of the real game code (`models.html?view=towns`), proposed in [decision 0060](../../decisions/0060-growing-town-visuals.md). Each port island gets a low waterfront shelf for its town; the beach, collision outline and pier are unchanged.

Reproduce: `npm run build && npx vite preview`, then open `models.html?still&view=towns&kind=fish` (or `timber`, `grain`, `stone`), `&kind=all&level=1..4`, `&kind=all&before` for today's islands, and `&focus=1..4` for the game camera on one island.

## One island, four levels

Hamlet, village, town, port town.

![Saltmere levels](levels-saltmere.png)
![Port Calda levels](levels-port-calda.png)
![Westholm levels](levels-westholm.png)
![Stonehaven levels](levels-stonehaven.png)

## Today vs port town

![Port islands today](all-ports-today.png)
![All ports at level 4](all-ports-level4.png)

## At the game camera

![Saltmere hamlet](saltmere-hamlet-game-camera.png)
![Saltmere port town](saltmere-port-town-game-camera.png)
