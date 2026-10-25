# 0218. Finished quests in the journal

**Status:** Accepted (2026-10-25). Guillaume, on a screenshot of the chart's Journal: "players cannot see details of quests they already finished", then "just fix and merge", before v1.0.

## Context

The Journal (a page of the chart since [0196](0196-sea-chart-tabs.md)) listed a finished quest as the giver's name and "Done": no quest name, nothing to open. Rook's two quests or Wren's four looked the same. The faces in the list also drew as empty hexagons in the real game: every portrait shared one clip id, and a browser takes the first copy in the page, which sat in a hidden screen.

## Decision

1. A finished quest's row names it: "The mill on the hill · Done" (or "· you chose …").
2. The row opens (tap, Enter, A on a controller) and closes again: each step of its main line with its title and what the person said, the answer picked, then their thanks. One open at a time. Only words already written for the quest show; no new text.
3. Each portrait gets its own clip id.

## Consequences

- `JournalEntry.story` (`src/ui/questView.ts`), `storyHtml` and the open row in `src/ui/seaChart.ts`, styles in `src/ui/quests.css`. Tests in `tests/sea-chart.test.ts`.
- A quest that branched shows its main line (the first answer's way), as the card's step count does.
