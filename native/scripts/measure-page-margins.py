"""Generate consistent reading frames without rewriting the source PDF.

Render first: pdftoppm -r 120 -gray -png ../docs/siddur.pdf /tmp/scans/page
Run with the bundled PDF Python runtime (Pillow, NumPy, pypdf).
The projection locates printed matter, not single scanner specks. All excluded
pixels are audited; any unexpected connected mark fails generation for review.
"""
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from pypdf import PdfReader

native = Path(__file__).resolve().parents[1]
source = native.parent / 'docs'
renders = Path(sys.argv[1])
pdf = PdfReader(source / 'siddur.pdf')
# One physical frame and magnification for ordinary reading pages. Wider table
# and ornamental pages fit inside the same display rectangle without stretching.
FRAME_W, FRAME_H = 390, 648
TOP_INSET, SIDE_INSET = 14.4, 12
pages, audit = {}, []


def components(mask):
    """Only the few excluded pixels: retain 8-connected punctuation as a unit."""
    points = set(zip(*np.where(mask)))
    result = []
    while points:
        seed = points.pop()
        group, stack = [seed], [seed]
        while stack:
            y, x = stack.pop()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    neighbor = (y + dy, x + dx)
                    if neighbor in points:
                        points.remove(neighbor)
                        group.append(neighbor)
                        stack.append(neighbor)
        ys, xs = zip(*group)
        result.append([int(min(xs)), int(min(ys)), int(max(xs)) + 1, int(max(ys)) + 1, len(group)])
    return result


for number, page in enumerate(pdf.pages, 1):
    image = np.asarray(Image.open(renders / f'page-{number:03d}.png').convert('L'))
    height, width = image.shape
    pw, ph = float(page.mediabox.width), float(page.mediabox.height)
    if page.rotation % 180:
        pw, ph = ph, pw
    if number == 1:
        # The illustrated cover has faint artwork and scanner-edge residue.
        # Preserve the whole original cover, centered within the shared frame.
        scale = max(pw / FRAME_W, ph / FRAME_H)
        fw, fh = FRAME_W * scale, FRAME_H * scale
        pages[str(number)] = {'x': (pw - fw) / 2, 'y': (ph - fh) / 2,
                              'width': fw, 'height': fh, 'kind': 'cover'}
        continue
    ink = image < 220
    # Exclude only the reviewed scanner strip at the physical paper edge when
    # finding the text anchor. Actual clipping is audited independently below.
    ink[:, :16] = False
    ink[:, -16:] = False
    xs = np.flatnonzero(ink.sum(axis=0) >= 12)
    ys = np.flatnonzero(ink.sum(axis=1) >= 12)
    x0, y0, x1, y1 = xs[0] * pw / width, ys[0] * ph / height, (xs[-1] + 1) * pw / width, (ys[-1] + 1) * ph / height
    fit = max(1, (x1 - x0 + 2 * SIDE_INSET) / FRAME_W,
              (y1 - y0 + 2 * TOP_INSET) / FRAME_H)
    # A surprising wide page must be examined, not silently shrink normal type.
    if fit > 1.001:
        assert number in (231, 304), f'Unexpected wide page: {number}'
    fw, fh = FRAME_W * fit, FRAME_H * fit
    left, top = (x0 + x1 - fw) / 2, y0 - TOP_INSET * fit
    box = {'x': round(left, 6), 'y': round(top, 6), 'width': round(fw, 6),
           'height': round(fh, 6), 'kind': 'wide' if fit > 1.001 else 'reading'}
    pages[str(number)] = box
    # Safety check includes faint antialiasing and nikud, not only dark anchors.
    excluded = image < 254
    ix0, iy0 = max(0, int(np.ceil(left * width / pw))), max(0, int(np.ceil(top * height / ph)))
    ix1, iy1 = min(width, int(np.floor((left + fw) * width / pw))), min(height, int(np.floor((top + fh) * height / ph)))
    excluded[iy0:iy1, ix0:ix1] = False
    marks = components(excluded)
    for a, b, c, d, count in marks:
        # Page 314 has a visible scan-edge streak at the far right. Everything
        # else outside the frame must be an isolated <= 8-pixel scanner speck.
        edge_streak = number == 314 and a >= width - 4
        assert edge_streak or (count <= 32 and c-a <= 8 and d-b <= 8), (number, a, b, c, d, count)
    assert left < x0 and top < y0 and left + fw > x1 and top + fh > y1
    audit.append({'page': number, 'printedBounds': [x0, y0, x1, y1],
                  'excludedScannerMarks': marks})

result = {'schemaVersion': 2, 'pdfSha256': hashlib.sha256((source / 'siddur.pdf').read_bytes()).hexdigest(),
          'pageCount': len(pdf.pages), 'renderDpi': 120, 'frame': [FRAME_W, FRAME_H],
          'pages': pages}
(native / 'resources/page-crops.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
report = native / 'build/framing-review'
report.mkdir(parents=True, exist_ok=True)
(report / 'audit.json').write_text(json.dumps(audit, indent=2) + '\n')
print(f'Checked {len(pages)} pages: 312 identical reading frames, 2 wide layouts, 1 original cover; excluded scanner marks audited.')
