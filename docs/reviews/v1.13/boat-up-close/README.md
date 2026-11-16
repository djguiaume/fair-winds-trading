# The boat up close and spray (#553, #554, decision 0326)

Sloop, High quality, desktop. What she shows and costs: [docs/art/boat-up-close.md](../../../art/boat-up-close.md).

| Sheet | What to look at |
|---|---|
| [before-after.jpg](before-after.jpg) | Follow cam, side and top at 7 kn: a helmsman at a tiller, a fuller sail, spray at the bow. The top view keeps the far model (no crew). |
| [speeds.jpg](speeds.jpg) | 3, 5 and 7 kn in both views: no spray at 3 kn, a small bow curl at 5 kn, a clear bow spray at 7 kn. The wake already grows with speed (unchanged). |
| [options.jpg](options.jpg) | Option A (helmsman alone, default) and option B (one hand more, `graphics.closeUp.extraHands` 1). |
| [manoeuvres.jpg](manoeuvres.jpg) | Tack, gybe, luff and reef from the follow cam, no HUD needed: the boom swings across, the helmsman walks to the new weather side, the luffing sail shakes. |

Not on a sheet: the follow cam leans with her heel (at most 3°, slower than the heel); Settings › Motion reduced or off steadies it and stops the camera riding the waves. Spray stays.

## Remaking the shots

From the repo root, with a built game served (`npm run build`, `npx vite preview --port 5180`):

```sh
npm run shots -- --list docs/reviews/v1.13/boat-up-close/src/shots.json --at 0,-330 --quality high --sizes desktop --wait 8000 --out <dir>
```

`src/before.json` made the before shots on main. `src/turn.js` turns her through a tack, gybe or luff before the shot (`src/turn-*.js` set the angles); `src/option-b.json` is the option B tuning.
