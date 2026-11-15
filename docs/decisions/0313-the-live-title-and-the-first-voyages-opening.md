# 0313. The live title and the first voyage's opening

**Status:** Accepted (2026-11-15). Issues #531 and #533; art bible §13.

## Context

The title showed painted key art (a faceted sea, a big crate-laden boat) that the game does not look like, and the first voyage opened in the top view on an empty blue sea, while the same moment in the follow cam shows sky, land and a wreck. The first two pictures a stranger sees sold another game.

## Decision

- **Live title.** On Medium and up the title shows the real scene behind a paper column on the left third: the boat docked off the last port, in the follow cam, the camera swinging a few degrees round her and back every 48 s (still on Gentle motion). The scene is pushed right with a camera view offset so the boat sits in the part the column leaves free; it slides back to the middle when the voyage begins. No scrim: only a 20% ink vignette on the bottom edge. The column follows the night paper and is opaque at night too. `src/ui/cameraStage.ts` places the camera; the pose is `camera.json` › `title` and the `title` framing; the level switch is `graphics.quality.*.liveTitle`.
- **Stills.** Low and Ultra-low keep a still of the same view (day and night, `src/ui/screens/art/title-still-*.jpg`, captured with `npm run shots -- --menu`, ~47 kB each). The painted `title-key.jpg` (232 kB) is gone.
- **Opening.** A fresh voyage begins at 8 am (sun about 30° up, behind her left shoulder) in follow-cam framing B, Saltmere's headland to port and the East Reef with the wreck to starboard, Skerry beyond the haze. The hour and view are data: `phase1-map.json` › `prologue.opening`. When the sails go up the camera eases to the player's own saved view (or stays, when the follow cam is it). A map check (`opening`) keeps the hour inside a fresh voyage's first minute, the view real, land within 600 units ahead and the captain's island out of sight.
- The start moved to (350, 60) heading 225° so a minute at full sail with no steering still touches nothing, with the East Reef in the right of the first frame.
- On phone landscape the lesson card is capped at 240 px and keeps right of the middle, clear of the boat.
- The market and lesson finish cards both say the lessons are in Settings (How to play moved there in #603).

## Consequences

The scene already ran behind the opaque title, so the live title costs no extra draw calls; the time to a usable menu does not grow (two small stills replace one large picture). The title shows the player's real hour: a saved night voyage opens on a night title. The map editor round-trips `prologue.opening` as part of the map file.
