# 0183. Play in the Xbox browser

**Status:** Accepted (2026-10-25); waiting on Guillaume's test on his Xbox. Texts per control
scheme widened by decision 0184.

## Context

Guillaume asked (2026-10-25) whether the game plays in the Xbox's browser. That browser is
Microsoft Edge (Chromium), which runs WebGL and three.js, and the game already reads Xbox pads at
sea and on the chart (decision 0162) and in menus and cards (decision 0163). Four things still
differ on a console on a TV:

1. Edge on Xbox drives a **mouse pointer** with the controller by default. A page asks for the
   pad itself with `navigator.gamepadInputEmulation = "gamepad"` (Microsoft's documented switch
   for Edge on Xbox); then the Gamepad API gets every button and B stops meaning Back. Nothing in
   the game set it.
2. In pointer mode, **B is the browser's Back**: one press left the game.
3. Many TVs **crop the picture's edges** (overscan). Microsoft's TV guidance keeps the UI inside
   the inner 90% (5% each side). The HUD sat 12–16 px from the edges.
4. No keyboard: anything that needs typing or a file is awkward.
5. Guillaume's first test on the live game (2026-10-25, Edge's controller mode on): the menus
   ignored the D-pad and A. Two causes in the poller (decision 0162): it waited for a
   `gamepadconnected` event, which a browser may never send for a pad that was already there;
   and any keydown or pointerdown dropped the pad's focus ring, while Edge on Xbox also turns
   pad buttons into keys (`GamepadA`, `GamepadDPadDown`…) or a pointer click. The pad then took
   over again, and its "first press only shows the focus" rule (0163) swallowed every press.

## Decision

- **TV mode** (`src/input/tv.ts`, `startTvMode()`, called first thing in `main.ts`): on when the
  user agent has a word from `controls.json` › `tv.userAgents` (`Xbox`); `?tv` forces it on any
  browser for testing, `?tv=0` turns it off. Off, nothing changes.
- In TV mode the game sets `navigator.gamepadInputEmulation` to `tv.gamepadInputEmulation`
  (`"gamepad"`), so the controller plays the game with the controls of 0162 and 0163.
- **Back stays in the game** (`tv.stayOnBack`): the game keeps one extra history entry and puts
  it back after Back takes it (added on a press, since browsers skip entries a page adds before
  the player touched it). No "Leave site?" question: the game reloads itself in places and the
  voyage autosaves.
- **TV safe margin** (`tv.safeMargin`, 0.05 of width and height): TV mode sets `--tv-safe-x/y`;
  `hud.css` defines `--safe-top/bottom/left/right` as the larger of the notch inset and the TV
  margin, and every UI stylesheet reads `--safe-*` instead of bare `env(safe-area-inset-*)` (the
  `env()` stays as fallback where `hud.css` is not loaded, such as the quest builder). The wide
  title menu panel grows by the margin. Phones and desktops get the same insets as before.
- **The poller** (`GamepadPoller`, every browser): looks for a pad once a second until one is
  seen, without waiting for `gamepadconnected`; ignores a keydown or pointerdown while a pad has a
  button down or a stick leaning (the pad's own key or click); takes pad buttons that arrive as
  keys (`KEY_BUTTONS`, Edge's `Gamepad*` key names) as pad presses when the Gamepad API does not
  report them, and stops the browser acting on them (GamepadB is its Back).
- **The tutorial bubble at sea and on the chart** (Guillaume: "how to click Continue or Skip?"):
  the pad steers there, so the bubble is not a menu; **A** presses its main button (Continue, the
  step's action, Sail freely) before it opens the harbour, **Y** skips the lesson
  (`sea.skipLesson`, `chart.skipLesson`). A and Y glyphs show on those buttons in pad mode.
- **Picking a port on the chart**: a cross in the middle of the chart in pad mode; **A** sets a
  course to the port within `chart.pickReachPx` of it (`chart.pick`), else presses the bubble.
- **Texts for the controller** (Guillaume: the tutorial named arrow keys): while the pad is the
  last input, `t('key')` reads `key@pad` when that text exists (`setTextVariant`, `src/i18n`). The
  first-voyage lessons that name controls have one (map, course, sails, Sell all), in English and
  French. The quest builder shows an optional "speech · controller" line under each step's
  speech, so any quest can say "press A".
- `controls.json` › `tv` is data (decision 0093); `tvProblems()` checks it.
- `npm run shots -- --sizes tv` shoots Edge on Xbox at 1080p (its user agent turns TV mode on).

## Second Xbox test (2026-10-25)

Guillaume, on the merged build: the D-pad, A and B worked only some of the time (the left stick
always), and New game used the browser's own box, which left fullscreen and the controller.

- **Every tap counts**: the buttons were read once per drawn frame, so a tap shorter than a frame
  (the Xbox draws about 30 frames a second) was sometimes missed; the stick, which is held, never
  was. `GamepadPoller.sample()` now reads the buttons every `gamepad.sampleEveryMs` (8 ms, data)
  between frames, and the presses it finds join the next frame's.
- **One press, not two**: Edge can send a pad button as a key a moment before the Gamepad API
  shows it. The key counted and then the API counted again, so the D-pad sometimes moved twice.
  Now a press the API reports within `KEY_ECHO_MS` (300 ms) of the same button's key is dropped,
  and once the API has reported a press, keys for pad buttons are ignored.
- **The ring stays**: a key or click from the pad (an arrow, Edge's click) arriving before the API
  shows the button dropped the pad focus, and the next press only showed the focus again. A key or
  click now waits `KEY_ECHO_MS` for the pad before the game decides the player left it.
- **A presses once**: in Edge's pointer mode, A is also a mouse click wherever the cursor is,
  which moved the focus or pressed another control. Once the API reports presses, real pointer
  events while a pad button is down or just released are stopped; the game's own `el.click()` is
  not affected.
- **No browser boxes**: New game asks in an in-game dialog (`src/ui/confirmDialog.ts`,
  `askConfirm`), which the pad's focus reaches and B answers no. The page still reloads for the
  new voyage, so fullscreen must be entered again after it (browsers end fullscreen on reload).
- A menu line that can't be picked now (the lessons while the first voyage runs) is greyed out.

## Consequences

- With the switch honoured, the Xbox pad plays the whole game; the screen's edges stay clear on
  an overscanning TV. If Edge ignores the switch, the pad still works as a pointer (A clicks) and
  Back no longer drops the game.
- Not done, wait for Guillaume's test: a bigger text size for the couch (1080p shows the desktop
  layout at desktop size; Edge's own zoom works meanwhile), and a no-typing way to move a voyage
  onto the Xbox (QR scanning needs a camera, a save file needs a file picker; the transfer link
  opened in Edge works).
- Performance: the quality level adapts by itself (`auto`, decision 0115); Series consoles are
  far above the old tablet, an Xbox One may settle on Medium.
- Tests: `tests/tv.test.ts` (data check, detection, `?tv`, the switch, margins, Back);
  `tests/gamepad.test.ts` (a pad no event announced, the pad's own key or click, `Gamepad*` keys).
