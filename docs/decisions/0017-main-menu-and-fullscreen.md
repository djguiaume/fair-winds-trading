# 0017. Main menu over the live scene, and fullscreen with iPhone fallback

**Status:** Accepted, 2026-10-19

**Context:** Phase 0 dropped the player straight into the sea with a help card. Guillaume asked for a main menu before play and an option to go fullscreen. The game must work with touch on an old tablet and a phone ([0006](0006-desktop-and-mobile.md)). Browsers differ on fullscreen: desktop browsers, Android and iPadOS Safari support the Fullscreen API (iPadOS before 16.4 only with the `webkit` prefix), but **iPhone Safari does not allow fullscreen for web pages at all**, only for videos. Pages launched from the iPhone home screen do fill the screen when they declare themselves web-app capable, which `index.html` already does.

**Decision:**

| Topic | Choice |
|---|---|
| Title screen | The game opens on a menu titled "The Fair Winds Trading Co." over the live 3D scene (the boat bobbing, wind streaks moving), with the simulation paused. No separate loading scene or extra assets. |
| Menu entries | **Set sail** (becomes **Resume** once a voyage has started), **How to play** (the existing help card), **Settings** (the existing panel: graphics quality and FPS; in-game-only actions are hidden from the menu), **Fullscreen** when available. |
| Getting back | A ☰ button in the in-game button row, or Esc on a keyboard, pauses and returns to the menu. The first voyage still shows the help card once. |
| Fullscreen | A **Fullscreen** entry in the menu and a ⛶ button in game toggle the Fullscreen API on the whole page (prefixed fallback for older iPads), with the label following the real state (also when the player leaves with Esc or the system gesture). |
| iPhone | No fullscreen button (it could never work). The menu shows a short hint: Share, then *Add to Home Screen*, and start from there. |
| Already fullscreen | When the game runs from the home screen (standalone display mode), neither the button nor the hint is shown. |
| Implementation | Plain DOM like the rest of the Phase 0 HUD ([0013](0013-phase-0-prototype-choices.md)); Preact still arrives with the trade panels in Phase 1. Fullscreen logic lives in `src/ui/fullscreen.ts`, with the choice of what to show (`classifySupport`) unit-tested. Big touch targets (52–60 px buttons), safe-area padding, and a two-column layout for phones in landscape. |

**Consequences:**

- The menu is the natural home for later entries: **Continue** / **New game** once saves exist (Phase 1, [0009](0009-sandbox-short-sessions.md)), and sound settings (Phase 7).
- Android "install" with a web app manifest (`display: fullscreen`) is not done yet; it needs PNG icons and is worth doing with the Phase 1 auto-save so the game feels like an app.
- Screenshots: [docs/screenshots](../screenshots/).
