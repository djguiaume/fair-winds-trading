# 0196. Sea chart tabs

**Status:** Accepted (2026-10-25).

## Context

On his Xbox, Guillaume found the sea chart hard to use with a controller. The cross slid under
the buttons and the journal. The journal could not be read. With the journal open, it hid the
goods along the side that show each port's price. He asked how console games do it. They use
one screen per page, switched with the bumpers (LB/RB). He also set two rules: "Menu style and
navigation must be consistent in the whole game", and there should be one layout, not one per
device ("Why have 2 different layouts?").

Mockups in the real game: `docs/mockups/chart-tabs/` (map, journal, prices).

## Decision

- The chart wears the **port screen's header and tab bar** (decision 0049) on every device:
  title, course chip, the red close button, then **Map · Journal · Prices · Legend**. The markup
  reuses the port's classes (`port-screen`, `trade-header`, `tab-btn`), so the look stays the
  same in both places. The side panels and their toggles, and the "All prices" button, are gone.
- **Map** shows the sea alone, with the goods column (each port's price for the picked good),
  the compass and the zoom buttons. **Journal**, **Prices** and **Legend** each fill the screen
  below the tabs. The Prices page has its own goods row. A port picked there sets the course and
  goes back to the Map tab with the course drawn.
- **Controller** (`controls.json` › `gamepad.chart`):
  - On the map: LB/RB switch tabs (`tabPrev`, `tabNext`), X steps through the goods and then
    names only (`nextGood`), LT/RT zoom, a right-stick click shows the whole map (`fit`), and A
    picks the port under the cross.
  - The cross stays inside the clear water, beside the goods column and the compass
    (`SeaChart.crossField`). The zoom buttons hide in pad mode.
  - On the pages, the pad works as in the port screen (`padFocus`): the D-pad or stick moves,
    A chooses, LB/RB switch tabs, and B closes the chart.
- Back (Esc or B) closes the chart from any tab, as the port screen does.

## Consequences

- One chart layout to test. Mouse and touch click the tabs; seeing the journal and the map at
  the same time is lost, which Guillaume accepted.
- The pages scroll with the right stick once the port-screen controller work adds it to
  `padFocus`, which every screen shares.
- `npm run shots -- --chart --chart-panel journal|market|legend` opens that tab.
- Tests: `tests/sea-chart.test.ts` (tabs, the prices goods row, a port picked from the
  prices, LB/RB skip a hidden journal, X steps through the goods).
