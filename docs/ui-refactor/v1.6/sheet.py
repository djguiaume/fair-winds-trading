"""Contact sheet per direction (JPG, 1280 px wide) plus every screen at full size.
usage: python3 sheet.py <rendered dir> <out dir>"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
W, GAP = 1280, 8
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font = ImageFont.truetype(FONT, 15) if Path(FONT).exists() else ImageFont.load_default()
NAMES = {'chart': '1-chart-table', 'club': '2-sailing-club', 'harbour': '3-painted-harbour'}
DESKTOP = [('title-day', 'Title'), ('hud-night', 'Sea at night'), ('harbour-day', 'Harbour (Market)'), ('chart-day', 'Chart'),
           ('hud-day', 'Sea by day, arrival banner'), ('hud-storm', 'Sea in a storm, storm warning')]
PHONE = [('title-day', 'Title'), ('hud-night', 'Sea at night'), ('harbour-day', 'Harbour (Market)'), ('chart-day', 'Chart')]


def label(img, text):
    out = Image.new('RGB', (img.width, img.height + 26), (20, 24, 28))
    out.paste(img, (0, 26))
    ImageDraw.Draw(out).text((8, 4), text, font=font, fill=(242, 244, 239))
    return out


def tile(path, w, text):
    im = Image.open(path).convert('RGB')
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    return label(im, text)


for d, name in NAMES.items():
    rows = [Image.open(src / d / 'identity.jpg').convert('RGB')]
    tw = (W - GAP) // 2
    pairs = [DESKTOP[i:i + 2] for i in range(0, len(DESKTOP), 2)] + [PHONE[i:i + 2] for i in range(0, len(PHONE), 2)]
    for n, pair in enumerate(pairs):
        size = 'desktop' if n < 3 else 'phone'
        tiles = [tile(src / d / f'{k}-{size}.jpg', tw, f'{t}, {"desktop" if size == "desktop" else "phone landscape"}') for k, t in pair]
        row = Image.new('RGB', (W, tiles[0].height), (20, 24, 28))
        for i, t in enumerate(tiles):
            row.paste(t, (i * (tw + GAP), 0))
        rows.append(row)
    sheet = Image.new('RGB', (W, sum(r.height for r in rows) + GAP * (len(rows) - 1)), (20, 24, 28))
    y = 0
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.height + GAP
    dst.mkdir(parents=True, exist_ok=True)
    sheet.save(dst / f'{name}.jpg', quality=84, optimize=True)
    full = dst / name
    full.mkdir(exist_ok=True)
    for p in sorted((src / d).glob('*.jpg')):
        im = Image.open(p).convert('RGB')
        if im.width > W:
            im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
        im.save(full / p.name, quality=86, optimize=True)
    print(name, sheet.size)
