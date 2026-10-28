"""Contact sheets for the style E review: python3 sheets.py <shots dir> <out dir>.
Per direction: a desktop sheet (3 x 4 grid) and, across directions, one phone sheet."""
import sys
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
themes = [('a-logbook', 'A Logbook'), ('b-wood', 'B Painted wood and brass'), ('c-enamel', 'C Signal flags and enamel')]
desk = [('1-menu', 'Title menu'), ('2-level', 'New voyage'), ('3-settings', 'Settings'), ('4-sea', 'Sea HUD'),
        ('5-market', 'Port: Market'), ('6-quay', 'Port: Quay'), ('7-chart', 'Chart'), ('9-quest', 'Quest card'),
        ('8-pad', 'Xbox focus (pad)')]
W = 416
def label(img, text):
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, img.width, 22], fill=(20, 20, 20))
    d.text((6, 5), text, fill=(255, 255, 255))
for t, name in themes:
    tiles = []
    for key, cap in desk:
        im = Image.open(f'{src}/{t}/{key}-desktop.png').convert('RGB')
        im = im.resize((W, int(im.height * W / im.width)))
        label(im, f'{name}: {cap}')
        tiles.append(im)
    for key, cap in [('4-sea', 'Sea HUD, night'), ('5-market', 'Port: Market, night')]:
        im = Image.open(f'{src}/{t}-night/{key}-desktop.png').convert('RGB')
        im = im.resize((W, int(im.height * W / im.width)))
        label(im, f'{name}: {cap}')
        tiles.append(im)
    cols, h = 3, tiles[0].height
    rows = -(-len(tiles) // cols)
    sheet = Image.new('RGB', (cols * W + (cols + 1) * 4, rows * h + (rows + 1) * 4), (12, 12, 12))
    for i, im in enumerate(tiles):
        sheet.paste(im, (4 + (i % cols) * (W + 4), 4 + (i // cols) * (h + 4)))
    sheet.save(f'{out}/sheet-{t}-desktop.jpg', quality=78)

pw = 200
keys = [('1-menu', 'Menu'), ('2-level', 'Voyage'), ('4-sea', 'Sea'), ('5-market', 'Market'), ('6-quay', 'Quay'), ('9-quest', 'Quest')]
rows = []
for t, name in themes:
    row = []
    for key, cap in keys:
        im = Image.open(f'{src}/{t}/{key}-portrait.png').convert('RGB')
        im = im.resize((pw, int(im.height * pw / im.width)))
        label(im, f'{name[:1]} {cap}')
        row.append(im)
    rows.append(row)
h = rows[0][0].height
sheet = Image.new('RGB', (len(keys) * (pw + 4) + 4, len(rows) * (h + 4) + 4), (12, 12, 12))
for r, row in enumerate(rows):
    for c, im in enumerate(row):
        sheet.paste(im, (4 + c * (pw + 4), 4 + r * (h + 4)))
sheet.save(f'{out}/sheet-phone-all.jpg', quality=78)
