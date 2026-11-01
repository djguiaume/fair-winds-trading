# 0269. UI foundation: theme as data, components, screen stack and motion

**Status:** Accepted (2026-11-01), part of v1.5 "A real game" (#438). Follows decision 0268.

## Context

The UI review (decision 0268) found no design system: colour and type tokens only, each screen
styled on its own, token roles that swap by surface (`--brass` is teal on paper), screens shown and
hidden by hand in `main.ts`, and no shared motion. v1.5 rebuilds the screens in waves on the chart
table identity; they need one system to build on first.

## Decision

- **Theme as data.** `src/data/ui/theme.json` holds every token: the chart table colours, the two
  fonts, the type scale, spacing, radius, elevation, durations and easings, the press scale,
  z-index, touch sizes, the two breakpoints and the torn and brushed 9-slice edges (SVG outlines
  filled with the theme's paper, no CSS filters). `src/ui/theme/` writes them into one `<style>` of
  custom properties at boot (`--ui-*`, the type scale stays `--fs-*`) and sets
  `html[data-layout]` (phone, mid, desktop) from the breakpoints. `theme.css` keeps only the font
  faces and style E's paint, with no colour of its own.
- **Style E stays as `legacy`** in the same file, by surface (root, night, on paper), until each
  screen is rebuilt. Removing the on-paper role list now would restyle every old screen; each wave
  drops its screens from the list instead. New components never read style E tokens.
- **One module, three ways in** (decision 0153): `src/editor/theme/doc.ts` is shared by the
  editors' Theme page (live preview of the components by day and night) and `npm run theme`
  (`list`, `set`, `check`, `export`, `import`). `npm run check` holds the rules: WCAG AA (4.5:1)
  for ink and muted ink on paper and night paper, ink on the sage washes, text on sage and the
  danger colour on paper; no colour near the
  reserved signal colours or whiter than `#f6f9fb` (the cosmetics rules); type of 11 px or more;
  44 px touch targets; durations from 150 to 250 ms.
- **Eight components** in `src/ui/components/`, one module each: button (primary sage, plain
  paper, danger as an ink outline with a small danger mark, never a red fill),
  tab bar (LB/RB glyphs), card, panel (torn edge, follows the night or is forced), list row
  (56–64 px), dialog, toast, screen header (back or close, pad legend slot). Primary buttons carry
  `data-pad-main` (the pad starts there), danger `data-pad-start="never"`, the header's exit
  `data-pad-close`: two small hooks in `padFocus.ts`.
- **Screen stack** (`src/ui/screens/stack.ts`): push, replace, pop, close and reset; only the top
  shows; Esc and B call the top's `back`; `padScreen()` comes from it. The title or pause menu,
  settings, help, transfer and new voyage moved onto it unchanged.
- **Motion** (`src/ui/motion.ts`, `motion.css`): a way in per push (fade or slide), toast rise and
  sink, number rolls and the pressed scale, all off with `prefers-reduced-motion`. Transitions are
  CSS animations; number rolls ask for frames only while rolling, from a pool, so an idle UI costs
  nothing per frame.

## Consequences

- Later waves build screens from the components and drop them from the style E list; when the
  list is empty, `legacy` goes.
- The fonts' files and `@font-face` rules come with the identity assets (#439); until then the
  theme's font stacks fall back to Georgia and Trebuchet MS.
- Ways out are instant, so a closed screen never takes a click and the app tests see `hidden` at
  once.
