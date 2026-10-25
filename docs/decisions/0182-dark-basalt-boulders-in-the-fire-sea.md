# 0182. Dark basalt boulders in the fire sea

**Status:** Proposed (2026-10-25).

## Context

The `boulder` prop was tan (`rock2` / `rock`) in every style. In the fire sea it broke the
palette (art bible §6: black basalt, moss `#7fa852`). Emberhold has three, and the art director
asked for them in the west fills review ([0181](0181-fill-the-west-seas-open-water.md)): a palette
name per style, charcoal basalt with a moss fleck for the volcano style.

## Decision

- The boulder takes the palette names `boulder` and `boulder2` (by variant), whose defaults are
  the old tan colours, so every other style looks the same as before.
- The volcano style (`palette.json` › `styles.volcano.colors`) gives each a list: charcoal basalt
  with one moss green among them.
- A prop part may set `faces: true`: each face then takes a colour from the whole list its `color`
  names, picked by the face (the same speckle the grounds use, `paintFaces`). With a single colour
  it paints as before. The boulder uses it, so a volcano boulder is charcoal with a few moss faces.

## Consequences

- Emberhold's three boulders are now dark with moss flecks (its golden hashes change); no other
  island's look changes.
- Any recipe can speckle a part per style the same way, from data.
