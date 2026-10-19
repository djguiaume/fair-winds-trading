# 0040. Visible wind strength on the compass

**Status:** Implementation for review · 2026-10-19

## Context

Since decisions 0026 and 0027 the wind changes strength: slow weather shifts, gusts, a calm lee
behind islands and a faster wind along flanks and through channels. The compass only showed
direction and a small "NE · 15 kn" line, so players could not see at a glance why the boat sped
up or slowed down. The Phase 1 play-test fixes ask for "wind strength you can see, not only its
direction", readable on a phone and in Kids mode.

Guillaume likes the existing wind effect (arrow, compass and white streaks on the sea) and asked
not to change it massively. A mockup ([proposal](../mockups/wind-strength-proposal.png)) was
reviewed first; he picked "build as shown, and also tune the streaks".

## Decision

1. **Strength gauge under the compass dial:** five bars that fill with the wind the boat feels
   (after lee and channel effects), plus a one-word name. Steps: Calm under 7 kn, Light 7–11,
   Breeze 11–15, Fresh 15–19, Strong 19+. The bars, the word and the compass arrow share one
   colour per step (grey, pale blue, green, yellow, orange); colour always comes with a bar count,
   so it still reads without colour. A 0.6 kn hysteresis keeps the gauge from flickering on a
   boundary (about one step change every 25 s in normal Phase 1 weather).
2. **Gust tag:** a small "gust" tag shows for 1.6 s when the wind jumps 1.4 kn or more above its
   recent average (5 s time constant). In normal weather it is up about 6 % of the time.
3. **Arrow weight:** the compass arrow grows slightly wider with each step; its length and
   direction behaviour are unchanged.
4. **Kids mode:** bigger bars and plain words (No wind, Little wind, Good wind, Big wind, Very
   windy), and no knots or compass point.
5. **Streaks on the sea, tuned not replaced:** at the prevailing Phase 1 breeze (14 kn) the
   streaks look exactly as before. Below it fewer streaks show and they fade (half as visible in a
   calm); above it they get a little brighter (up to 1.4 × in strong wind) and keep growing longer
   as they already did. The streak count stays within each quality level's budget.
6. All words go through the translation layer (decision 0037), in English and French.

The logic lives in `src/sim/windStrength.ts` (pure and tested); the HUD only reads it. The gauge
sits inside the existing compass panel so the coming UI redesign can move or restyle it freely.

## Consequences

- A lee or channel is visible as bars dropping or rising, which explains speed changes without
  extra text.
- The compass panel is about 35 px taller; it still clears the sail buttons on a landscape phone
  ([screenshots](../screenshots/)).
- Thresholds are tuned for the current maps (about 5–22 kn). Phase 2's gales and storms will need
  more steps or a new top step.
