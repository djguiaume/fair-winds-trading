# 0107. Player text in one JSON file per language

**Status:** Implemented for review (2026-10-23). Requested by Guillaume; part of the data-driven work in [0093](0093-data-driven-content-and-authoring-tools.md).

## Context

[0037](0037-english-and-french-translations.md) already put every player-facing string in one dictionary per language, but as TypeScript files (`src/i18n/en.ts`, `fr.ts`). Guillaume wants to edit content himself without code ([0093](0093-data-driven-content-and-authoring-tools.md)). Text is the most edited content, and TypeScript syntax (quotes, `as const`, escaped apostrophes, comments) gets in the way of a quick wording fix on GitHub. Tuning, maps and islands are already JSON ([0094](0094-tuning-moved-to-data.md), [0095](0095-map-editor.md), [0101](0101-island-files-built.md)).

## Decision

1. **`src/i18n/en.json` and `src/i18n/fr.json`** replace `en.ts` and `fr.ts`, generated from them: same 548 keys, same order, same text byte for byte. `en.json` stays the source of truth.
2. **Types come from the JSON.** `src/i18n/index.ts` imports both files; `MessageKey` is `keyof` the English file, and the French file is assigned to `Record<MessageKey, string>`, so a key missing from `fr.json` still fails `tsc` (checked by removing one). `tests/i18n.test.ts` keeps checking keys, placeholders, empty text and French spacing.
3. **How to edit:** [docs/i18n/README.md](../i18n/README.md).
4. JSON has no comments, so the section headings of the old files are gone; key prefixes (`menu.`, `hud.`, `port.`…) do the grouping.

## Consequences

- Wording changes need no code and no Claude: edit the JSON on GitHub and let CI check it.
- No gameplay or visual change; the bundle is the same text.
- A later text editor page (side-by-side English/French with the checks live) can read and write these files directly.
