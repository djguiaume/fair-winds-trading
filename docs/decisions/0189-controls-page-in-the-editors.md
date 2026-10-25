# 0189. Controls page in the editors

**Status:** Accepted (2026-10-25).

## Context

`src/data/controls.json` holds the controller's numbers, which buttons do what at sea, on the
chart and in menus (decision 0162/0163), TV mode (0183) and each pad maker's button names (0186).
Guillaume's rule: everything data driven **and** everything in the editors, with a matching agent
tool. The file was data but could only be changed by hand.

## Decision

- The map editor gets a **Controls** page (top bar, beside Quests; `src/editor/controls/`):
  - **Pad**: the pad-wide numbers (dead zone, `sampleEveryMs`, trigger press, repeat timings).
  - **At sea / Sea chart / Menus and cards**: each place's stick axes (a list of `lx ly rx ry`),
    its numbers, and every action as a row of button chips to turn on or off.
  - **TV mode**: user-agent words, the pad emulation value, the safe margins, Back stays.
  - **Pad makers**: each maker's match words, a name per button and a column per language that
    overrides it (the hint shows the name it falls back to).
  - The checks beside the form, Undo/Redo, Reset, a working copy in the browser, and
    **Export controls.json**, written byte for byte as the file is (`formatJson`).
- The page's fields come from the file: a new number or action in a place shows up without page
  code. Pure parts in `src/editor/controls/doc.ts` (`controlsProblems`, `controlsText`).
- **Agent tool**: agents edit the file directly (decision 0153) and run
  `npm run check -- --only controls`, which runs the page's checks (`controlProblems`,
  `tvProblems`, `brandProblems`); `--controls file.json` checks a page export.

## Consequences

- Retuning the pad (a button for an action, the repeat speed, a pad maker's names) needs no code.
- New sections of `controls.json` need a page section (the fields inside a section are found by
  themselves).
- Not done: trying an edited controls file in the game without committing it (the game reads the
  shipped file); export and commit for now.
- Tests: `tests/controls-page.test.ts` (export byte for byte, checks, fields, chips).
