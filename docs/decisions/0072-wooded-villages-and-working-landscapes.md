# 0072. Wooded villages and working landscapes

**Status:** Implemented for review, 2026-10-22.

## Context

Review of the actual 0071 captures found bare future house sites, weak industry silhouettes,
scattered starting homes and a quarry that looked like slabs beside a mountain. Passing geometry
and collision checks had not established visual fidelity to the concepts.

## Decision

Grow each settlement from one compact nucleus. Keep deterministic candidate trees on future
plots; clear them only for occupied homes, visible lanes, workshops and current fields. Untouched
woods retain their positions. Westholm gains fields outwards from its village, replacing trees,
and has one asymmetric inlet instead of two matching prongs. No bridges.

Saltmere has larger moored fishing boats with spars, nets and buoys, fish drying racks, crates,
a smokehouse and a substantial later market. Calda retains a wooded foreground at low levels,
a wheel-facing sawmill, lumber yard and a conspicuous curved ship hull on stocks. Stonehaven's
quarry starts small and cuts progressively into the mountain across four retreating benches, with cranes, blocks and working rails;
residences are excluded from the final quarry footprint. A two-flight cliffside stair links the upper village to a dry-land harbour path. Production buildings have larger, reserved footprints.

The longest central pier is the player berth, marked with a blue-and-white harbour flag. Shorter working piers sit well to either side, and decorative fishing boats moor outside its approach. Westholm's first windmill is beside its first western fields; the eastern mill appears later. Broad shore-range docking remains compatible with existing play and saves.

## Consequences

Tree clearing may reduce triangle counts on a level-up; occupied house counts and stable house
positions remain the growth invariant. Collision, shore effects and charts use the revised shared
coastlines. Existing save data and production rules remain unchanged. Actual level-1 and level-4
screenshots are the visual review evidence, alongside tests for wooded growth, compact nuclei,
quarry progression and exclusion, early mill/field proximity, clear docking approaches, workshops, safe navigation and geometry budgets. These remain primitive game
models; the concept illustrations are a direction, not a claim of pixel-equivalent rendering.

Final placement pass: fishing boats use separate moorings around the coast with varied headings. Residential footprints are tested against one another and the maximum workshop/civic footprints before revealing growth, so later development cannot overlap an older building. Cliff stair treads bear on solid masonry down to the lower terrace.

Calda stores three close-set piles on a locally widened sandy working beach and three on its upper plateau at level 4. Working yards and the player berth have lanterns. The model sheet accepts `&night`, reusing the game atmosphere and lit-window materials for night review.

Saltmere’s lighthouse emits two opposing rotating translucent beams at night (shared geometry/material, no shadow-casting spotlights); game and model sheet use the same effect. Calda adds a recognizable open cutting shed with saw machinery and an upland lumber store, reserved against home and boatyard footprints.
