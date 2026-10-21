# 0061. Menus, settings and tutorial coach marks in style D

**Status:** Implementation for review, 2026-10-20 (Guillaume approved the [mockups](../ui-refactor/menus/README.md): "Yes, build it").

**Context:** The last step of the UI redesign ([0049](0049-ui-instrument-style.md)). After the Sea HUD, Port screen and chart, the title menu, settings, How to play, the tutorial offer, the sailing-upwind tips and the tutorial hints still had the old look. The tutorial was one big card injected into the sea, chart and port; on the chart it covered the goods buttons, and How to play did not fit a phone in landscape. The [analysis](../ui-refactor/README.md) recommended coach marks: a pointer on the element to tap and one line of text.

**Decision:**

- **Title menu:** a navy side panel on the left, so the sea and the boat stay visible: compass-rose emblem and title, a big brass **Set sail**, three rows (Learn to sail & trade with "9 short steps", How to play, Settings) and a footer with the fullscreen icon, EN/FR and the version. In portrait the title sits over the sea and the buttons go into a bottom sheet.
- **Pause** is the same menu: **Resume** with a play icon, a *Paused* tag with gold and cargo, and "Continue tutorial · Step n/9". The sea HUD stays visible, dimmed, behind it; on the title screen it is hidden.
- **Settings** is full screen like the port: Display (graphics as Auto / Low / Medium / High tabs with what is in use, speed log and FPS as switches; the speed log switch and the eye on the log stay in sync), Sound · Language (music slider with %, language by name) and Voyage (Back to start in game only, with a note; New game in red). **Shift the wind 45° only appears with `?debug`**: it is a testing aid, not a player setting.
- **How to play** is three picture cards (wind with the red no-go zone and green fast band, tacking zigzag, buy here and sell there) and one controls line. It fits one phone screen; touch devices without a mouse skip the keyboard keys.
- **Dialogs** (tutorial offer, sailing upwind) use the same navy panel, brass line and chunky buttons. The offer is short and shows the five themes (chart, sails, wind, dock, deliver) as chips.
- **Coach marks replace the tutorial card.** One small bubble with nine progress dots, the step title, one or two lines, Hide and Skip, plus a brass ring with a soft pulse around the element to tap: Map button, a harbour on the chart (the nearest one for the first trip, a buyer for the delivery), sail lever, compass, port sign, Buy or Sell button. The bubble sits beside the ring with an arrow, flipping side to stay on screen. The ring replaces the bubble's own "Open map" button; when the target is not on screen the bubble is unpinned and keeps the button. Lesson texts were shortened to fit.
- Styles live in `src/ui/menus.css` (after the other screens); the icon sprite moved out of `#hud` so menus can use it too. Old menu, settings, help and tutorial rules were removed from `hud.css`.

**Consequences:**

- The tutorial logic is unchanged (it still only observes real actions); `Tutorial` gained `pointerPort` and `pointerGood` so the UI knows what to point at. `TutorialCoach` (was `TutorialCard`) keeps the same hosts and button ids.
- The bubble follows moving targets (port signs, chart zoom) by measuring about ten times a second, writing to the DOM only when the target moves: no timers or animation loop of its own, within the old-tablet budget ([0006](0006-desktop-and-mobile.md)). The ring's pulse is CSS only and stops with reduced motion.
- Kids mode stays hidden ([0043](0043-shelve-kids-mode.md)); its market markup has no Buy/Sell selectors for the coach, so there the bubble shows unpinned.
- Screenshots: [ui-refactor/menus](../ui-refactor/menus/README.md), made with `docs/ui-refactor/menus/capture.cjs`.
