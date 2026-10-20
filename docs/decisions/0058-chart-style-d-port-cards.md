# 0058. Style D chart with port price cards, one Trade button and a clearer hull icon

**Status:** Implemented for review, 2026-10-20. Guillaume agreed the look, asked for markers to move to later and asked for the always-visible goods comparison to be tried ("must be tried but not sure").

## Context

[0057](0057-fullscreen-readable-sea-chart.md) made the chart full screen with zoom/pan, a static
wind compass, separate legend/prices/marker sheets and the brown signature boat. It still used the
old parchment look rather than the navy and brass instruments of [0049](0049-ui-instrument-style.md).
Guillaume's review of the redesign: the hull damage icon looked odd, two "Trade" buttons showed at
once when docked, the selected port was hard to read on the chart, and the five-marker tool was
"unusable and not really necessary". The wind is already shown by the compass arrow, so a wind
text line adds nothing.

## Decision

- **Style D chart.** Teal sea, sand islands with an ink outline, navy header and footer bars with
  chunky buttons, red close button, brass active states. The compass, zoom and the signature boat
  from 0057 stay. No wind text chip: wind is read from the compass only.
- **Port cards.** Each charted port is a small navy card on a stem at its pier: the port name and,
  for the good picked in the footer, its buy price, or its sell price when the port does not stock
  it. The cheapest buy and the best sell are green ("cheapest" / "pays most"). Cards stay inside the
  map and move up if the boat would sit under them. Tapping a card sets the course.
- **Goods comparison always visible (experiment).** The footer always shows the goods chips, so
  picking a good recolours every card. Guillaume is not sure this is better than a closed sheet;
  it ships to be tried in play and can be reverted to a sheet.
- **All prices** stays a sheet: one table per good with every port's buy/sell and notes.
- **Course.** The selected card gets a brass outline and a dashed brass course line from the boat;
  a header chip reads "Course to Port Calda · 640 m". "Clear course" replaces "Clear target".
- **Markers moved to later.** Personal markers (0024, 0057) are removed. Stored pins under
  `fwt.chart.v1.<map>` are deleted on load. Revisit when play-tests show a need.
- **One Trade button.** When docked, the port sign's Trade button is the only one; the bottom
  Trade button appears only when the sign is off screen.
- **Hull icon.** The hull damage icon is a side-view hull with a crack, no mast or flag, so it no
  longer reads as a crate or a boat toy.

## Consequences

- The markers parts of 0024 and 0057 are superseded. The tutorial's chart lessons now talk about
  port cards; tutorial tests select ports through the price table buttons.
- The card compare is the main price tool on the chart; if play-tests reject it, fall back to the
  closed "All prices" sheet and plain port names without changing the rest.
- Screenshots: [ui-refactor/chart/style-d](../ui-refactor/chart/style-d/README.md).
