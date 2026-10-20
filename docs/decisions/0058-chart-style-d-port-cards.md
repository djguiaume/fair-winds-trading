# 0058. A clear style D chart, one Trade button, a clearer hull icon and a wider portrait view

**Status:** Implemented for review, 2026-10-20. Guillaume agreed the style D look, asked for markers to move to later and for the goods comparison to be tried ("must be tried but not sure"). After the first version (navy port cards) he asked for "a clear, no clutter, player friendly, easy to read map" with island names on no background, green land, a boat that does not look like a shield and a less zoomed-in portrait view.

## Context

[0057](0057-fullscreen-readable-sea-chart.md) made the chart full screen with zoom/pan, a static
wind compass, separate legend/prices/marker sheets and the brown signature boat, in the old look
rather than the navy and brass instruments of [0049](0049-ui-instrument-style.md). Guillaume's
review of the redesign: the hull damage icon looked odd, two "Trade" buttons showed at once when
docked, the selected port was hard to read, and the five-marker tool was "unusable and not really
necessary". Wind is already shown by the compass arrow, so a wind text line adds nothing. The
first style D chart put each port in a navy card; that covered islands and crowded the map. The
study of what cluttered it, with before and after captures, is in
[ui-refactor/chart/clarity](../ui-refactor/chart/clarity/README.md).

## Decision

- **The map fills the screen.** No title or footer bar; controls float where the round sea leaves
  room (goods down the left side, along the bottom in portrait; close, legend and compass top
  right; zoom bottom right; course chip top left). Wind is read from the compass only.
- **Clear hierarchy, no boxes.** Ports get an anchor badge on the pier and a bold white name with a
  thin dark halo, placed on the clearest side of the island away from other labels, badges and the
  boat. Island and yard names are small light italics and are left out where they would collide.
  Land is green grass with a sand shore, like the 3D islands; reefs are soft red patches.
- **Prices on demand (the comparison experiment).** An empty hold shows names only. Tapping a good
  shows its price under every port ("buy 5" where stocked, else "sell 17"), green for the best
  deal; tapping it again hides them. With cargo aboard the chart opens on that good. "All prices"
  keeps the full table. If play-tests reject the on-map prices, keep only the table.
- **Course.** The chosen port's badge and name turn brass, a dashed brass line runs from the boat,
  and a chip reads "To Port Calda · 350 m" with a ✕ that clears it.
- **Boat icon.** Top-down hull with a pointed bow, square stern and white sail, in a light-blue
  ring, about 38 px long at every zoom.
- **Markers moved to later.** Personal markers (0024, 0057) are removed. Stored pins under
  `fwt.chart.v1.<map>` are deleted on load. Revisit when play-tests show a need.
- **One Trade button.** When docked, the port sign's Trade button is the only one; the bottom
  Trade button appears only when the sign is off screen.
- **Hull icon.** The hull damage icon is a side-view hull with a crack, no mast or flag.
- **Portrait sailing view.** The 3D camera pulls back in portrait (up to 1.9× the distance) so a
  tall phone sees about as much sea across as a landscape tablet.

## Consequences

- The markers parts of 0024 and 0057 are superseded. The tutorial's chart lessons talk about tapping
  ports; tutorial tests select ports through the price table buttons.
- Label placement is a small greedy pass (four sides per island, scored by overlap). If later maps
  get denser, lower-priority names drop first.
- Portrait shows more sea, so the boat is smaller on tall phones; pinch zoom still applies on top.
- Screenshots: [ui-refactor/chart/clarity](../ui-refactor/chart/clarity/README.md).
