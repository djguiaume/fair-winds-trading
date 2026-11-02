# 0280. Port screen: island banner over a full opaque ledger

**Status:** Proposed (2026-11-02), part of v1.5 (#464). Amends 0276 for the port screen.

## Context

The v1.5 harbour (0276, #443) looked right in the round 3 D mockups but not in game (Guillaume, 2026-11-02): the ledger sat low with the live scene above and around it, the moored boat ghosted through the paper, the Shipyard tab changed the whole layout (a tall column beside the live boat), and in Free Sailing the Shipyard did nothing (no gold). He asked for a picture of the docked island in the game's style as a header, with the paper taking most of the room below.

## Decision

- **Banner.** The port's picture (0211) is a banner across the top (`theme.json` › `harbour.banner`, at least 24% of the height, growing with whatever room the paper leaves; `banner-phone` on a phone) with the port's name, line, gold, hold and close on it in paper with the HUD's ink halo over an ink wash, 55% at the top fading out. The picture is rendered at the banner's shape (`harbour-view.json` › `picture`, 1920 × 340, a closer 13° lens so the island fills it); on a fresh page the screen retries until the port is built and **graded** like the title's key art (`grade`: the numbers of `grade_cover.py`, in `src/render/pictureGrade.ts`; the warm light mostly off at night). An island file's `harbourView.art` (a file under `public/`, island builder and `npm run island -- <id> view --art`) replaces the render with painted art when there is some; none ships yet.
- **Opaque screen.** The port screen stands on the ink colour: nothing of the scene shows. The paper sits under the banner at the same size on every tab (`harbour.sheet` tall at most, less on a small screen), its tabs on top; ledger rows are 72 px with larger names, and long French lines wrap instead of being cut. Long pages (the Shipyard, a phone's panes) scroll with a fade at the foot. At night the whole sheet, torn edge too, is the ledger's night paper. Her own island's screen keeps the clear overlay over its plots.
- **One Shipyard layout.** The Shipyard is the same ledger (round 3 D): three upgrade cards side by side over the fleet table, the reserved preview as a fixed box (`harbour.preview`) on the right with the ship's Buy and Boat looks. The camera no longer moves for it (`ui.yardBoatShift` and `harbour/camera.ts` removed).
- **Free Sailing's Shipyard** refits her for free while docked, like the setup: every ship in the table, each upgrade's levels 1 to 3 (`refitFree`); the setup screen follows what was chosen.

## Consequences

The 3D scene still renders under the opaque screen; pausing it while the harbour is up is a possible later saving. Painted per-port art (Guillaume's or a paid run, with a cost estimate first) drops in as data without code. Sheets: project files `harbour-464/`.
