# 0076. Sails come back as you left them, down in port

**Status:** Implemented for review (2026-10-22)

## Context

Guillaume noticed that resuming a voyage always set the sails to full. Two resume paths exist:

- **Pause and resume** (main menu, settings, chart, port screen): the sail setting lives in `main.ts` and the simulation just stops, so it was already kept.
- **Reload from the save** (closing and reopening the page, a phone dropping the tab, a voyage moved by QR or file, [0066](0066-move-voyage-between-devices.md)): the save ([0009](0009-sandbox-short-sessions.md), [0015](0015-trade-economy.md)) never stored the sails, and `applySave` rebuilt the boat with `createBoat`, which starts at full sail. In port that is the worst case: she wakes up moored under full canvas and sails off the pier.

## Decision

- **At sea:** the sails resume exactly as the captain left them (furled, half or full). The save now records `boat.sailStep`.
- **In port:** the boat always resumes with sails down, whatever was saved, so she stays alongside.
- **The boat still resumes at rest** (speed 0); the sail area is set straight to the saved step, so she picks up speed from there instead of the sails easing up from nothing.
- **Older saves** have no sail setting: full at sea (as before), down in port. A mangled value is ignored rather than throwing away the voyage. The save version stays 1.

## Consequences

- `SaveData.boat.sailStep` is optional; `resumeSails` in `src/sim/save.ts` holds the rule.
- A save moved to the known-clear spawn (old map, or a coast now covers it) is at sea, so it keeps its saved setting.
- Validation: `tests/economy.test.ts` (save and load) covers the sea, port, older and mangled cases.
