# Growing towns (mockups for decision 0060)

Static renders of the real game code (`models.html?view=towns`), proposed in [decision 0060](../../decisions/0060-growing-town-visuals.md). Each port grows its own way: its own island profile, buildings, layout, industry and dock. The beach, collision outline and main pier line are unchanged.

Reproduce: `npm run build && npx vite preview`, then open `models.html?still&view=towns&kind=fish` (or `timber`, `grain`, `stone`, `yard`), `&kind=all&level=1..4`, `&kind=all&before` for today's islands, and `&focus=1..4` for the game camera on one island of the strip.

## Each port, levels 1 to 4

Hamlet, village, town, port town.

![Saltmere levels](levels-saltmere.png)
![Port Calda levels](levels-port-calda.png)
![Westholm levels](levels-westholm.png)
![Stonehaven levels](levels-stonehaven.png)
![Abbey Head levels](levels-abbey-head.png)

## Today vs port town

![Port islands today](all-ports-today.png)
![All ports at level 4](all-ports-level4.png)

## At the game camera (port town)

![Saltmere](saltmere-port-town-close.png)
![Port Calda](port-calda-port-town-close.png)
![Westholm](westholm-port-town-close.png)
![Stonehaven](stonehaven-port-town-close.png)
