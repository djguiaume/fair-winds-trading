"""Variant sheets for #572: rows today/A/B/C, columns = cells listed per sheet."""
import sys
from PIL import Image, ImageDraw, ImageFont

D = '/tmp/claude-0/sheet'
OUT = sys.argv[1]
VARIANTS = [('today', 'Today'), ('A', 'A soft edges'), ('B', 'B soft + patterns ±6%'), ('C', 'C soft + patterns ±10%')]
CW, CH = 440, 275
LABEL = 150
try:
    FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
    SMALL = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
except OSError:
    FONT = SMALL = ImageFont.load_default()

# (title, file, crop box or None for the whole frame)
SHEETS = {
    'town': [
        ('Follow cam, noon', 'town-noon-desktop.png', None),
        ('House and sign, zoomed 1.6x', 'town-noon-desktop.png', (380, 230, 660, 405)),
        ('Golden hour, close (1:1)', 'town-golden-desktop.png', (410, 240, 850, 515)),
        ('From above, closest zoom', 'top-town-close-desktop.png', None),
    ],
    'sail': [
        ('Follow cam, noon', 'sail-noon-desktop.png', None),
        ('Close: sail and hull (1:1)', 'sail-noon-desktop.png', (430, 430, 870, 705)),
        ('Golden hour, close (1:1)', 'sail-golden-desktop.png', (430, 430, 870, 705)),
        ('From above, usual zoom', 'top-town-desktop.png', None),
    ],
}


def main(name):
    cells = SHEETS[name]
    W = LABEL + CW * len(cells)
    H = 30 + CH * len(VARIANTS)
    sheet = Image.new('RGB', (W, H), '#f4efe4')
    draw = ImageDraw.Draw(sheet)
    for c, (title, _, _) in enumerate(cells):
        draw.text((LABEL + c * CW + 8, 7), title, fill='#222', font=FONT)
    for r, (folder, label) in enumerate(VARIANTS):
        y = 30 + r * CH
        draw.text((10, y + CH // 2 - 10), label.split(' ', 1)[0], fill='#222', font=FONT)
        if ' ' in label:
            draw.text((10, y + CH // 2 + 10), label.split(' ', 1)[1], fill='#555', font=SMALL)
        for c, (_, file, box) in enumerate(cells):
            im = Image.open(f'{D}/{folder}/{file}').convert('RGB')
            im = im.crop(box) if box else im
            sheet.paste(im.resize((CW, CH), Image.LANCZOS), (LABEL + c * CW, y))
    sheet.save(OUT, quality=82, optimize=True)


main(sys.argv[2])
