# v1.11 part 4: live title and the first voyage's opening (#531, #533)

Decision [0313](../../decisions/0313-the-live-title-and-the-first-voyages-opening.md). Shots in [part4/](part4/), each at actual size (desktop 1280x800, phone landscape 844x390).

| File | What it shows |
|---|---|
| `title-before.jpg`, `title-after-day.jpg` | The painted title and the live one, morning, Medium and up |
| `title-after-night.jpg`, `title-phone-night.jpg` | The same at night: night paper, opaque, the scene stays night |
| `title-after-low-still.jpg` | Low and Ultra-low: the still of the same view |
| `title-phone-landscape.jpg` | The title on 844x390 |
| `opening-before.jpg`, `opening-after.jpg` | The first frame after the title, then and now |
| `opening-phone-landscape.jpg` | The first frame on 844x390: the lesson card keeps right of the boat |

Picks for the art director and Guillaume: the title pose (distance 42, look round -38°, swing 6°), the opening heading and hour (8 am, 215°), the still being a day capture.

Shot tips: `npm run shots -- --menu --quality high --wait 3500 --time 35 --script day.js` (a script setting `fwt.world.time = 35`; `--time` turns day and night on), the still with `--style` hiding `.title-page, .title-version`.
