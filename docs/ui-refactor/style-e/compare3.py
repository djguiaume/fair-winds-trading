"""Three-way comparison: python3 compare3.py <shots dir> <out.jpg> <size>. Columns: direction 1, B, refined."""
import sys
from PIL import Image, ImageDraw

src, out, size = sys.argv[1:4]
cols = [('d1-paper', 'Direction 1 (paper menu)'), ('b-wood', 'B (painted wood and brass)'), ('e-refined', 'Refined')]
screens = [('1-menu', 'Title menu'), ('4-sea', 'Sea HUD'), ('5-market', 'Port: Market'), ('9-quest', 'Quest card')]
W = 420 if size == 'desktop' else 200
def tile(theme, key):
    im = Image.open(f'{src}/{theme}/{key}-{size}.png').convert('RGB')
    return im.resize((W, int(im.height * W / im.width)))
rows = []
for key, cap in screens:
    tiles = [tile(t, key) for t, _ in cols]
    h = tiles[0].height
    row = Image.new('RGB', (3 * W + 16, h + 26), (12, 12, 12))
    d = ImageDraw.Draw(row)
    d.text((6, 6), cap + ':   ' + '   |   '.join(n for _, n in cols), fill=(255, 255, 255))
    for i, t in enumerate(tiles):
        row.paste(t, (4 + i * (W + 4), 26))
    rows.append(row)
sheet = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)), (12, 12, 12))
y = 0
for r in rows:
    sheet.paste(r, (0, y))
    y += r.height
sheet.save(out, quality=80)
