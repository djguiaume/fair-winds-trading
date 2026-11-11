# Bloom on Ultra (#501, decision 0299)

Saltmere on Ultra, the same camera with Settings › Glow off and on: night from the chase camera and
over the town, golden hour, day. By day nothing changes.

![Bloom off and on: night chase, night town, golden hour, day](bloom-sheet.jpg)

Re-run: `npm run shots -- --quality ultra --night --chase` and the same with `--query off=bloom`
(`--zoom 1.4` for the town, `--time 400` for golden hour).

Low against Ultra at night: Low has no pipeline to bloom in, so it is as before (the same holds
for Medium and High). Phones never pick Ultra, so there is no phone frame.

![Night on Low and on Ultra](low-ultra.jpg)
