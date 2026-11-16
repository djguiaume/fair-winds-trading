# Bring the water to life (#551, #546)

v1.12 part 4. Decision [0322](../../../decisions/0322-waves-you-can-see-and-life-on-the-open-sea.md). Reference (art bible §14): the vibrant top view; it may not get duller.

## Sheets (High, desktop; `?waves=calm|wind|storm` = light 3 kn, fresh 14 kn, strong 26 kn + storm)

- [follow-cam.jpg](follow-cam.jpg): #551, the follow cam before | after at light, fresh and strong wind, and Saltmere's harbour.
- [open-sea-above.jpg](open-sea-above.jpg): #546, the open sea from above, High before | High after | Medium after.
- [atmosphere.jpg](atmosphere.jpg): #573's open-sea check, top and follow, before | after, five hours; numbers in [colors.json](colors.json).

## What changed

- **Waves you can see from behind.** The swell and chop stand taller (`waves.json › bands.*.scale`: swell 1.5, chop 1.8) with sharper crests (chop steepness 0.6 → 2, swell 0.35 → 0.6). It is the one wave model (decision 0245): the boats ride it, the ocean draws it. Drag, foam and surf read the sea state, not the scale, so speed and balance are unchanged on all three levels (`npm run balance`: 9/9).
- **Slopes read from a low camera** (`look.viewTone` 2, at most ±30%): a slope facing the camera looks into the water, one turned away catches the sky. From above it barely moves the colour.
- **Her middle rides the crest** (`motion.ride.middle` 0.5), so a sharp crest under her waist lifts her instead of washing over.
- **Harbours are not mirrors**: the coast keeps 60% of the ripples and 15% of the chop however deep the shelter (`coast.keep`, CPU and GPU alike).
- **No glare blob behind the boat** facing a high sun: the glint fades over view sines 0.4 → 0.6 (was 0.6 → 0.85).
- **Swell lines from above** (`look.swellTone` 0.2): the swell's troughs darker, calm in the lee.
- **Cloud shadows** (`waves.json › clouds`, Medium and up): soft patches ~90 u across drifting downwind, up to 20% darker times the sky's low cloud amount (#552's `cloudAmount`: about 9% on a calm day, 15% at 14 kn); none at night or under an overcast. `?off=clouds` for device tests.
- Whitecaps already started at fresh wind (#281); unchanged. Depth colours over far banks: no bank in today's seas, left out.
- **Not built: a finer mesh ring near the boat.** With the taller waves the low-poly facets read as the art style; triangles stay as they were.

## Numbers

One atmosphere (`npm run shots -- --both`, sea ΔE top vs follow, before → after, on main with #550 and #552):

| Open sea (285,-60, heading 180, #573's recipe) | morning | noon | golden | dusk | night |
|---|---|---|---|---|---|
| ΔE | 4.5 → 2.6 ✓ | 4.7 → 5.5 ✓ sun | 5.0 → 6.4 (known exception) | 2.0 → 3.2 ✓ | 1.5 → 0.5 ✓ |

8 of 10 pass, as before. Golden hour stays #573's known exception (low sun 64° off the bow, past the 60° line): the follow cam is unchanged, the top view's steeper slopes turn more faces from the low sun (top ΔE 2.4 darker; the same with `?off=clouds`, 6.7). Earlier, on the pre-#550 main, Saltmere and Sunreach spots facing shallows from behind were compared at five hours each: no pair moved by more than ΔE 2.4 either way, the top view's sea by at most 2.5 (4.0 at Sunreach noon).

Render: triangles and draw calls unchanged (sailing: Medium 21 calls / 52.5k triangles, High 29 / 155k). Headless sailing frame (software renderer, 5 runs, median): Medium 210 → 215 ms, High 285 → 290 ms: within the run-to-run noise (±20 ms). Real-device `?bench` joins #377.

Shot recipes: open sea `npm run shots -- --at 0,-330 --heading 0 --quality high --chase --query waves=wind`; harbour `--at 243,-116 --heading 120 --chase`. "Before" = the old numbers through `--tune` (every new knob at its old value).
