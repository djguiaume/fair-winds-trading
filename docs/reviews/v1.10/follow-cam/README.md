# Follow-cam look (v1.10, issues #539-#542)

Four effects were tuned for the camera above the boat and looked wrong from the low follow cam
(whole-game review v1.9, sheet `look-bugs.jpg`). Goal from Guillaume: the follow cam may only become
the default when both views share one look. Each sheet is before (main) on the left, after on the right.

| Sheet | Issue | What changed |
| --- | --- | --- |
| [wake.jpg](wake.jpg) | #539 | Smooth noise foam instead of crossing sines (no chequer), a soft ease-out fade astern (`fadeAstern`), foam widening twice as fast, a longer trail on Medium (3.2 s), High and Ultra (5 s). Cosmetic twinkles use the same noise, so no square cells either. |
| [streaks.jpg](streaks.jpg) | #540 | In the follow cam the wind streaks are thinner (0.035 half width), lie low on the water and fade in only 20-50 units from the camera. God eye unchanged. No more array per streak per frame. |
| [beam.jpg](beam.jpg) | #541 | Lighthouse beams are an additive light shader: brightest at the lamp, fading out along the beam, faint where the cone is seen edge-on, fading into the fog instead of turning grey. Same meshes and draws. |
| [mirror.jpg](mirror.jpg) | #542 | The sea mirror (High and Ultra) is sampled with four taps stretched down, swayed by small ripples even on a calm quay, and sends back 80 % of the light, capped: soft edges, lit windows become wavy streaks. No new texture or pass. |

Numbers live in `graphics.json` › `windStreaks`, `beams` and `reflection.soften`, with `?tune`
sliders (`tuning-meta-follow-look.ts`, `tuning-meta-reflection.ts`).

The wake shots on a reach wait 20 s: the software renderer runs the game slowly, so a short wait
shows a trail only a boat length long (the "hard end" in the review was mostly that). The god-eye
framing drifts a little between runs (the camera is still easing in), so before and after are not
always the same patch of sea.

## Re-create

```
npm run shots -- --at 0,-330 --heading 180 --quality high --chase --wait 20000   # wake
npm run shots -- --at 0,-330 --heading 180 --quality high --chase --wait 20000 --script docs/reviews/v1.10/follow-cam/src/wake-style.js
npm run shots -- --at 0,-330 --heading 90 --quality high --chase                 # streaks
npm run shots -- --at 0,-330 --heading 90 --quality high --night --zoom 1.8      # beam from above
npm run shots -- --at 243,-116 --heading 120 --quality ultra --chase --time 560 --wait 9000   # beam, mirror at night
npm run shots -- --at 243,-116 --heading 120 --quality ultra --chase --wait 6000  # mirror by day
```

## Cost

No new draw call, texture, render target or per-frame allocation (one removed in the streaks). The
mirror reads its texture four times instead of once on High and Ultra water; graphics memory is
unchanged. CI's render budget run measures Ultra on the PR.
