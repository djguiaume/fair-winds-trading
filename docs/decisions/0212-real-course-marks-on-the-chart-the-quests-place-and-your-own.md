# 0212. Real course marks on the chart: the quest's place and your own mark

**Status:** Accepted (2026-10-25). Look agreed with the art director, words with the head
storyteller; Guillaume saw the screenshots and said to merge.

## Context

A playtester (Xbox, French) accepted Ada's "A light on the Teeth" and opened the chart. The step's
place, Teeth Rock, showed only as a faint dashed line from the boat and a tiny ring: it could not
be picked, so the player's course stayed on Stonehaven, and at sea the arrow followed Stonehaven
rather than the quest. The chart could only set a course to a port ([0058](0058-chart-style-d-port-cards.md)
removed personal markers), so a spot at sea could never be the course, and players could not put a
marker where they wanted.

Guillaume's next round of photos found four more chart and HUD bugs, fixed here too:

- "Skerry · votre île" stayed on screen near Teeth Rock: the home island bar's `display: flex` beat
  its `hidden` attribute, so after the first mooring at Skerry the bar never went away.
- The chart forgot the zoom the player had set and always opened on the whole sea.
- It should open on the boat.
- On a TV (Xbox Edge, 1080p) the goods column, centred on the whole screen, ran up over the tabs.

## Decision

- **A course is a port, the quest's place or her own mark.** `world.destination` gains a `kind`
  (`quest` or `mark`; unset is a port). Every course gets the same brass dashed line, the course chip
  ("Vers Teeth Rock · 220 m") with its ✕, and the sea's objective panel and edge arrow.
- **The quest's place is a real marker.** When the tracked step leads to a spot at sea, the chart
  draws a brass flag on a post with a "!" pennant (HUD brass `#e8c46a`, navy outline so it reads on
  the fog of war), labelled with the step's ask. Tapping it, clicking it or pressing A on it sets the
  course. The course follows the quest to its next place and ends with it. It is named by the
  island the spot lies by (`placeBy`, within 25 units), else by the step's ask; that island's own
  chart name gives way to the flag's label. With no course set the faint quest route still shows
  (the sea's arrow follows the quest then); with a course, only the one brass line shows.
- **Her own mark.** Tapping or clicking open water drops one mark there (a navy post with a cream
  `#f4ede0` flag; no buoy shape, which sailors would read as a navigation mark, and none of the red,
  amber or yellow already taken). A controller's A drops it under the cross when no port or flag is
  in reach and the lesson bubble does not take the press. Tapping the mark, or the chip's ✕,
  removes it. Sailing within `seamanship.harbour.markReach` (14 units, tuning data) clears it with
  "Repère atteint". One mark only, as 0058 asked for no clutter.
- **At sea**, a course to the quest's place or her mark shows a small floating spar (navy float,
  2-unit pole, brass or cream pennant), drawn 1.8× so it reads at the sailing camera, with a lamp on
  top that lights like the town windows at night (art bible rule 6). No glow by day.
- **Words** (storyteller): "Votre repère / Your mark", "Repère atteint / Mark reached", "Repère
  retiré / Mark removed"; the chart's instructions in touch, keys and pad variants (decision 0184).
- **The chart keeps her zoom** (in memory and in this browser, `fwt.chart.zoom`) and opens on her
  boat, as near the middle as the sea's edge allows; while she has not panned, zooming in keeps
  making for the boat.
- **The goods column** in landscape is centred on the map under the header and tabs (the chart sets
  `--chart-top`), and a long list runs on into a second column instead of over the tabs.
- **The home island bar**: the same `.home-bar[hidden] { display: none }` fix reached main with
  Skerry's Island tab ([0210](0210-skerrys-build-choice-staked-plots-and-the-island-tab.md)), so
  this branch takes main's version.
- `npm run shots`: with `--chart`, `--click` now acts on the open chart (its flags), like `--pad`;
  `--port` with `--chart` leaves the port screen first.

## Consequences

- Personal markers return in a smaller form than 0024/0057: one mark, which is a course.
- A quest step whose place is a port keeps the port's own badge and ring; only spots at sea get a flag.
- A mark can be dropped on land; it is just never reached. Left as is for now.
- Screenshots: `docs/reviews/chart-course-marks/`.
