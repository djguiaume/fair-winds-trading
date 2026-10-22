# 0084. Hull-aware, more forgiving docking

**Status:** Implemented for review, 2026-10-22.

## Context

Large ships could touch a harbour while the label still said to sail closer. Docking measured
from the ship centre to the shore or pier tips, while collision clearance depended on ship
size. Alongside approaches and growing docks exposed the mismatch. The same range controlled
automatic mooring and the Dock button.

## Decision

Share the seven ships' authored hull outlines, depth sections, dimensions and display scale
between rendering and the simulation. Project the widest hull sections into an upright
footprint and rotate it with the ship heading. Measure the nearest gap to the port island's
coasts and the full solid pier segments, including width, crossbars and working docks. Keep
the circular-shore fallback for legacy islands. Moored decorative boats remain obstacles,
not docking targets.

Allow a hull-to-harbour gap of 16 units (the former centre-based limit was 14). Use the same
distance for explicit and automatic docking, approach labels, mooring assistance and
undocking. Retain the 1.5 kn docking speed limit, the 3 kn mooring-assistance limit, the
6-unit departure margin and existing collision and damage rules.

## Consequences

Bow, stern and alongside approaches account for actual hull proportions and heading. Model
edits and docking share the same hull data without importing rendering code into the
simulation. Rigging, bowsprits, waves and heel do not change the docking footprint, keeping
the interaction stable. Collision shapes are unchanged.

Cache static harbour geometry per settlement level. Before a range check, use enclosing
circles to reject harbours that are certainly too far away; nearby checks still use the
full oriented hull and pier geometry.

Regressions cover every port on both maps, all seven ships, four settlement levels, multiple
headings, pier ends and sides, shoreline contact, speed rejection and departure hysteresis.
The existing rendered-pier/trade-panel and sail-lowering tests now cover the full fleet.
