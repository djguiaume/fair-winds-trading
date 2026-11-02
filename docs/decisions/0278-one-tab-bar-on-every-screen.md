# 0278. One tab bar on every screen

**Status:** Accepted (2026-11-02).

## Context

Settings, the harbour and the chart each drew tabs their own way. The Settings tabs did not read as tabs, and choosing one moved the labels because the chosen tab had a different border width.

## Decision

`src/ui/components/tabBar.ts` is the only tab implementation, in a top row on every screen (Guillaume, 2026-11-02): index tabs of a chart book (art director's spec): paper file tabs with 6 px top corners and a 2 px ink outline on a 2 px ink rule. The chosen tab is paper with a 3 px sage bar, open to the page; the rest sit 3 px lower on darker paper with a soft ink outline and full-strength ink labels in IM Fell English. Hover and pad focus wash sage. A badge is a small sage circle on the tab's corner, the only filled colour. LB and RB are ink keycaps at the ends; the header's close is a square ink keycap. Every tab keeps one box and one weight, so choosing changes colours only. Sizes are the `tabs` group of `theme.json`. A row that cannot fit scrolls, never wraps.

## Consequences

Screens keep no tab markup or CSS of their own. The harbour and the chart move onto it after PRs #456 and #455 merge. There is no vertical variant.
