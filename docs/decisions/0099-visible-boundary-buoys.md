# 0099. Animate and upload only visible boundary buoys

**Status:** Implemented for review (2026-10-23).

## Context

Boundary buoys used one instanced draw call, but every buoy sampled the ocean, rebuilt its
matrix and uploaded its matrix every frame, even while the whole boundary was off screen.
The game should scale without disturbing the island-file migration in decision 0096.

## Decision

- Test a conservative sphere around each buoy against the current camera frustum. Its radius
  includes the entire geometry under any rotation and the ocean's maximum vertical displacement.
  The sphere follows the live waterline tuning. No distance cutoff depends on zoom, aspect
  ratio or quality; partly visible buoys remain eligible.
- Compact visible instances into a single draw call. Only those buoys sample waves and build
  matrices; upload only that prefix of the matrix buffer. With no visible buoys, draw count is
  zero and no instance buffer update is requested.
- Evaluate visible poses from absolute animation time and the original buoy phase. A buoy
  returning to view immediately has the same pose it would have had without culling.
- Keep the existing material, geometry, lighting and motion. Move the existing boundary spacing,
  offset and motion values into `seamanship.boundaryBuoys` with tuning metadata (0093/0094).
  Layout values apply when the view is created; waterline, rocking and rates are read live.
- Expose the sum of existing ocean wave amplitudes as `MAX_WAVE_HEIGHT` for culling. This is a
  bound on the existing wave formula, not a new artistic setting. Update it alongside that
  formula if its amplitudes change.

## Consequences

Each frame still does a cheap sphere/frustum test per boundary buoy. CPU wave/matrix work,
recurring buffer uploads and GPU instances instead scale with the portion visible. The first
GPU buffer allocation still reserves the full ring capacity. Culling is deliberately conservative
and may retain a few invisible buoys at screen edges.

Tests cover zero hidden work, partial upload ranges, leaving/re-entering view, wave displacement,
and retaining every visible animated vertex across portrait/wide cameras, close/far zooms and
maximum live rocking/waterline values. Island generation and simulation are untouched.
