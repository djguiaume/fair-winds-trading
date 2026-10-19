# 0006. Desktop and mobile from day one, optimized for low-end devices

**Status:** Accepted, 2026-10-19

**Context:** Guillaume will test on an old tablet and a phone.

**Decision:** Support desktop (keyboard/mouse) and touch devices from Phase 0. Performance on low-end mobile hardware is a hard requirement.

**Consequences:** Touch controls and a responsive HTML UI are built alongside keyboard controls, not later. Rendering budget is set by the old tablet: low draw calls, small textures, cheap shadows, a quality setting, capped pixel ratio. The tech stack must be judged on mobile performance and bundle size.
