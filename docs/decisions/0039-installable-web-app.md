# 0039. Installable web app (manifest, icons, service worker)

**Status:** Implementation for review · 2026-10-19

## Context

Players reported that Chrome never offers to install the game. Chrome's own check
(`Page.getInstallabilityErrors` on https://djguiaume.github.io/fair-winds-trading/) returned
`no-manifest`: the page had no web app manifest, only an SVG favicon and no PNG icons. Older
Chrome versions (the old tablets we target, decision 0006) also require a service worker with a
fetch handler. iPhone players already get an "Add to Home Screen" hint (decision 0017).

## Decision

- Add `public/manifest.webmanifest` with relative `start_url`, `scope` and `id` (`./`) so it works
  under the GitHub Pages subpath and locally. Display mode `fullscreen` (Chrome falls back to
  standalone where fullscreen is not available); theme and background are the game teal.
- Add PNG icons rendered from the favicon art: 192 and 512 px round icons, a 512 px maskable icon
  (full-bleed teal, boat inside the safe zone) and a 180 px `apple-touch-icon` for iOS.
- Add a small network-first service worker (`public/sw.js`), registered from `src/main.ts` in
  production builds only. Online, every request goes to the network, so a new deploy is picked up
  the next time the game opens; the cache is only a fallback that lets the game start offline.

## Consequences

- Chrome (desktop and Android) shows its install button / "Install app"; verified with Chromium:
  no installability errors on the built site served under `/fair-winds-trading/`.
- Installed players get updates automatically; nothing to reinstall. Saves stay in localStorage.
- In dev (`npm run dev`) no service worker is registered, so hot reload is unaffected.
- If an offline-first or precached build is wanted later, revisit the caching strategy here.
