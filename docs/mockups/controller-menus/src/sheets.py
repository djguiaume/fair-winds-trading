"""Contact sheets of the controller focus mockups (decision 0163): one desktop and one phone sheet
per variant, from the PNGs `npm run shots -- --list shots-<v>.json` writes."""
import sys
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
NAMES = {'a': 'A - brass ring', 'b': 'B - lifted plate', 'c': "C - ship's pointer"}
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
except OSError:
    font = ImageFont.load_default()


def sheet(tiles, cols, tile_w, tile_h, title, path):
    rows = (len(tiles) + cols - 1) // cols
    pad, head = 16, 50
    im = Image.new('RGB', (cols * (tile_w + pad) + pad, rows * (tile_h + pad) + pad + head), '#0b1c27')
    ImageDraw.Draw(im).text((pad, 12), title, fill='#f3d37e', font=font)
    for i, t in enumerate(tiles):
        x = pad + (i % cols) * (tile_w + pad)
        y = head + pad + (i // cols) * (tile_h + pad)
        im.paste(t.resize((tile_w, tile_h)), (x, y))
    im.save(path)


for v, name in NAMES.items():
    desk = [Image.open(f'{src}/{v}-{s}-desktop.png') for s in ('menu', 'settings', 'market', 'quay', 'build')]
    sheet(desk, 2, 640, 400, f'{name} - desktop (EN)', f'{out}/{v}-desktop.png')
    p1 = Image.open(f'{src}/{v}-menu-fr-portrait.png')
    p2 = Image.open(f'{src}/{v}-settings-fr-portrait.png')
    ls = Image.open(f'{src}/{v}-market-fr-landscape.png')
    im = Image.new('RGB', (16 * 4 + 390 * 2 + 844, 844 + 66), '#0b1c27')
    ImageDraw.Draw(im).text((16, 12), f'{name} - phone portrait and landscape (FR)', fill='#f3d37e', font=font)
    im.paste(p1, (16, 50)); im.paste(p2, (32 + 390, 50)); im.paste(ls, (48 + 780, 50))
    im.save(f'{out}/{v}-phone.png')
