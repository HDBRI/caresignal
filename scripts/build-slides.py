"""
Builds the self-contained slides.html from docs/report/slides.template.html:
inlines Reveal.js (node_modules/reveal.js/dist) and embeds screenshots as data URIs, so the deck works offline.
Run: python scripts/build-slides.py   (requires `npm install` once for reveal.js)
"""
import base64
import io
import os
import re

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DIST = os.path.join(ROOT, "node_modules", "reveal.js", "dist")
IMG = os.path.join(ROOT, "docs", "report", "img")
TEMPLATE = os.path.join(ROOT, "docs", "report", "slides.template.html")
OUT = os.path.join(ROOT, "slides.html")


def data_uri(name: str, max_width: int = 1200) -> str:
    im = Image.open(os.path.join(IMG, f"{name}.jpg")).convert("RGB")
    if im.width > max_width:
        im = im.resize((max_width, round(im.height * max_width / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=76, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


html = open(TEMPLATE, encoding="utf8").read()
read = lambda f: open(os.path.join(DIST, f), encoding="utf8").read()  # noqa: E731
html = html.replace("/*RESET_CSS*/", read("reset.css")).replace("/*REVEAL_CSS*/", read("reveal.css"))
js = read("reveal.js").replace("</script", "<\\/script")
html = html.replace("/*REVEAL_JS*/", js)
for n in sorted(set(re.findall(r'src="img:([\w-]+)"', html))):
    html = html.replace(f'src="img:{n}"', f'src="{data_uri(n)}"')
assert 'src="img:' not in html
open(OUT, "w", encoding="utf8").write(html)
print(f"slides.html written ({os.path.getsize(OUT) / 1e6:.2f} MB)")
