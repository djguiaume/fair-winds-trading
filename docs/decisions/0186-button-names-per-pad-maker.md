# 0186. Button names per pad maker

**Status:** Accepted (2026-10-25, Guillaume OK).

## Context

The game names pad buttons in glyphs (A on the tutorial bubble, X on Sell all, LB/RB at the
tab bars, the A/B hint pill), in How to play, in the "Controller ready" toast, and in the
controller texts of decision 0184. All of them said Xbox names. The browser's standard layout
numbers buttons by place, so the same bottom face button is "A" on an Xbox pad, "✕" on a
PlayStation pad and "B" on a Switch pad. Guillaume agreed (2026-10-25): keep the speech versions
per way of playing (0184), and name the buttons after the pad in use instead of writing texts per
platform. Everything stays data driven.

## Decision

- **Data**: `controls.json` › `padBrands`. Each brand has `match` words looked for in the pad's
  id (its name and USB vendor, `054c` Sony, `057e` Nintendo), `names` per standard button, and
  optional `lang` overrides (`fr`: the Xbox View button is "Affichage"). The first brand (`xbox`)
  is the default. `brandProblems()` checks it.
- **Detection**: `padBrand(id)` in `src/input/gamepad.ts`. `GamepadPoller.brand` holds it,
  updated when a pad is seen or the pad changes, and `onBrand` reports a change.
- **On screen** (`src/ui/padGlyphs.ts`): `padGlyph(button, kind)` builds a glyph with the name
  for the pad in use (`data-pad-key`); `padName(button)` gives the name alone; `usePadBrand(brand)`
  renames every `[data-pad-key]` on the page and sets the names texts use. Static glyphs in
  `index.html` carry `data-pad-key`.
- **Texts**: a text writes `{pad:a}`, `{pad:lb}`… and `t()` fills in the name. The controller
  versions of the lessons (0184) and the "Controller ready" toast use these, in both languages.
- Other threads use the same helpers: the quest-card button glyphs (prologue thread) call
  `padGlyph()` with the button from `controls.json` › `menu.actions`.

## Consequences

- A PlayStation or Switch player reads their own button names everywhere, with no change to any
  quest text; a new brand or a renamed button is a data edit.
- Glyph colours stay the Xbox ones (green A, red B…) for every brand for now; `html[data-pad-brand]`
  is set so a brand's look can be styled later.
- Not in an editor yet: `controls.json` (button mapping, brands, TV mode) gets a controls editor
  in a follow-up, with `npm run check` covering it.
- Tests: `tests/wayOfPlaying.test.ts` (brand detection, data check, `{pad:x}` in a text).
