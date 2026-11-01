"""Round 4: the README cover graded toward the game's colours (art director): the bright teal sea pulled
to the game's depth blue and quieted, and a warm golden-hour light from the top. Baked into a JPG
(no runtime filters). usage: python3 grade_cover.py <cover.png> <out.jpg>"""
import sys
import numpy as np
from PIL import Image

im = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32) / 255
hsv = np.asarray(Image.fromarray((im * 255).astype(np.uint8)).convert('HSV')).astype(np.float32)
h, s, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
teal = np.clip(1 - np.abs(h - 188) / 28, 0, 1)        # weight: how teal a pixel is
h = h + teal * 18                                        # teal 188° toward the game's blue ~206°
s = s * (1 - teal * 0.32)                                # quieter sea
v = v * (1 - teal * 0.12)
hsv = np.stack([h * 255 / 360, s * 255, v * 255], -1).clip(0, 255).astype(np.uint8)
rgb = np.asarray(Image.fromarray(hsv, 'HSV').convert('RGB')).astype(np.float32) / 255
y = np.linspace(0, 1, rgb.shape[0])[:, None, None]
warm = np.array([1.0, 0.72, 0.42])                        # golden hour, strongest at the top
light = 0.5 * (1 - y) + 0.14
soft = np.where(warm < .5, 2 * rgb * warm + rgb ** 2 * (1 - 2 * warm), 2 * rgb * (1 - warm) + np.sqrt(rgb) * (2 * warm - 1))
rgb = rgb * (1 - light) + soft * light
rgb = rgb * (1 - 0.18 * y)                               # a little darker toward the foreground
Image.fromarray((rgb.clip(0, 1) * 255).astype(np.uint8)).save(sys.argv[2], quality=90)
