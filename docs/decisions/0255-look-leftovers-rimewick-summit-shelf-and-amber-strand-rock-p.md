# 0255. Look leftovers: Rimewick summit shelf and Amber Strand rock pools

**Status:** Accepted (2026-10-31, issue #372).

## Context

The v1.2 polish (#370) deferred two things. Rimewick's east hill showed a white patch on its flank (most obvious on Low). It was not Low's renderer: the hill's cone started at the snow terrace's height (base 0.3), so the smoothed ground left a flat snow shelf up the cone's north-west side. Amber Strand had no rock pools, and no prop to make them.

## Decision

- Rimewick: the east hill's cone starts above the snow terrace (`base` 0.42, `height` 0.58, the west hill is 0.55), so the cone covers the shelf. Island file data only, no renderer change.
- New prop `rock-pool` (group `rocks`): a shallow teal water disc ringed by five boulders in the existing boulder colours. Three sit on Amber Strand's shore from town level 1, like its driftwood.

## Consequences

- Island golden hashes change for Rimewick and Amber Strand.
- Any island can use `rock-pool` from the builder's prop list.
- Small leftover: a faint snow patch still sits on the hill's west flank; it reads as snow lying on a ledge.
