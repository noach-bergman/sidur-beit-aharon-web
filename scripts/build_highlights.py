#!/usr/bin/env python3
"""Build data/highlights.json from scripts/highlights_spec.txt.

The siddur is a scanned PDF with no text layer, so passages are located by
LINE NUMBER: each page is rendered, its printed lines are detected from the
ink profile, and a spec row names a range of those lines (optionally narrowed
to a horizontal slice for a word or a column). Boxes are written as fractions
of the rendered (rotation-corrected) page, so they fit any screen size.

Spec rows:  id | pdfPage | segments | mode | rule | label
  segments  comma-separated: "all", "5", "5-9", "7t"/"7b" (top/bottom half of
            a line), each optionally ":x0-x1" (fractions of page width, from
            the left edge)
  mode      say (gold) · strong (today's exact words, deeper gold) · skip (grey)
  rule      a key from SiddurToday.activeRules(); "!key" means "key is absent"

Requires: pip install pymupdf numpy pillow
Usage:    python3 scripts/build_highlights.py
"""
import json, os, sys
import numpy as np
import pymupdf
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, 'siddur.pdf')
SPEC = os.path.join(ROOT, 'scripts', 'highlights_spec.txt')
OUT = [os.path.join(ROOT, 'data', 'highlights.json'),
       os.path.join(ROOT, 'docs', 'data', 'highlights.json')]
DPI = 110
DOC = pymupdf.open(PDF)


def page_array(pn):
    pix = DOC[pn - 1].get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY)
    return np.asarray(Image.frombytes('L', (pix.width, pix.height), pix.samples))


def lines(a):
    """Printed lines as (top, bottom, left, right) pixel bands, top to bottom.
    Niqqud and small marks that form their own thin band are folded into the
    nearest full line, so the numbering follows the printed lines."""
    H, W = a.shape
    ink = a < 140
    ink[:, :int(W * .03)] = False
    ink[:, int(W * .97):] = False
    rows = ink.sum(1) > max(2, W * 0.02)
    out, y = [], 0
    while y < H:
        if rows[y]:
            s = y
            while y < H and (rows[y] or (y + 1 < H and rows[y:y + 2].any())):
                y += 1
            if y - s >= 3:
                cols = np.where(ink[s:y].any(0))[0]
                out.append([s, y, int(cols.min()), int(cols.max())])
        y += 1
    if not out:
        return out
    med = sorted(e - s for s, e, _, _ in out)[len(out) // 2]
    main = [b for b in out if (b[1] - b[0]) >= 0.35 * med]
    for b in out:
        if (b[1] - b[0]) >= 0.35 * med:
            continue
        m = min(main, key=lambda m: min(abs(b[0] - m[1]), abs(m[0] - b[1])))
        m[0], m[1] = min(m[0], b[0]), max(m[1], b[1])
        m[2], m[3] = min(m[2], b[2]), max(m[3], b[3])
    return main


def text_block(bs, W):
    wide = [b for b in bs if (b[3] - b[2]) > 0.5 * W] or bs
    x0 = sorted(b[2] for b in wide)[len(wide) // 10]
    x1 = sorted(b[3] for b in wide)[-(len(wide) // 10) - 1]
    return max(0.0, x0 / W - 0.012), min(1.0, x1 / W + 0.012)


def boxes_for(pn, segments):
    a = page_array(pn)
    H, W = a.shape
    bs = lines(a)
    bx0, bx1 = text_block(bs, W)
    PAD = 0.0035
    out = []
    for seg in segments.split(','):
        seg = seg.strip()
        xr = None
        if ':' in seg:
            seg, xs = seg.split(':')
            xr = tuple(float(v) for v in xs.split('-'))
        if seg == 'all':
            top, bot = bs[1][0], bs[-1][1]
        else:
            half = None
            if seg[-1] in 'tb':
                half, seg = seg[-1], seg[:-1]
            lo, hi = (seg.split('-') + [seg])[:2] if '-' in seg else (seg, seg)
            lo, hi = int(lo), int(hi)
            top, bot = bs[lo][0], bs[hi][1]
            if half == 't':
                bot = (top + bot) // 2
            elif half == 'b':
                top = (top + bot) // 2
        x0, x1 = xr if xr else (bx0, bx1)
        y0, y1 = max(0, top / H - PAD), min(1, bot / H + PAD)
        out.append([round(x0, 4), round(y0, 4), round(x1 - x0, 4), round(y1 - y0, 4)])
    return out


def omer_cells():
    """Each night's count is its own small block, two columns per page.
    A cell starts at its tiny date label and ends at its sefira line."""
    def col_bands(a, x0, x1, ystart):
        H, W = a.shape
        ink = a[:, int(W * x0):int(W * x1)] < 140
        rows = ink.sum(1) > 2
        out, y = [], int(H * ystart)
        while y < H:
            if rows[y]:
                s = y
                while y < H and (rows[y] or rows[min(H - 1, y + 1)]):
                    y += 1
                if y - s >= 2:
                    out.append((s, y))
            y += 1
        return out

    def cells(bands):
        res, i = [], 0
        while i < len(bands):
            s, e = bands[i]
            if e - s <= 7:                      # a date label
                j = i + 1
                while j < len(bands) and not (9 <= bands[j][1] - bands[j][0] <= 19):
                    j += 1
                if j < len(bands):
                    res.append((s, bands[j][1]))
                    i = j
            i += 1
        return res

    layout = [(114, 0.83), (115, 0.075), (116, 0.075), (117, 0.075)]
    items, day = [], 1
    for pn, ystart in layout:
        a = page_array(pn)
        H, W = a.shape
        for x0, x1 in ((0.5, 0.97), (0.03, 0.5)):       # right column first
            for s, e in cells(col_bands(a, x0, x1, ystart)):
                if day > 49:
                    break
                bx0, bx1 = (0.5, 0.955) if x0 >= 0.5 else (0.075, 0.495)
                items.append({
                    'id': 'C4-omer-%d' % day, 'page': pn, 'mode': 'strong',
                    'rule': 'omerDay%d' % day, 'label': 'הספירה של הלילה',
                    'boxes': [[bx0, round(s / H - 0.004, 4),
                               round(bx1 - bx0, 4), round((e - s) / H + 0.008, 4)]]})
                day += 1
    if day != 50:
        sys.exit('omer: found %d cells, expected 49' % (day - 1))
    return items


def main():
    items, index = [], {}
    for raw in open(SPEC, encoding='utf-8'):
        raw = raw.strip()
        if not raw or raw.startswith('#'):
            continue
        hid, pg, segs, mode, rule, label = [p.strip() for p in raw.split('|')]
        key = (hid, int(pg), mode, rule)
        boxes = boxes_for(int(pg), segs)
        if key in index:
            index[key]['boxes'] += boxes
        else:
            index[key] = {'id': hid, 'page': int(pg), 'mode': mode, 'rule': rule,
                          'label': label, 'boxes': boxes}
            items.append(index[key])
    items += omer_cells()
    data = {'note': 'Generated by scripts/build_highlights.py — do not edit by hand.',
            'items': items}
    for path in OUT:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
            f.write('\n')
    print('%d items on %d pages' % (len(items), len({i['page'] for i in items})))


if __name__ == '__main__':
    main()
