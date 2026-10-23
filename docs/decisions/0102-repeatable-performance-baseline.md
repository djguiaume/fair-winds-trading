# 0102. Repeatable browser performance baseline

**Status:** Implemented for review (2026-10-23).

## Context

Island rendering and shoreline caching need comparable before/after measurements. Single FPS readings miss town-growth pauses and can hide automatic quality changes. Decision 0093 requires adjustable workload settings in data.

## Decision

Add a development-only Playwright CLI runner under `tools/performance/`, using the existing `?debug` interface against production preview. JSON defines repeated startup, sailing, generated storm, discovered docking, synthetic town growth and quality-change workloads, resolution, fixed graphics quality, sample durations and reporting budgets. Reports capture frame and render-call CPU distributions, event latency, draw calls/triangles, geometry/texture counts and environment metadata. Scenarios discover map content and fail when their workload cannot be reached. No production instrumentation is added.

Timings remain reports, not CI pass/fail thresholds. The small distribution test checks that rare spikes and unavailable samples are represented honestly. Full workflow and interpretation limits live in `tools/performance/README.md`.

## Consequences

Measurements can be repeated after each renderer change and on target devices. Playwright is a dev dependency only; its browser is installed separately. Headless/software-GPU readings are regression evidence for that environment, not a claim about tablet FPS. Synthetic town changes bypass trading deliberately and do not validate economic balance.
