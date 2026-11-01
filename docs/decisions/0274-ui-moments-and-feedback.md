# 0274. UI moments and feedback

**Status:** Accepted (2026-11-01).

## Context

Wave 2 of v1.5 "A real game" (issue #442, [decision 0268](0268-a-real-game-rebuild-the-ui-as-one-system-v15.md)). The foundation ([0269](0269-ui-foundation-theme-as-data-components-screen-stack-and-moti.md)) gave the components, the motion system and a toast. Events still answered with unrelated boxes and silence: a race result was three boxes, a port had no welcome, a sale changed a number without a sound, and the title's sting was left out (0271).

## Decision

- **One `Moments` object** (`src/ui/moments/`), created once in `main.ts`, owns the arrival banner, the race's "Horn in 10" banner, the trade ticks and the toasts. The sea is checked four times a second; everything else is a timer or a CSS animation, so nothing allocates per frame while nothing plays.
- **Arrival banner:** the port name (IM Fell) and its tagline (`port.tagline.<id>`, storyteller texts, ports without one show the name alone), dropped in from the top centre for `arrivalMs`. It shows when the boat comes within `arrivalRadius` of the port's *harbour* (the course waypoint), never because she passes the island's shore; each port once, until she has sailed `arrivalRearm` away; never while docked or for the port she leaves. A banner due under a screen waits for the sea.
- **Trade ticks:** after a deal the gold and the hold count roll from their old to their new value (`NumberRolls`), the chips pulse, a coin sounds. The harbour screen redraws after each deal, so the ticks mark the deal and settle on the redraw.
- **Quest stamp:** a step done ("Step done") or a quest complete ("Complete") is stamped on its card and on the note at sea, with a thump; once per moment, never on an offer or a race.
- **Race:** the countdown banner from `countdownFrom` seconds, the start horn (unchanged), and a **finish board** in place of the three boxes: the medal and the place line ("First home. Well sailed.", second, retired: storyteller texts, places only), your time, Kestrel's, your best and the medal times. Places: first unless Kestrel crossed before you, second if she did (the race has two boats; the medal is shown beside, not worked out into a place). Giving up shows the retired line on the banner. The race's events moved to `moments/raceEvents.ts`.
- **Toast:** the one component now drops in at the top centre and stacks at most two; the rest wait in line. (The sea HUD still calls `hud.showToast`; moving it onto this toast is for the HUD part.)
- **Motion** is a setting (Display › Interface motion): Full, Reduced (everything appears at once: no slides, rolls or stamp press) or Off (also no arrival banner or stamp drawn). Until chosen it follows the device's "reduce motion". The stylesheets read `html[data-motion]`.
- **Dusk:** the paper cross-fades to the night paper over `duskFadeMs` (colour transitions on the paper-painted components, switched on only while it runs).
- **Sounds, all synthesised and data driven:** nine interface effects (`press`, `confirm`, `back`, `tab`, `error`, `coin`, `stamp`, `chime`, `sting` in `src/audio/uiSfx.ts`) with effects and nine `events` in `audio.json` (`press`, `confirm`, `back`, `tab`, `error`, `coin`, `stamp`, `arrival`, `sting`), editable on the Sounds page (Events) and playable with `npm run sound -- effect ui-<name>`. The components say what happened (`uiSound`): a primary button confirms, a plain one presses, a header exit goes back, a tab changes, a soft-disabled control errors.
- **Title sting:** a bell strike under a rising open chord, played when the title first shows, or at the first tap when sound is not unlocked yet (browsers allow no sound before one).
- **Numbers** (radius, durations, countdown, dusk fade) are `src/data/tuning/ui.json`, in the Tune panel and `npm run tune`.

## Consequences

- Every component press sounds; screens built on `onPress` get it for free. Legacy buttons (harbour, chart) stay silent until their parts rebuild them.
- The paper board and the stamp are paper chips, so they read on the legacy dark quest card until it is rebuilt.
- The countdown banner and the retired line share the HUD's top centre with the objective pill; the sea HUD part decides the slot (`--moment-top`).
- A sting at the first tap can overlap the start of a game if that tap is Continue; it is two seconds and quiet.
