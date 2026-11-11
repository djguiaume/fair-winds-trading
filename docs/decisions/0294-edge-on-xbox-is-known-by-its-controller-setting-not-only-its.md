# 0294. Edge on Xbox is known by its controller setting, not only its user agent

**Status:** Proposed (2026-11-07).

## Context

Guillaume (issue #494): the controller does nothing anymore in Edge on the Xbox. No change since
v1.7 touched the controller code, and a desktop browser with a fake Xbox pad still drives every
menu. TV mode (decision 0183) started only when the user agent says "Xbox". Without TV mode the
game never sets `navigator.gamepadInputEmulation = "gamepad"`, so Edge keeps the D-pad and A for
its own pointer (decision 0199) and the game sees almost nothing. Edge can leave "Xbox" out of its
user agent (a reduced or desktop-site user agent).

## Decision

TV mode also starts when `navigator` has `gamepadInputEmulation`, which only Edge on Xbox has.
`?tv` and `?tv=0` still win. `?padlog` starts with one line: TV mode on or off, what Edge does with
the pad, and the user agent's platform part, so a photo shows how the game saw the console.

## Consequences

- The controller reaches the game on Xbox whatever its user agent says.
- If a desktop browser ever adds the property, it gets TV mode (pad as the input, safe margins);
  `?tv=0` turns it off.
- If the controller still does nothing, the `?padlog` photo's first line says why.
