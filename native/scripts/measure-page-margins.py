"""Measure scan borders only. Never rewrites the PDF or changes a word.

Input: pdftoppm -r 120 -gray -png ../../docs/siddur.pdf /tmp/.../page
Run with the PDF runtime's Python (Pillow and NumPy).
"""
import hashlib
import json
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image

native = Path(__file__).resolve().parents[1]
source = native.parent / 'docs'
renders = Path(sys.argv[1])
highlights = json.loads((source / 'data/highlights.json').read_text())['items']
pages = {}
for number in range(1, 316):
    image = np.asarray(Image.open(renders / f'page-{number:03d}.png').convert('L'))
    height, width = image.shape
    # The scans have a 254/255 paper background. Include every darker pixel,
    # including faint marks, nikud, headers, folio numbers and scanner specks.
    ys, xs = np.where(image < 254)
    if len(xs) == 0:
        pages[str(number)] = [0, 0, 1, 1]
        continue
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
    # Keep a comfortable paper edge plus any day-marker rule outside the text.
    pad = max(8, math.ceil(width * .012))
    left, top = max(0, x0 - pad) / width, max(0, y0 - pad) / height
    right, bottom = min(width, x1 + pad) / width, min(height, y1 + pad) / height
    for item in highlights:
        if item['page'] != number:
            continue
        for x, y, w, h in item['boxes']:
            left, top = min(left, max(0, x - .005)), min(top, max(0, y - .005))
            right = max(right, min(1, x + w + (.016 if w > .6 else .005)))
            bottom = max(bottom, min(1, y + h + .005))
    # Outward rounding only: a serialized crop must never trim detected ink.
    box = [math.floor(left * 1e6) / 1e6, math.floor(top * 1e6) / 1e6,
           math.ceil(right * 1e6) / 1e6, math.ceil(bottom * 1e6) / 1e6]
    assert box[0] <= x0 / width and box[1] <= y0 / height
    assert box[2] >= x1 / width and box[3] >= y1 / height
    pages[str(number)] = box

result = {'pdfSha256': hashlib.sha256((source / 'siddur.pdf').read_bytes()).hexdigest(),
          'pageCount': 315, 'renderDpi': 120, 'inkThreshold': 254, 'pages': pages}
output = native / 'resources/page-crops.json'
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
gains = [1 / (b[2] - b[0]) for b in pages.values()]
print(f'Checked all 315 pages: all detected ink and highlight areas preserved; median width gain {np.median(gains):.2f}x.')
