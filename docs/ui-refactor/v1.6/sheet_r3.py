"""Round 3 contact sheets: the chart table, one sheet per variant (C, D), desktop beside phone (JPG, 1280 px wide).
usage: python3 sheet_r3.py <out-r3 dir> <dest dir>"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

src, dst = Path(sys.argv[1]) / 'chart', Path(sys.argv[2])
W, GAP, DW = 1280, 8, 700
PW = W - DW - GAP
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font, big = ImageFont.truetype(BOLD, 15), ImageFont.truetype(BOLD, 24)
BG, FG, SUB = (20, 24, 28), (242, 244, 239), (200, 205, 200)
VARIANTS = {
    'c': ('1-chart-table-r3-C', '1. The chart table, round 3: C', 'Harbour panes at about 65% of the width, the boat and the quay on the right'),
    'd': ('1-chart-table-r3-D', '1. The chart table, round 3: D', 'Harbour panes as one ledger across about 90% of the width, the port kept as a strip above'),
}
SHOTS = [('hud-day', 'Sea by day'), ('hud-night', 'Sea at night'), ('market-day', 'Harbour, Market'),
         ('quay-night', 'Harbour, Quay (at night: the night paper)'), ('shipyard-day', 'Harbour, Shipyard (3D preview area reserved)'),
         ('looks-day', 'Boat looks'), ('chart-day', 'Chart'), ('title-day', 'Title')]


def tile(path, width, text):
    im = Image.open(path).convert('RGB')
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    out = Image.new('RGB', (width, im.height + 26), BG)
    out.paste(im, (0, 26))
    ImageDraw.Draw(out).text((8, 4), text, font=font, fill=FG)
    return out


for v, (name, title, sub) in VARIANTS.items():
    head = Image.new('RGB', (W, 84), BG)
    dr = ImageDraw.Draw(head)
    dr.text((12, 8), title, font=big, fill=FG)
    dr.text((12, 40), f'{sub}.', font=font, fill=SUB)
    dr.text((12, 60), 'Minimal at sea and on the title, paper in the harbour, Boat looks and the chart. Desktop left, phone landscape right.', font=font, fill=SUB)
    rows = [head]
    for key, text in SHOTS:
        a = tile(src / f'{key}-{v}-desktop.jpg', DW, f'{text}, desktop')
        b = tile(src / f'{key}-{v}-phone.jpg', PW, 'phone')
        row = Image.new('RGB', (W, max(a.height, b.height)), BG)
        row.paste(a, (0, 0))
        row.paste(b, (DW + GAP, 0))
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
    for p in sorted(src.glob(f'*-{v}-*.jpg')):
        im = Image.open(p).convert('RGB')
        if im.width > W:
            im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
        im.save(full / p.name, quality=86, optimize=True)
    print(name, sheet.size, round((dst / f'{name}.jpg').stat().st_size / 1024), 'KB')
