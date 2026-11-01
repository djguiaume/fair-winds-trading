"""Builds assets.js for the mockups: the real chart (npm run chart, restyled by CSS) and the
game's own portraits (src/ui/portraits.ts) without their brass hexagon frame."""
import json, re, sys
from pathlib import Path

here = Path(__file__).parent
svg = (here / 'chart-src.svg').read_text()
svg = re.sub(r'<style>.*?</style>', '', svg, flags=re.S)
svg = re.sub(r'(class="c-(?:land|shore)") style="[^"]*"', r'\1', svg)
svg = re.sub(r'<[^>]*class="c-hit"[^>]*>(</\w+>)?', '', svg)
# Wind-zone and current captions clutter a player's chart; keep reefs, banks and passes.
svg = re.sub(r'<text[^>]*class="c-label small"[^>]*>[^<]*(·|\()[^<]*</text>', '', svg)
svg = re.sub(r'<text[^>]*c-quest-label[^>]*>[^<]*</text>', '', svg)
svg = re.sub(r'<text[^>]*class="c-label yard"[^>]*>[^<]*</text>', '', svg)
svg = re.sub(r' [\U0001F300-\U0001FAFF☀-➿️]+', '', svg)
svg = svg.replace('width="1067" height="667"', 'width="100%" height="100%" preserveAspectRatio="xMidYMid slice"', 1)
svg = svg.replace('<g class="fw-overlay">', '<g id="ovl"></g><g class="fw-overlay">')

faces = {}
src = json.loads((here / 'portraits-src.json').read_text())
for k, v in src.items():
    if k.endswith('Name'):
        continue
    m = re.search(r'<g clip-path="url\(#[^)]*\)">(.*)</g><path d="M100 4L183', v, re.S)
    faces[k] = m.group(1)
(here / 'assets.js').write_text('window.ASSETS=' + json.dumps({'chart': svg, 'faces': faces}) + ';\n')
print('assets.js', len(svg), list(faces))
