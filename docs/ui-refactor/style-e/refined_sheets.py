"""Review sheets for the refined direction: python3 refined_sheets.py <shots dir> <out dir>."""
import sys
from PIL import Image, ImageDraw

src, out = sys.argv[1:3]
T = 'e-refined'
def bar(im, text):
    o = Image.new('RGB', (im.width, im.height + 22), (20, 20, 20))
    o.paste(im, (0, 22))
    ImageDraw.Draw(o).text((6, 5), text, fill=(255, 255, 255))
    return o
def load(path, w):
    im = Image.open(path).convert('RGB')
    return im.resize((w, int(im.height * w / im.width)))
def grid(tiles, cols, w, pad=4):
    h = max(t.height for t in tiles)
    rows = -(-len(tiles) // cols)
    s = Image.new('RGB', (cols * w + (cols + 1) * pad, rows * h + (rows + 1) * pad), (12, 12, 12))
    for i, t in enumerate(tiles):
        s.paste(t, (pad + (i % cols) * (w + pad), pad + (i // cols) * (h + pad)))
    return s
desk = [('1-menu', 'Title menu'), ('2-level', 'New voyage: cards'), ('3-settings', 'Settings'), ('4-sea', 'Sea HUD'),
        ('5-market', 'Port: Market'), ('6-quay', 'Port: Quay'), ('7-chart', 'Chart'), ('9-quest', 'Quest card'),
        ('8-pad', 'Xbox focus (pad)')]
tiles = [bar(load(f'{src}/{T}/{k}-desktop.png', 416), c) for k, c in desk]
tiles += [bar(load(f'{src}/{T}-night/{k}-desktop.png', 416), c) for k, c in [('4-sea', 'Sea HUD, night'), ('5-market', 'Port: Market, night')]]
tiles.append(bar(load(f'{src}/e-extra/2-level-pennants-desktop.png', 416), 'New voyage: pennants'))
grid(tiles, 3, 416).save(f'{out}/refined-desktop.jpg', quality=78)
ph = [('1-menu', 'Menu'), ('2-level', 'Voyage'), ('3-settings', 'Settings'), ('4-sea', 'Sea'), ('5-market', 'Market'), ('6-quay', 'Quay'), ('9-quest', 'Quest')]
tiles = [bar(load(f'{src}/{T}/{k}-portrait.png', 200), c) for k, c in ph]
tiles += [bar(load(f'{src}/{T}-night/{k}-portrait.png', 200), c + ', night') for k, c in [('4-sea', 'Sea'), ('5-market', 'Market')]]
tiles.append(bar(load(f'{src}/e-extra/2-level-pennants-portrait.png', 200), 'Voyage: pennants'))
grid(tiles, 5, 200).save(f'{out}/refined-phone.jpg', quality=78)
