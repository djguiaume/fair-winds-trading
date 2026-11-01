"""Copy the contact sheets into the repo as pages the PR rules accept (JPG, 1280 px wide, at most 1900 px
tall and 500 KB). A sheet is cut only on its dark gaps between rows, never through a screen.
usage: python3 archive.py <dest dir> <name=sheet.jpg> ..."""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

MAX_H, MAX_KB = 1900, 500
dest = Path(sys.argv[1])


def gaps(im):
    a = np.asarray(im.convert('L')).astype(np.int16)
    dark = (a.max(axis=1) < 40)  # a row with nothing but the sheet's dark background
    return [y for y in range(len(dark)) if dark[y]]


def save(im, path):
    for q in (84, 78, 72, 66):
        im.save(path, quality=q, optimize=True)
        if path.stat().st_size <= MAX_KB * 1024:
            return
    raise SystemExit(f'{path} is over {MAX_KB} KB')


for arg in sys.argv[2:]:
    name, src = arg.split('=', 1)
    im = Image.open(src).convert('RGB')
    cuts, top, g = [], 0, gaps(im)
    while im.height - top > MAX_H:
        y = max(c for c in g if top < c <= top + MAX_H)
        cuts.append((top, y)); top = y + 1
    cuts.append((top, im.height))
    dest.mkdir(parents=True, exist_ok=True)
    for i, (a, b) in enumerate(cuts, 1):
        path = dest / (f'{name}.jpg' if len(cuts) == 1 else f'{name}-{i}.jpg')
        save(im.crop((0, a, im.width, b)), path)
        print(path, b - a, round(path.stat().st_size / 1024), 'KB')
