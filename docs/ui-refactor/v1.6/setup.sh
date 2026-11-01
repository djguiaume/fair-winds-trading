#!/bin/sh
# Inputs for the v1.6 identity mockups, all from the real game (run from the repo root):
# backgrounds (npm run shots, UI hidden), the chart (npm run chart), the portraits, the fonts.
set -e
k=docs/ui-refactor/v1.6
npm run -s shots -- --list $k/bg.json --style $k/hide.css --quality high --out /tmp/fw-v16-bg
mkdir -p $k/bg
for f in /tmp/fw-v16-bg/*.png; do python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=90)" "$f" "$k/bg/$(basename "$f" .png).jpg"; done
# Round 4 titles: the README cover is the painted key art.
python3 -c "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=90)" docs/images/readme/cover.png $k/bg/cover.jpg
npm run -s chart -- --sea phase4 --view=-430,-470,770,280 --layers names,marks --legend none --sectors none --svg --out /tmp/fw-v16-chart
cp /tmp/fw-v16-chart.svg $k/chart-src.svg
npx tsx $k/portraits.ts > $k/portraits-src.json
python3 $k/fonts.py
python3 $k/slices.py
python3 $k/prep.py
