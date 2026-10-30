# 0244. Hold the Xbox at High and make Ultra prove itself

**Status:** Accepted (2026-10-30). Issue #374.

## Context

On the Xbox (Edge), Ultra (decision 0221) showed a blank sea with only the menu, and afterwards
Edge had no WebGL2 at all until the console restarted. That is the browser's graphics process
dying and being switched off, not a slow frame: Auto's step-down (it watches frame times) never
gets a chance. High on the same Xbox holds 60 fps (docs/reviews/new-look-performance).

We cannot debug the console's graphics process from here. The most likely cause is memory. At
1080p, Ultra adds roughly 400 MB of graphics memory over High: two half-float render targets with
4x multisampling for the composer (about 230 MB), the canvas's own multisampled buffer that the
composer does not need (about 75 MB), the 4096 shadow map (64 MB or more) and the ambient
occlusion targets at half resolution. Edge on Xbox runs as an app with a small share of the
console's memory. The start-up also opened two throwaway WebGL2 contexts (the "WebGL2 here?"
check, never released, and the GPU name probe).

## Decision

- **TV mode stops at High**: `controls.json › tv.maxQuality` (editor.html › Controls › TV mode,
  checked by `npm run check -- --only controls`). Auto never guesses above it; the Settings show
  Ultra greyed out. `?tv=0` lifts it, to re-test Ultra on the console.
- **Ultra proves itself on each device** (`src/render/ultraTrial.ts`): before Ultra draws, the
  game notes "running" in local storage, and "ok" after `graphics.ultra.trialSeconds` (20 s) of
  frames. A page that finds "running" (the last Ultra run died) or a lost WebGL context while on
  Ultra marks the device "failed": from then on Auto and the Settings stop at High there. Leaving
  Ultra or the page early clears the note, so it is not blamed.
- **One throwaway context**: `probeGpu()` answers both start-up questions (WebGL2 or not, GPU
  name) on one context and releases it at once.
- The Ultra switches in Settings now really hide below Ultra (`.set-row[hidden]` was shown by
  `display: flex`).

## Consequences

- The Xbox plays the new look at High, which it holds at 60 fps. Ultra there waits for a lighter
  Ultra (fewer multisampled targets, no canvas multisampling under the composer, smaller shadow
  map on a TV); a re-test is `?tv=0&perf&look=v2`, then Settings › Ultra.
- Any other device where Ultra takes the graphics down falls back to High on the next page,
  instead of failing again. Clearing site data resets the trial.
