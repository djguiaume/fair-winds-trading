# 0268. A real game: rebuild the UI as one system (v1.5)

**Status:** Proposed (2026-11-01). Becomes Accepted when Guillaume OKs the [v1.5 brief](../v1.5/brief.md) and the identity mockup is chosen.

## Context

After the style E reskin ([0220](0220-a-game-like-ui-skin-style-e.md), v1.1) Guillaume still finds the UI too basic, without cohesion or identity, cluttered at sea and not good enough for a game (2026-11-01). The [UI review](../reviews/ui/review.md) and the [UI inventory](../reviews/ui/inventory.md) agree on the cause: the reskin changed the paint on web-page layouts (forms, tables, tab bars), and nothing is shared underneath. Tokens cover colour and type only; there are two button families, four tab styles and six card styles; screens are `hidden` toggles wired by hand in `main.ts`; motion is five keyframes; the theme is not data and has no editor or CLI (against [0153](0153-every-authoring-feature-has-an-agent-cli.md)). The references Guillaume named (Sea of Thieves, Skull and Bones, Seafarer, Forza Horizon, Zombie Assault Resurgence) share what we lack: one hero per screen, one signature, big type, feedback on every event, and a HUD that gets out of the way.

## Decision

Not a third skin. v1.5 "A real game" rebuilds the UI as one system, in waves, with the identity decided first:

1. **Identity before build.** Three static mockup directions (the chart table, the sailing club, the painted harbour), each a full identity (logo, signature colour, type, motif, materials) on the same four screens. Guillaume picks one with the art director; the art bible's UI line is rewritten to it. No blue or teal with gold; no lines on paper.
2. **One foundation.** Tokens for colour, type, space, radius, elevation, motion and z-index live in `src/data/ui/theme.json` and are editable in the editors and with `npm run theme`. One component set (button, tab bar, card, panel, list row, dialog, toast, screen header) in TypeScript, one screen stack with transitions, the pad focus and glyph system kept.
3. **One hero per screen.** Title screen as a staged scene, pause as a small card, settings in tabs, the harbour screen over the live port with the market as cards or a ledger, the chart as a paper chart with book tabs, the sea HUD as three clusters with a quiet mode and idle fade. Sailing numbers stay visible by default.
4. **Feedback everywhere.** Arrival banners, trade ticks, quest stamps, race horn and board, UI sounds, all through one motion system that honours reduced motion and costs nothing per frame when idle.
5. **Phone landscape only.** Portrait layouts are no longer required (Guillaume, 2026-11-01); desktop and phone landscape are the two sizes checked.

## Consequences

- Every screen is rebuilt over four waves (brief), so v1.5 is a long release; it may run alongside v1.6 "The far seas' story", which touches only quest data and text (numbers swapped by Guillaume, 2026-11-01).
- Old per-screen CSS families are removed as screens move over; no screen keeps its own button or tab style.
- The theme becomes authoring data with an editor page and a CLI, like every other authoring feature.
- Visual parts wait for Guillaume's `visual-ok`; the identity mockups are the gate for everything after wave 1.
- Portrait screenshots are dropped from the tools' defaults; the `shots` default sizes become desktop and phone landscape.
