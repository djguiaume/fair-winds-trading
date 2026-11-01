"""Round 2 contact sheets: per direction, framed and minimal side by side (JPG, 1280 px wide).
usage: python3 sheet_r2.py <out-r2 dir> <dest dir>"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
W, GAP, TW = 1280, 8, 636
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font, big = ImageFont.truetype(BOLD, 15), ImageFont.truetype(BOLD, 24)
DIRS = {'chart': ('1-chart-table-r2', '1. The chart table, round 2'), 'harbour': ('3-painted-harbour-r2', '3. The painted harbour, round 2')}
SHOTS = [('title-day', 'Title'), ('hud-day', 'Sea by day'), ('hud-night', 'Sea at night'), ('harbour-day', 'Harbour market')]
BG = (20, 24, 28)


def tile(path, text):
    im = Image.open(path).convert('RGB')
    im = im.resize((TW, round(im.height * TW / im.width)), Image.LANCZOS)
    out = Image.new('RGB', (TW, im.height + 26), BG)
    out.paste(im, (0, 26))
    ImageDraw.Draw(out).text((8, 4), text, font=font, fill=(242, 244, 239))
    return out


for d, (name, title) in DIRS.items():
    rows = []
    head = Image.new('RGB', (W, 64), BG)
    dr = ImageDraw.Draw(head)
    dr.text((12, 8), title, font=big, fill=(242, 244, 239))
    dr.text((12, 40), 'A. Framed (paper or paint plates)', font=font, fill=(200, 205, 200))
    dr.text((TW + GAP + 12, 40), 'B. Minimal (text and marks straight on the scene)', font=font, fill=(200, 205, 200))
    rows.append(head)
    for size, label in (('desktop', 'desktop'), ('phone', 'phone landscape')):
        for key, text in SHOTS:
            a = tile(src / d / f'{key}-framed-{size}.jpg', f'A. {text}, {label}')
            b = tile(src / d / f'{key}-minimal-{size}.jpg', f'B. {text}, {label}')
            row = Image.new('RGB', (W, a.height), BG)
            row.paste(a, (0, 0))
            row.paste(b, (TW + GAP, 0))
            rows.append(row)
    sheet = Image.new('RGB', (W, sum(r.height for r in rows) + GAP * (len(rows) - 1)), BG)
    y = 0
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.height + GAP
    dst.mkdir(parents=True, exist_ok=True)
    sheet.save(dst / f'{name}.jpg', quality=82, optimize=True)
    full = dst / name
    full.mkdir(exist_ok=True)
    for p in sorted((src / d).glob('*.jpg')):
        im = Image.open(p).convert('RGB')
        if im.width > W:
            im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
        im.save(full / p.name, quality=86, optimize=True)
    print(name, sheet.size, round((dst / f'{name}.jpg').stat().st_size / 1024), 'KB')
