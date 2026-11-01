# 0276. Harbour screens on the v1.5 paper

**Status:** Accepted (2026-11-01).

## Context

v1.5 "A real game" (decision 0268, tracker #446) rebuilds the UI on one set of components and theme tokens (0269). Issue #443 is the harbour: Market, Orders, Quay, Shipyard, Boat looks and the home island. Guillaume picked round 3 D of the kit (`docs/ui-refactor/v1.5/`): the port as a picture strip above one paper ledger about 90% wide, and for the Shipyard round 3 C, the paper beside the live boat with a reserved 3D preview area. The old trade panel (`tradePanel.ts`, 700+ lines of markup strings) and its CSS (`port-screen.css`, the trade half of `hud.css`) were the last big screen on the old Style E.

## Decision

- **One harbour, built from the components.** `src/ui/harbour/` holds the parts: the header (port name, its line, tabs with badges, gold and hold, close), the footer (a face plate, the status line, the pad legend, Set sail as the one sage action), the goods ledger and its detail pane, the orders ledger, the Quay (people list and the quest card with a big portrait), the Shipyard (three upgrade cards, the fleet table, the reserved preview), the plots and the warehouse. `tradePanel.ts` and `homePanel.ts` only wire them. The home island uses the same header, ledger and footer.
- **Sizes in data.** Row height, the big buttons, the strip, side margins, pane widths, portrait sizes and the Boat looks pages are a new `harbour` group in `src/data/ui/theme.json` (`--ui-harbour-*`), edited on the editors' Theme page and with `npm run theme`.
- **A price line without a save change.** "Last days" is a small in-memory log (`src/sim/priceLog.ts`): each market's buy price at every game day's end, `ui.priceLogDays` days kept (tuning). It is not saved: after a reload the line starts again from today's price.
- **The scene stays the scene.** The harbour overlay is clear over the 3D port; the sea HUD hides while it is up (`html[data-screen='harbour'|'home']`). On the Shipyard tab the camera puts the boat right of the paper (`ui.yardBoatShift`); a chosen home plot now sits right of the paper too, as the Shipyard's boat does. Boat looks keeps its own turntable, now between two torn paper pages; the Free Sailing setup shares that frame.
- **The pad.** Focus runs the left list, then the right pane; LB and RB change tabs; A buys or chooses, X sells (the Sell button is `data-pad="secondary"`), LT and RT change the lot, B closes. The legend sits in the footer while a pad is in use; the floating hints pill is off on this screen (`data-pad-hints="off"`), so nothing competes with Set sail (#433). Y is not mapped to Set sail: the pad never starts on it, on purpose.
- **Kids mode** (shelved, `KIDS_MODE_AVAILABLE = false`) uses the same screens with its own words; its orders moved to the Orders tab like the captain's.

## Consequences

- `tradePanel.ts` is under 400 lines; every harbour file is small and tested (`trade-panel`, `contracts`, `quest-quay`, `harbour-header`, `tutorial-ui`, `price-log`, `home-panel`, `boatLooks`).
- The old trade rules are gone from `hud.css`, `port-screen.css` and `theme.css`. `port-screen.css` stays only for the chart's header and tabs, which still wear the old frame until the chart's own rebuild.
- The 3D preview area on the Shipyard is reserved and empty (dashed, labelled) until a model viewer is built.
- A save made before the change opens the same harbour; nothing in the save moved.
