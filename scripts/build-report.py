"""
Builds the self-contained report.html from docs/report/report.template.html:
every `src="img:NAME"` is replaced by a cropped, compressed JPEG data URI from docs/report/img/NAME.jpg.
Run: python scripts/build-report.py   (then: node scripts/report-pdf.mjs to print and count pages)
"""
import base64
import io
import os
import re

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "docs", "report", "img")
TEMPLATE = os.path.join(ROOT, "docs", "report", "report.template.html")
OUT = os.path.join(ROOT, "report.html")

# (left, top, right, bottom) in source pixels; None = full image. Crops keep only the part the text refers to.
CROPS = {
    "01-demo-cases": None,
    "13-run-handoff-draft": (0, 0, 1560, 1500),
    "16-run-receiver": (0, 0, 1560, 1100),
    "20-urgent-banner": (0, 0, 1920, 900),
    "30-insights-top": (0, 0, 1800, 1650),
    "40-fallback-notes-only-draft": (0, 0, 1560, 1450),
}
MAX_WIDTH = 1300


def data_uri(name: str) -> str:
    im = Image.open(os.path.join(IMG, f"{name}.jpg")).convert("RGB")
    box = CROPS.get(name)
    if box:
        im = im.crop((box[0], box[1], min(box[2], im.width), min(box[3], im.height)))
    if im.width > MAX_WIDTH:
        im = im.resize((MAX_WIDTH, round(im.height * MAX_WIDTH / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=74, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


html = open(TEMPLATE, encoding="utf8").read()
names = sorted(set(re.findall(r'src="img:([\w-]+)"', html)))
for n in names:
    html = html.replace(f'src="img:{n}"', f'src="{data_uri(n)}"')
assert "img:" not in re.sub(r"data:image", "", html), "unreplaced image reference"
open(OUT, "w", encoding="utf8").write(html)
print(f"report.html written: {len(names)} images embedded, {os.path.getsize(OUT) / 1e6:.2f} MB")
