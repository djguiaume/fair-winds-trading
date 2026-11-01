"""Round 3 contact sheets: the chart table, one sheet per variant (C, D), desktop beside phone (JPG, 1280 px wide).
Round 4 (--titles): one sheet with the four title screens.
usage: python3 sheet_r3.py <out-r3 dir> <dest dir> | python3 sheet_r3.py --titles <out-r4 dir> <dest dir>"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

titles = sys.argv[1] == '--titles'
args = sys.argv[2:] if titles else sys.argv[1:]
src, dst = Path(args[0]) / 'chart', Path(args[1])
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
if titles:  # one sheet; each "shot" is a title screen (k = 1..4)
    VARIANTS = {'title': ('1-chart-table-titles', '1. The chart table: four title screens', 'Staged four ways; the menu rows are large plain rows, the same as Continue')}
    SHOTS = [('1', '1. Ledger: painted key art above, logo and menu on one ledger'), ('2', '2. The chart table: the chart itself, the logo as its cartouche'),
             ('3', '3. Logbook page: a full-height page, painted key art beside it'), ('4', '4. Live harbour: the real game, the menu as a row of tiles'),
             ('5', '3 on the art director\'s terms: the cover graded to the game, a straight inked edge'),
             ('6', 'The pick: 5 with the torn page edge of 3')]


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
    note = ('Painted key art: the README cover (generated in the game\'s style). Desktop left, phone landscape right.' if titles
            else 'Minimal at sea and on the title, paper in the harbour, Boat looks and the chart. Desktop left, phone landscape right.')
    dr.text((12, 60), note, font=font, fill=SUB)
    rows = [head]
    for key, text in SHOTS:
        stem = f'title-day-{key}' if titles else f'{key}-{v}'
        a = tile(src / f'{stem}-desktop.jpg', DW, text if titles else f'{text}, desktop')
        b = tile(src / f'{stem}-phone.jpg', PW, 'phone')
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
    for p in sorted(src.glob('*.jpg' if titles else f'*-{v}-*.jpg')):
        im = Image.open(p).convert('RGB')
        if im.width > W:
            im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
        im.save(full / p.name, quality=86, optimize=True)
    print(name, sheet.size, round((dst / f'{name}.jpg').stat().st_size / 1024), 'KB')
