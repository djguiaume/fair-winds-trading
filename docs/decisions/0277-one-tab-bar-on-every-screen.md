# 0277. One tab bar on every screen

**Status:** Accepted (2026-11-02).

## Context

Settings, the harbour and the chart each drew tabs their own way. The Settings tabs did not read as tabs, and choosing one moved the labels because the chosen tab had a different border width.

## Decision

`src/ui/components/tabBar.ts` is the only tab implementation, in a top row on every screen (Guillaume, 2026-11-02): paper tabs with an ink edge on an ink rule, the chosen tab in the sage wash with ink text, the rest in muted ink, an optional icon and badge, LB and RB at the ends. Every tab keeps one box and one weight, so choosing changes colours only. Sizes are the `tabs` group of `theme.json`. A row that cannot fit scrolls, never wraps.

## Consequences

Screens keep no tab markup or CSS of their own. The harbour and the chart move onto it after PRs #456 and #455 merge. There is no vertical variant.
