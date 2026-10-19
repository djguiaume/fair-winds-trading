# 0005. Tech stack: three.js + TypeScript + Vite, static site

**Status:** Proposed, 2026-10-19 (waiting for Guillaume's confirmation)

**Context:** The game is rendered in real-time 3D low-poly ([0004](0004-real-time-3d.md)) and runs in the browser. Needs, from the [roadmap](../roadmap.md):

- A stylized ocean, flat-shaded islands and ships, shadows, a tilted top-down camera (Phase 0).
- A simple, tunable sailing model (speed from the angle to the wind, tacking), not a rigid-body simulation.
- Lots of HTML-style UI: trade panels, floating port labels, minimap, route editor and dashboard (Phases 1–3).
- Many automated ships simulated even when off-screen (Phase 3), so the game logic must not depend on the renderer.
- No backend, saves in the browser, quick to load on mid-range devices, and fast to iterate on (the 3D mockup was already built with three.js).

**Decision (proposed):**

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) | Types keep the simulation, save format and UI in sync as the game grows. |
| Build / dev server | **Vite** | Instant reload, zero-config TS, static output. |
| 3D rendering | **three.js** (WebGL2 renderer) | Small, mature, huge community; the 3D mockup already uses it; we only need rendering, not a full engine. WebGPU renderer can be tried later without a rewrite. |
| Ocean | Custom **shader** (vertex waves + flat shading + foam near shores) | The look is the game; a hand-written shader gives exactly the ad's style. |
| Sailing physics | **Hand-written** 2D model on the water plane, fixed timestep | Arcade sailing is a few formulas (polar speed curve, drift, turning); a physics engine would fight us. Island collision with simple circles/polygons. Rapier can be added later if ever needed. |
| Game architecture | **Simulation separate from rendering**: plain TS world state + systems, renderer only reads it | Lets automated ships run off-screen or in a Web Worker (Phase 3), makes saves trivial and the sim unit-testable. |
| UI | **HTML/CSS overlay**, with **Preact** for panels from Phase 1 | Like the mockup's HUD. DOM is far easier than in-canvas UI for tables, forms and text; Preact is ~4 kB. Phase 0 HUD is plain DOM. |
| 3D assets | **Blender → glTF (.glb)**, low-poly with vertex colors / a small palette texture; procedural geometry in Phase 0 | glTF is three.js's native format; vertex colors keep files tiny and the flat look consistent. Source `.blend` files committed under `assets/`. |
| Audio | **Howler.js** (Phase 5) | Simple, reliable web audio. |
| Saves | **localStorage** (JSON, versioned) → IndexedDB if saves grow | Matches the roadmap's "save to the browser". |
| Tests / quality | **Vitest** for the simulation, **ESLint + Prettier** | Fast, works with Vite out of the box. |
| Hosting / CI | **GitHub Pages** deployed by **GitHub Actions** on every push to `main` | Free, no backend, every change playable at a URL. |
| Package manager | **npm** | Default, nothing to install. |

Target: desktop browsers first (keyboard + mouse), with input abstracted so touch controls can be added later.

**Alternatives considered:**

- **Babylon.js:** more batteries included (physics, GUI, inspector), but heavier to download and more opinionated. Good choice if we wanted an all-in-one engine; we mostly need a renderer.
- **Godot (web export):** a real game editor, great tooling, but a large WebAssembly download (tens of MB), slower first load and weaker HTML UI integration.
- **PlayCanvas:** nice cloud editor, but the editor workflow lives outside the repo, which conflicts with "everything in the repo" ([0003](0003-document-everything-in-repo.md)).
- **React Three Fiber:** pleasant for UI-heavy apps, but React's render loop adds overhead and indirection for a simulation-driven game. Plain three.js + Preact for panels keeps the two concerns apart.
- **Unity WebGL:** heavy builds, slow loads, poor mobile browser support.

**Consequences:**

- Repo layout once Phase 0 starts: `src/sim/` (world state, wind, sailing, no three.js imports), `src/render/` (three.js scene, ocean shader, models), `src/ui/` (HUD and panels), `assets/` (glTF + Blender sources), `docs/` unchanged.
- We write our own sailing model and ocean shader: more code than with an engine, but full control over the feel and look.
- The game is a static site: no server costs, but online features (leaderboards, shared world) would need a backend decided later.
