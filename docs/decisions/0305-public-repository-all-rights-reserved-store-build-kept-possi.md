# 0305. Public repository, all rights reserved, store build kept possible

**Status:** Accepted (2026-11-13, Guillaume).

## Context

The whole-game review ([docs/reviews/whole-game-v1.9](../reviews/whole-game-v1.9/README.md), issue #566) found that the repository is public with no `LICENSE` file, while the plan is to sell the game one day (Steam demo first, then phones and Xbox, decision 0204, parked). Three ways were open: go private, add an open licence, or stay public with all rights reserved.

A private repository loses the free GitHub infrastructure the project runs on (Pages, Actions minutes, macOS runners for a future iPhone build). An open licence such as MIT would let anyone publish or sell the game, and cannot be taken back for the versions already released under it.

## Decision

- The repository stays public and the game stays free for now.
- No `LICENSE` file is added. With no licence, all rights stay with the owner. The "Rights and licensing" section of the root `README.md` says so in plain words and is the only statement.
- A store build stays possible later, in particular the Xbox store and Nvidia cloud play (GeForce NOW). Nothing may be done that gives those rights away.

## Consequences

- Nobody adds a `LICENSE` file or an open-licence header without a new decision from Guillaume.
- Outside contributions need a written agreement on rights before they are merged (already in the README's Contributing section).
- Third-party libraries, fonts and sounds keep their own licences; a new one is checked for store use before it comes in.
- Before the first paid build, this decision is looked at again: what the free web build contains, and whether the source stays visible (see the store plan, decision 0204).
