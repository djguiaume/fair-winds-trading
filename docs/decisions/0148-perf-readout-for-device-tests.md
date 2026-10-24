# 0148. `?perf` readout for device tests

**Status:** Implemented (2026-10-24).

## Context

The old-tablet test (0006, 0022, 0116) has been pending since Phase 1, and Phase 4's bigger map needs it on today's sea and on `?map=stress` (0115), now with currents (0145) and wind zones (0144) on. The game only shows a live FPS number (Settings › Show FPS). One number read off a screen misses the slow frames and stutters that a player feels, and it hides automatic quality drops. The Playwright tool (0102) needs a computer and cannot drive a tablet.

## Decision

Add `?perf` to the game URL to show a small readout at the top of the screen, loaded as its own chunk (players without `?perf` never download it):

- Live FPS and the graphics level in use (with "(auto)").
- A running summary of the voyage, counted only while the sea is on screen and the game runs (not the title, chart, port or paused cards), after a warm-up: average FPS, **1 % low** (1000 / p99 frame time), frame time p50 / p95 / worst, slow frames (≥ 50 ms), hitches (≥ 100 ms) and the number of quality drops.
- Draw calls and triangles of the last frame.
- **Copy** puts a labelled report on the clipboard (version, sea, device, cores, memory, screen and canvas size, quality setting and level, hazard switches, the summary and each quality drop with its time). Where the clipboard is not allowed the text opens in a box to select by hand. **Reset** starts a new summary, **–** folds the readout to one line.

The thresholds, warm-up, refresh rate and window size live in `src/data/perf-readout.json` (0093). Frame times are the raw time between frames, not the simulation's capped step. The maths is in `src/perf/frameStats.ts` with tests.

## Consequences

A tester opens a link, sails for a few minutes and pastes one block back; results from different devices compare directly. Nothing changes without `?perf`. The readout measures the whole frame (simulation, HUD, render, browser) on the real device, unlike the headless tool. A modal card (quest, port) covers the buttons while it is open; the game is paused then and those frames are not counted.
