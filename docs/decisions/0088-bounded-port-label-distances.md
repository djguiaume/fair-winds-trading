# 0088. Bound port label distance queries

**Status:** Implemented for review, 2026-10-22.

**Context:** Port labels query exact hull-to-shore and pier distances for every discovered port on every rendered frame. The harbour query already supports a conservative finite cutoff, but labels were leaving it unbounded even though their visibility thresholds are only 100 or 160 units.

**Decision:** Pass a 100-unit cutoff in approach and objective modes (including kid mode), and 160 units in all mode. Keep the existing objective and docked visibility overrides. All docking and approach cue thresholds are inside these cutoffs, so a distant Infinity result retains the same cue and action behavior.

**Consequences:** Distant labels can reject their harbour before transforming the hull or calculating detailed clearances. Nearby queries retain their exact geometry and existing visibility boundaries. The new UI regressions verify finite cutoffs and Infinity results for distant queries in all three modes, inclusive visibility boundaries and kid mode, and distant objective/docked cues. Eight label regressions and the existing 89 harbour regressions pass. This is a call-site optimization using the already measured harbour bound; no separate FPS claim is made.
