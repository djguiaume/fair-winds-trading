# 0073. Calda's forested mountain plateau

**Status:** Implemented for review, 2026-10-22.

## Context

The expanded level-4 timber town cleared too much woodland. Its small upper shelf also lacked
an identifying skyline and left little room around the upland log yard and lumber store.

## Decision

Extend the island and upper plateau toward the back right. Add an asymmetric two-peak rocky
ridge above the plateau and retain a denser permanent conifer forest around working clearings.
Keep the sandy log yard, upper log piles, cutting shed, sawmill and boatyard. Relocate the lumber
store to the plateau's western clearing so its footprint stays clear of mountain slopes.

The shared coastline supplies collision, chart, water and wind shelter; the mountain increases
Calda's wind shelter. Trees cannot be placed on the pointed rock surfaces. The model-sheet camera
frames the enlarged landscape at the same distance for every Calda growth stage.

## Consequences

Calda keeps a forested skyline at level 4 rather than becoming a bare residential island. Added
woods use inexpensive open conifer geometry with the total land-mesh ceiling increased from 20,000 to 21,000 triangles (5%) for the larger forested landscape. Draw-call count stays unchanged. Physical device performance remains unmeasured. Checks cover
retained plateau woodland, buildings and log yards, shore collision and sailing routes. Actual
level-1, level-4 and night captures accompany the revision.
