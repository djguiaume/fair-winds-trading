# 0281. Version 1.5 release, A real game

**Status:** Accepted (2026-11-02).

## Context

Every part of the [v1.5 brief](../v1.5/brief.md) is merged on `main`: the foundation (theme as data, eight
components, the screen stack and motion, [0269](0269-ui-foundation-theme-as-data-components-screen-stack-and-moti.md)),
the title, pause, settings and New voyage ([0271](0271-title-pause-settings-and-new-voyage-on-the-components.md)), the sea
HUD ([0273](0273-sea-hud-in-three-clusters-quiet-hud-and-idle-fade.md)), the moments
([0274](0274-ui-moments-and-feedback.md)), the close chase camera ([0272](0272-close-chase-camera.md)), the harbour
([0276](0276-harbour-screens-on-the-v15-paper.md)), the chart
([0275](0275-paper-sea-chart-one-theme-top-tabs-and-split-modules.md)), the loading and portrait pages
([0277](0277-loading-screen-and-portrait-page.md)), one tab bar
([0278](0278-one-tab-bar-on-every-screen.md)), the remaining screens
([0279](0279-remaining-v15-screens-on-the-components-old-menu-styles-remo.md)) and the port screen's island banners
([0280](0280-port-screen-island-banner-over-a-full-opaque-ledger.md)). Guillaume gave the visual OK on the screens and on
the port screen in the game.

## Decision

- **This is an update.** `package.json` goes to `1.5.0` and the menu label to "1.5"
  ([0042](0042-light-versioning.md), [0219](0219-version-1-0-release.md)).
- **The old look is gone.** `hud.css`, `port-screen.css`, `phone-landscape.css` and `theme.css` (style E's button paint,
  its on-paper flips and its fonts) are deleted; the `legacy` roles are out of `theme.json`; Barlow, Barlow Condensed
  and Fraunces are deleted. What the game still needs from them lives in `page.css`, `questTestBar.css` and the screens'
  own files, on `--ui-*` tokens only. The editors keep their own palette and system fonts.
- **Shots default to desktop plus phone landscape** (`npm run shots`, so the CI sheet too). Portrait stays a size you ask for.
- **The tag** is the version the menu shows for this PR's merge (v1.5.372 if nothing merges first), published with the
  release workflow and the notes in `docs/releases/` ([0062](0062-github-releases-per-phase.md)).
- ADRs 0268, 0273, 0275, 0278, 0279 and 0280 become Accepted with this release.

## Consequences

- One look everywhere: no screen reads style E any more, and a new screen has one place to start (`src/ui/components`).
- The painted port banners (day and night, 14 ports) cost 364 CU in total, spent once and kept in the repo.
- Open and never blocking: device `?bench` runs (#377), and the story release v1.6 ([plan](../v1.6/plan.md), #358).
