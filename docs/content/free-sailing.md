# Adding a Free Sailing preset

Decision [0266](../decisions/0266-free-sailing-sessions-kept-in-memory-only.md). A preset is where a Free Sailing session starts, at what hour, in what weather and in which ship; the player can change the ship, upgrades and look on the setup screen. Presets live in `src/data/free-sailing/<id>.json` (the setup lists them by hour); `rules.json` holds the checks' numbers. Add one by file, on the editors' **Free Sailing** page (click the chart to place it, then Export preset) or with `npm run free`:

```sh
npm run free -- add harbour-dusk --from saltmere-morning
npm run free -- set harbour-dusk hour 19.5
npm run free -- set harbour-dusk place.x 180
npm run free -- set harbour-dusk name.fr "Crépuscule au port"
```

```json
{
  "id": "harbour-dusk",
  "name": { "en": "Harbour dusk", "fr": "Crépuscule au port" },
  "about": { "en": "One line on the card.", "fr": "Une ligne sur la carte." },
  "place": { "x": 180, "y": -60, "headingDeg": 300 },
  "hour": 19.5,
  "weather": "breeze",
  "ship": { "class": "sloop", "sails": 1, "hold": 1, "hull": 1 }
}
```

`weather` is a kind from `weather.json` (`calm`, `breeze`, `rain`, `gale`); the session starts at the first game time with that weather at that hour. `npm run free -- check` (also in `npm run check`) refuses a start on or near land or shallows for the largest ship, inside a harbour's docking reach, outside the sea, or a weather that never comes at that hour on some level. Point `headingDeg` across the wind (`npm run free -- walk --shots dir` shows her at sea).
