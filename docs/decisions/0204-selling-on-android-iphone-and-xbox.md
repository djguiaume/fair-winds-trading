# 0204. Selling on Android, iPhone and Xbox

- Status: Proposed, parked (Guillaume 2026-10-25: "We are not doing it now")
- Date: 2026-10-25

## Context

Guillaume asked (2026-10-25) what it would take to port and sell the game on Android, iPhone and
Xbox. He has no Mac, and says getting approved is not a big issue. The game is a three.js +
TypeScript + Vite web build (0005), installable (0039), offline, about 3.2 MB, with touch, desktop
and full controller support (0162, 0163, 0183) and a TV mode for the Xbox browser (0183). Saves go
through one `SaveStorage` door in `src/sim/save.ts`.

The full research, costs and timeline are in [docs/stores/porting-plan.md](../stores/porting-plan.md).

## Decision (proposed)

- **Phones first, with one shell:** wrap the same web build in **Capacitor** for Android and iOS.
  No second codebase; the Pages build stays as it is, an app build target sits beside it.
- **No Mac:** iOS builds, signing and TestFlight uploads run on **GitHub Actions macOS runners**
  (free while the repo is public), with Codemagic's free tier as the fallback.
- **Native saves** behind the existing `SaveStorage` (Capacitor Preferences), save on app pause,
  copy a browser save across on first launch. No cloud saves in version 1; the FW2 code (0118)
  keeps moving voyages between devices.
- **Xbox waits on Microsoft:** the only way to run the web build on the console is a UWP app with
  WebView2 (the GDK has no web view). Ask ID@Xbox in writing whether such a game can still ship,
  test on Guillaume's own Xbox in Developer Mode meanwhile, and decide then. A native GDK rewrite is
  not planned. The Xbox browser keeps working (0183).
- **Payment through the stores only**, paid up front: €4.99 / $4.99 on the phones. The web build
  becomes a free demo that ends where the four Phase 4 seas open (after `watchman-passage`, 0194),
  and the repo goes private before charging.
- **No spending without Guillaume's yes**: the known fees are $25 (Google, once) and $99 a year
  (Apple); everything else has a free option.

## Consequences

- About a week of shared work (app build, native saves, lifecycle, Android Back, privacy page,
  store texts and screenshots), then about a week per phone platform; Android needs a 14-day closed
  test with 12 testers, so both phones could be live about a month after a go-ahead.
- Store cuts of 15% on phones (small-business rates); the Xbox console cut is probably 30%.
- Guillaume has to sign up to the stores himself (ID checks), register to sell in France
  (micro-entrepreneur), and accept that EU store pages show a trader address.
- The public repo has no licence; one should be added before selling.
- Becomes Accepted (or is changed) when Guillaume answers the open questions in the plan.
