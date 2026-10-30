# 0243. Per-pass graphics switches in the URL

**Status:** Proposed (2026-10-30).

## Context

Ultra runs at 18 fps on the Surface while High runs at 60, and the waves milestone (#279) needs a sea budget. We do not know what each Ultra pass costs (issue #377). The Settings already switch shadows, occlusion, tone mapping, haze and reflection, but a device test should not need the menu, and multisampling had no switch.

## Decision

`&off=shadows,ao,tonemap,haze,reflection,msaa` turns Ultra parts off one at a time, and `&quality=low|medium|high|ultra` forces a level (auto stepping stays off then). The names are `src/data/graphics-switches.json`; parsing is `src/perf/graphicsOverrides.ts`. `msaa` joins `GraphicsEffects` but has no Settings row. The `?perf` and `?bench` report gets a `Graphics:` line with the look, the forced level and the switches off. With nothing set the game is unchanged.

## Consequences

A pasted result says what ran, so per-pass ms can be subtracted from the Ultra run. Costs are written up in docs/reviews/new-look-performance/README.md after Guillaume's device runs.
