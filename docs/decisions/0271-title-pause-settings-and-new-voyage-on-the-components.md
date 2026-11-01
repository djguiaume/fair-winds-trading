# 0271. Title, pause, settings and New voyage on the components

**Status:** Accepted (2026-11-01).

## Context

Wave 1 of v1.5 "A real game" (issue #440, [decision 0268](0268-a-real-game-rebuild-the-ui-as-one-system-v15.md)). The foundation ([0269](0269-ui-foundation-theme-as-data-components-screen-stack-and-moti.md)) and the identity assets are merged; the first four screens still used style E markup in `index.html`, one `menus.css` of 1,500 lines, and about 350 lines of settings wiring in `main.ts` that looked controls up by id.

## Decision

- **Title** is title 6 of the kit: a full-height torn logbook page (day paper always) on the left with the stacked logo, the tagline and the menu, the key art on the right (the README cover graded by `grade_cover.py`, `src/ui/screens/art/title-key.jpg`, until a golden-hour render is approved). The page is wider than it looks so only the torn edge towards the art shows. Continue (with the save line "Saltmere, day 12, 150 gold") is the one sage row; New voyage, Free Sailing and Settings are plain rows of the same size; How to play, the lessons, Move your voyage, fullscreen and EN/FR sit in a small line under them. With no save, New voyage is the sage row. New voyage over a save asks first and erases it.
- **Pause** is a small centred paper card, never the title: Resume (sage), Chart, Settings, Quit to title (asks, saves, reloads). Esc and B resume. The lessons moved to Settings › Game.
- **Settings** has four tabs (Game, Display, Sound, Controls) of list rows with three controls (switch, choice, slider). Rows are described as data (`SwitchSpec`, `ChoiceSpec`, `SliderSpec`) and refresh after every change, so a switch that needs another (Storms need Weather) never goes stale. One `SettingsApplier` pushes `settings` to the world, the view and the HUD; the screen only edits `settings`. New: the controller button names can be set (Auto, Xbox, PlayStation, Switch).
- **New voyage** is three level cards (the `card` component, built from `difficulty.json`) with Set sail as the one sage action; the pennant cards idea is dropped.
- Confirmations use the `Dialog` component with an ink-outlined danger button (`askDanger`), never the red static dialog.
- The old title, settings and New voyage markup, their CSS (about 650 lines of `menus.css`, the title block of `logo.css`) and `seaSwitches.ts`, `viewSwitches.ts` are gone. Style E stays in the theme `legacy` for the screens not rebuilt yet.
- The title plays a short fade in (the stack's `fade`). A sting on first show is not built: the sounds are synthesised and need a first touch before any sound can play, so it waits for a real sting from the sound design.

## Consequences

- `main.ts` shrinks by about 100 lines; every setting now has one place that applies it.
- A new setting is one row spec in a tab file and one line in the applier.
- The title no longer shows the live scene; the key art is a still. Replacing it with a real render is a file swap.
- Tests that clicked the old lessons line from the pause menu now go through Settings › Game.
