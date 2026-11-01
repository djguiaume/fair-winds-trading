"""9-slice frames for the paper and paint edges (border-image, no runtime filters).
Each PNG is 192 px at 2x with a 40 px slice; the edge noise repeats every 112 px so the
middle of each side tiles seamlessly with border-image-repeat: round. The shadow is baked in."""
import math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

S, B = 192, 40
PERIOD = S - 2 * B
out = Path(__file__).parent / 'slices'
out.mkdir(exist_ok=True)


def edge_fn(kind, seed):
    rnd = random.Random(seed)
    if kind == 'torn':
        waves = [(rnd.uniform(.6, 1.8) / k ** .6, k, rnd.uniform(0, 6.3)) for k in range(1, 12)]
        jitter = [rnd.uniform(-1.6, 1.6) for _ in range(PERIOD)]
        base, amp = 12, 1.0
    else:
        waves = [(rnd.uniform(.5, 1.2), k, rnd.uniform(0, 6.3)) for k in range(1, 4)]
        jitter = [0] * PERIOD
        base, amp = 10, 1.0

    def f(t):
        u = (t - B) % PERIOD
        v = sum(a * math.sin(2 * math.pi * k * u / PERIOD + p) for a, k, p in waves)
        return base + amp * v + jitter[int(u)]
    return f


def frame(name, colour, alpha, kind, radius=0, seed=1):
    fs = [edge_fn(kind, seed + i) for i in range(4)]  # top, right, bottom, left
    tops = [fs[0](x) for x in range(S)]; rights = [S - fs[1](y) for y in range(S)]
    bottoms = [S - fs[2](x) for x in range(S)]; lefts = [fs[3](y) for y in range(S)]
    mask = Image.new('L', (S, S), 0)
    px = mask.load()
    for y in range(S):
        for x in range(S):
            if tops[x] <= y <= bottoms[x] and lefts[y] <= x <= rights[y]:
                px[x, y] = 255
    if radius:  # soften corners for painted cards
        r = Image.new('L', (S, S), 0)
        ImageDraw.Draw(r).rounded_rectangle([8, 8, S - 9, S - 9], radius=radius, fill=255)
        mask = Image.composite(mask, Image.new('L', (S, S), 0), r)
    shadow = Image.new('RGBA', (S, S), (20, 14, 8, 0))
    sm = mask.point(lambda v: v * 0.42).filter(ImageFilter.GaussianBlur(5))
    shadow.putalpha(Image.new('L', (S, S), 0))
    shadow.paste((20, 14, 8, 255), (0, 4), sm)
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    img.alpha_composite(shadow)
    paper = Image.new('RGBA', (S, S), tuple(int(colour[i:i + 2], 16) for i in (1, 3, 5)) + (0,))
    paper.putalpha(mask.point(lambda v: int(v * alpha)))
    img.alpha_composite(paper)
    img.save(out / f'{name}.png', optimize=True)


frame('chart-paper', '#efe6d1', 1, 'torn', seed=3)
frame('chart-paper-night', '#cbbd9c', .9, 'torn', seed=3)
frame('chart-paper-2', '#e3d6b8', 1, 'torn', seed=11)
frame('harbour-cloth', '#f3ead6', 1, 'brush', radius=22, seed=5)
frame('harbour-cloth-night', '#d6c9ad', .9, 'brush', radius=22, seed=5)
frame('harbour-wood', '#3e2b20', .94, 'brush', radius=22, seed=7)
print(sorted(p.name for p in out.glob('*.png')))
