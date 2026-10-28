"""Side by side: python3 compare.py <shots dir> <out.jpg> <left theme> <right theme> [desktop|portrait].
One row per screen, the game as it is on the left, the proposal on the right."""
import sys
from PIL import Image, ImageDraw

src, out, left, right = sys.argv[1:5]
size = sys.argv[5] if len(sys.argv) > 5 else 'desktop'
labels = (sys.argv[6], sys.argv[7]) if len(sys.argv) > 7 else ('today (left)', 'proposal (right)')
screens = [('1-menu', 'Title menu'), ('2-level', 'New voyage'), ('3-settings', 'Settings'), ('4-sea', 'Sea HUD'),
           ('5-market', 'Port: Market'), ('6-quay', 'Port: Quay'), ('7-chart', 'Chart'), ('9-quest', 'Quest card')]
W = 620 if size == 'desktop' else 240
def tile(theme, key):
    im = Image.open(f'{src}/{theme}/{key}-{size}.png').convert('RGB')
    return im.resize((W, int(im.height * W / im.width)))
rows = []
for key, cap in screens:
    a, b = tile(left, key), tile(right, key)
    bar = Image.new('RGB', (2 * W + 12, 22), (20, 20, 20))
    d = ImageDraw.Draw(bar)
    d.text((6, 5), f'{cap}:  {labels[0]}   |   {labels[1]}', fill=(255, 255, 255))
    row = Image.new('RGB', (2 * W + 12, 22 + a.height + 4), (12, 12, 12))
    row.paste(bar, (0, 0))
    row.paste(a, (4, 22))
    row.paste(b, (W + 8, 22))
    rows.append(row)
if size == 'portrait':  # phones: 4 screens per strip would be tall, so put the rows in two columns
    half = (len(rows) + 1) // 2
    cols = [rows[:half], rows[half:]]
    h = max(sum(r.height for r in c) for c in cols)
    sheet = Image.new('RGB', (2 * rows[0].width, h), (12, 12, 12))
    for i, c in enumerate(cols):
        y = 0
        for r in c:
            sheet.paste(r, (i * rows[0].width, y))
            y += r.height
else:
    sheet = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)), (12, 12, 12))
    y = 0
    for r in rows:
        sheet.paste(r, (0, y))
        y += r.height
sheet.save(out, quality=80)
