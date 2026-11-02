# 0279. Remaining v1.5 screens on the components, old menu styles removed

**Status:** Proposed (2026-11-02).

## Context

Issue #445 (wave 4). After waves 1 to 3 the title, settings, harbour, chart and sea HUD were on the
components (decision 0269), but help, voyage transfer, the confirm and tutorial dialogs, the quest
card and note, the club board, Free Sailing and the coach marks still read style E (dark teal,
Barlow, `d-btn`), from `menus.css` and `quests.css`. The quest card also covered the quest line
and most of a phone in landscape.

## Decision

- Help, transfer, the wind tips, the tutorial offer and every confirm are built in code from the
  components (`screens/help.ts`, `transferView.ts`, `tutorialOffer.ts`, `hud/windHelp.ts`,
  `screens/confirm.ts`); their static markup is gone from `index.html`.
- `menus.css`, `quests.css` and `club.css` are replaced by token-only files: `pad.css` (pad ring,
  hints, glyphs), `tutorialCoach.css`, `quests/card.css`, `race.css`, `note.css`.
- The quest card is a torn paper panel whose height stops short of the quest line; on a phone in
  landscape the harbour header is dropped and the body scrolls inside.
- The sea's news uses the one Toaster (top centre, two at most) instead of its own line.
- The hazards settings sit under the Game tab, so no page is left mostly empty.
- Free Sailing uses the components' buttons and cards.
- `npm run tune` edits tuning numbers (`hud.json` and the rest) within the `?tune` ranges, sharing
  `src/tune/tuningDoc.ts` (decision 0153).

## Consequences

Every screen of the inventory reads one identity. The legacy theme roles and the older CSS
(`hud.css`, `home.css`, `theme.css`, `phone-landscape.css`) are removed in the release PR, which
flips this and decisions 0268 and 0273 to Accepted.
