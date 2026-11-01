"""Downloads the mockup fonts (latin, woff2, all SIL OFL) into fonts/ and writes fonts.css.
Barlow comes from the game's own src/ui/fonts."""
import re, shutil, urllib.request
from pathlib import Path

here = Path(__file__).parent
repo = here.parents[2]
URL = ('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Alegreya+Sans:wght@500;700;800'
       '&family=Saira+Condensed:wght@600;700;800&family=Caprasimo&family=Nunito+Sans:wght@600;700;800&display=swap')
req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36'})
css = urllib.request.urlopen(req).read().decode()
(here / 'fonts').mkdir(exist_ok=True)
faces = []
for block in re.findall(r'@font-face\s*{([^}]*)}', css):
    if 'U+0000-00FF' not in block:
        continue
    fam = re.search(r"font-family: '([^']+)'", block).group(1)
    style = re.search(r'font-style: (\w+)', block).group(1)
    weight = re.search(r'font-weight: (\d+)', block).group(1)
    name = f"{fam.replace(' ', '')}-{weight}{'i' if style == 'italic' else ''}.woff2"
    urllib.request.urlretrieve(re.search(r'url\((https[^)]+)\)', block).group(1), here / 'fonts' / name)
    faces.append((fam, style, weight, name))
for w in (500, 600, 700):
    shutil.copy(repo / f'src/ui/fonts/barlow-{w}.woff2', here / 'fonts')
    faces.append(('Barlow', 'normal', str(w), f'barlow-{w}.woff2'))
(here / 'fonts.css').write_text(''.join(
    f"@font-face{{font-family:'{f}';font-style:{s};font-weight:{w};src:url(fonts/{n}) format('woff2');}}\n" for f, s, w, n in faces))
print(len(faces), 'fonts')
