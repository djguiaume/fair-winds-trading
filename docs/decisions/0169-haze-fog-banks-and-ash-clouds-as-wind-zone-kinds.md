# 0169. Haze: fog banks and ash clouds as wind-zone kinds

**Status:** Accepted (2026-10-24). Guillaume: "Fog is perfect. View range must of course come from data." A shared piece for the Phase 4 seas: the east sea's fog banks use it first, the west sea's ash clouds next, the north sea's tint is meant to sit beside it. Screenshots: [docs/reviews/haze](../reviews/haze/README.md).

## Context

The east sea is a fog coast and the west sea has ash clouds ([0137](0137-phase-4-biomes-and-founded-outposts.md), [storyteller brief](../story/storyteller-brief.md#each-seas-hazards-and-set-pieces-guillaume-2026-10-24)). Both are the same thing: a place at sea where you see less. Wind zones ([0140](0140-wind-zones-and-currents.md), [0144](0144-wind-zones-in-the-sim.md)) already give named, soft-edged outlines in the sea files with their numbers per kind in `weather.json`, the sea editor's Add wind zone tool, `npm run sea -- add zone`, and charting once sailed ([0152](0152-south-sea-sunreach-layout.md)). The east, west and north threads agreed to build sight on top of them once, rather than three mechanisms. Every hazard needs its own Settings switch, and no story step may need one on.

## Decision

1. **A zone kind may carry `haze`** in `weather.json` › `zones.kinds`:
   `"haze": { "near": 0, "far": 35, "color": "#cdd6d8", "fade": 120, "switch": "fog" }`.
   `near` and `far` are sight in units past the boat (the scene fog closes in to them), `color` the fog colour by day (night darkens it toward the night sky), `fade` how wide the edge is over which it thickens (wider than a wind zone's 40, so you see it coming), `switch` the Settings switch that clears it. A zone's own `tune.haze` overrides its kind's. Everything is in the `?tune` panel.
2. **First kind: `fog-bank`** (light wind, `strength` 0.8, `gusts` 0.6, pale grey haze). West adds `ash` on top. A kind may also carry `chart`, its tint on the editor map and the labelled chart, so new kinds need no colour in code.
3. **What you see:** the scene fog (sky, sea, islands) takes the haze's colour and closes in toward its sight, the sun dims a little, and a veil over the screen keeps the sea round the boat clear while the edges go grey. The veil is a CSS gradient whose opacity changes only when the haze does (no repaint, nothing at open sea), so it costs an old tablet nearly nothing; the fog itself is the scene fog that is always on.
4. **Sight is looked, not sailed.** The haze is read where the camera looks through one helper, `zoneVisualAt` in `src/sim/windZones.ts`, which ignores wind numbers and Settings › Wind zones: with wind zones off a fog bank still fogs (its wind effect goes), and with **Settings › Fog banks** off it is clear (its wind stays, if wind zones are on). The north sea's water and sky tint is meant to join the same helper.
5. **Settings rows from the data.** Settings gets one switch per distinct `haze.switch` in `weather.json` (text `settings.haze.<switch>` and `…Note` in both languages), after Currents. Saved as `settings.haze` (`{ "fog": false }`); left out means on.
6. **The view range is data too** (Guillaume): `weather.json` › `sight` holds the open sea's sight in camera distances (`near` 1.3, `far` 2.4), how much rain or a storm (`gloomNear`, `gloomFar`) and night (`nightNear`, `nightFar`) close it in, how a haze dims the sun and darkens at night, and the veil's rings and opacities. All in `?tune`.
7. **Charted once sailed** like named wind zones: deep inside a named fog bank, by its haze, even with Wind zones off. The chart draws it grey ("The Murk · fog bank") while Wind zones or its haze is on.

## Consequences

- A new fog bank is a wind zone of kind `fog-bank`: the sea editor and `npm run sea -- add zone --kind fog-bank` already make it. A new hazy kind is data only (kind, its haze and chart tint, two text lines).
- Route and balance checks see a fog bank only as light wind; sight does not change sailing times.
- No story step may need a fog bank or an ash cloud: each has its switch.
