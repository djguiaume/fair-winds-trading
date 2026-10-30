# 0241. The new look is the default, ?look=v1 keeps the classic

**Status:** Proposed (2026-10-30).

## Context

Since decision 0222 the new look (v2: smooth ground from the height field, depth-coloured water, forests) was picked with `?look=v2` while the classic look stayed the default. The v1.2 island acceptance (#277) and device gates (#278) have passed, so the new look is what the game ships.

## Decision

`terrainLook` returns `v2` unless the address has `?look=v1`. The game, the editors (`editor.html`), `npm run shots` (`--look v1` for the classic ground) and the CI render budget all follow it. The classic look stays working for comparison; the CI budget measures both. Class constructors keep a classic default so unit tests can build either look explicitly.

## Consequences

- Old `?look=v2` links keep working (v2 is simply the default).
- Shot names carry `v1` instead of `v2`.
- The art bible (#365) is updated by the art director.
