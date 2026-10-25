# 0199. Controller on Xbox pointer mode, and pad buttons at sea

**Status:** Accepted (2026-10-25): Guillaume's Xbox test showed the focus still broken after 0192.

## Context

On his Xbox (live v0.4.216, with decisions 0192 and 0196), Guillaume could switch the port screen's
tabs (LB/RB) and the amount (LT/RT), but the D-pad and A did nothing, in the port and in the pause
menu; he had to use the mouse cursor. The sea's Trade button showed no A either.

Edge on Xbox keeps its pointer mode: a cursor moved by the stick, A clicks under it, the D-pad and A
come to the page as keys (`GamepadDPadDown`, `GamepadA`), while LB/RB/LT/RT reach the Gamepad API.
`navigator.gamepadInputEmulation` (decision 0183) is an old EdgeHTML setting and does not switch it
off. The poller (decision 0183) treated every pad key as an echo once the Gamepad API had reported
any press: after the first LB or LT, every D-pad and A key was thrown away.

## Decision

- **Echoes per button.** A key for a pad button is the Gamepad API's echo only when the API shows
  that same button down now or within `KEY_ECHO_MS` (`apiAt` per button), not after any press.
- **On a TV the pad is the only input** (TV mode, decision 0183): the arrows and Enter count as the
  D-pad and A (`TV_KEY_BUTTONS`), the poller is "using the pad" from the start (focus ring, hints
  and pad texts up at once, no "first press only shows the focus"), a click or key never switches
  it away, and the cursor's click that comes with A's key is stopped.
- **A screen gets its focus even in a frame with no pad report** (`padFocus.frame(null, …)`).
- **Pad buttons on the sea's buttons**, from `controls.json` › `gamepad.sea`, only while the pad is
  in use: A on the pier sign's Trade, View on Map, Menu on the menu button, RB/LB beside the sail
  lever's Full / Down. The sea buttons never show the focus ring (the pad does not move there).

## Consequences

- With the Xbox in pointer mode the D-pad, stick keys and A drive every menu, card and the port.
- Real keyboards outside TV mode are unchanged (arrows still steer, Tab still moves).
- Screenshots: `docs/reviews/xbox-pointer-mode/`.
