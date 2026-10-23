# 0098. Batched economy at sea

**Status:** Implemented for review (2026-10-23).

## Context

Markets, order cooldowns, town growth and help-order selection ran on every 60 Hz sailing step. Their cost grows with ports and goods, although a fraction of a second is sufficient while sailing. The data-driven direction (0093, 0094) requires the interval to be editable data. Island generation remains owned by 0096.

## Decision

- `economy.updateSeconds` in `src/data/tuning/economy.json` sets the maximum economy batching interval in simulated seconds (shipped: 0.25 seconds), with panel metadata. Changes are read live. An economy tick consumes all elapsed simulation time, including a large caller step, once; it never advances from wall-clock time.
- Keep docking, undocking and port discovery at sailing cadence. Run an initial economy tick and flush on automatic arrival. Explicit docking flushes returned events before opening its paused trade panel. While docked, keep the economy current every step so quotes, orders and transactions retain their existing timing.
- Supplied towns request processing on the next sailing step, including carry-over growth that still resolves one level per step. When supply arrives between economy ticks, apply its previous stall decay before adding growth and exclude already applied time from the subsequent batch. Rare deliveries also request immediate processing.
- Save the pending simulation seconds and supplied-town bookkeeping as optional fields. Old saves default to zero pending time. Restore through the existing validation path; supplied-time offsets cannot exceed the pending batch. Serialization does not consume events or mutate the economy.

## Consequences

- At 60 Hz offshore, the ordinary whole-economy sweep drops from 60 to approximately four per second (over 90% fewer market sweeps in the regression test). Sailing and discovery remain responsive. This is a deterministic work-count reduction, not a device frame-rate measurement.
- Offshore prices and help-order notifications may lag simulation time by one interval plus a sailing step. Docking flushes this lag before trade. Existing market exponential recovery, cooldown subtraction and stall decay consume the full elapsed time rather than changing their rates.
- Port time still uses the former full cadence. A later fleet system should use explicit timestamps or event scheduling for deliveries between batches; this change preserves their elapsed-time semantics without introducing a new background clock.
- `tests/economy-cadence.test.ts` compares a minute of batched economics against frame-by-frame updates; covers live tuning, large steps, save validation/resume, immediate growth and supply timing, and paused manual docking. Existing economy, help-order, settlement and tuning tests also pass.
