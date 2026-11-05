# 0287. Where a screen's markup and style live

**Status:** Accepted (2026-11-05).

## Context

Issue #392 asked for one HTML file per screen and for every stylesheet under the 400-line rule. The v1.5 UI rebuild already did the game side: `index.html` is the 78-line shell, and each screen's markup is built by the module that owns it (`src/ui/screens/`, `src/ui/chart/`, `src/ui/harbour/`, ...) with its stylesheet beside it, imported by that module. No game stylesheet is over 400 lines any more. What was left: the editors' and `?tune` stylesheets (885, 855, 737 and 510 lines).

## Decision

- Game screens: markup is created in the screen's module (no include plugin needed, nothing to build), style is a `.css` next to it, imported by that module.
- Editor pages and the `?tune` panel: stylesheets are split by area (desk, chart, panel, ...) into files beside their entry module, imported in the original order so the cascade is unchanged.
- The built output is byte-identical to before (`dist` compared file by file).

## Consequences

- Every HTML and CSS file is at most 400 lines (the PR rules check keeps it so).
- A screen's markup and style are found by its name, in its own folder.
- No runtime cost and no new build plugin.
