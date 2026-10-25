# 0203. Pad focus ring without the browser's focus

- Status: Accepted
- Date: 2026-10-25

## Context

On the Xbox, Guillaume found the pause menu "has no focus": nothing looked selected. His
`?padlog` photo (decision 0201) showed the focus did move (`pad down → focus #menu-tutorial`,
`pad up → focus #menu-play`…), every press came through the Gamepad API, and no key event reached
the page at all. Edge's pointer mode had left the page without the browser's own focus, and CSS
`:focus` only matches in a focused document, so the ring (decision 0163) never showed.

## Decision

`PadFocus` marks the control the pad is on with `data-pad-focus`, whenever it focuses one and on
every frame it settles a screen (so focus that other code moves, such as the pause menu's own
`focus()` on Resume, is marked too); the mark is removed when the focus moves on or the screen
closes. The ring's CSS matches `:is(:focus, [data-pad-focus])`.

## Consequences

- The ring shows on the Xbox whether or not Edge gives the page the browser's focus.
- A press (A) already clicks `document.activeElement`, which `focus()` sets even in an unfocused
  page, so only the ring needed the mark.
