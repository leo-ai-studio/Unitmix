"""BƯỚC 1 (bản DXF) · Bóc TỔNG MẶT BẰNG QH từ tệp .dxf bằng ezdxf — không cần AutoCAD.

Ra cùng định dạng tệp thô như `boc_tmb_qh_autocad.py` (meta · segs · texts · hatches · attrs) để bước 2 dùng chung:

    PYTHONIOENCODING=utf-8 python scripts/boc_tmb_qh_dxf.py "bản vẽ.dxf" C:/Temp/mdi_qh/raw_tmb.json
    PYTHONIOENCODING=utf-8 python scripts/boc_tmb_qh.py C:/Temp/mdi_qh/raw_tmb.json --kt 105.0 --json lo_dat.json
"""
import json
import math
import sys
from pathlib import Path

import ezdxf
from ezdxf.colors import aci2rgb

BUOC_CUNG = math.radians(5.0)


def mau(e, layers):
    if e.dxf.hasattr("true_color") and e.dxf.true_color:
        r = e.dxf.true_color
        return "rgb%d,%d,%d" % ((r >> 16) & 255, (r >> 8) & 255, r & 255)
    c = e.dxf.color if e.dxf.hasattr("color") else 256
    if c in (0, 256):
        c = layers.get(e.dxf.layer, 7)
    return "i%d" % abs(c)


def chia_cung(x1, y1, x2, y2, bulge):
    """đoạn có bulge → chuỗi điểm (không gồm điểm đầu), cùng công thức bước 1 / app."""
    ch = math.hypot(x2 - x1, y2 - y1)
    if abs(bulge) < 1e-9 or ch < 1e-9:
        return [[x2, y2]]
    th = 4 * math.atan(bulge)
    r = ch / (2 * math.sin(abs(th) / 2))
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    d = math.sqrt(max(r * r - (ch / 2) ** 2, 0))
    ux, uy = (x2 - x1) / ch, (y2 - y1) / ch
    sg = 1 if (bulge > 0) == (abs(th) < math.pi) else -1
    cx, cy = mx - sg * uy * d, my + sg * ux * d
    a0 = math.atan2(y1 - cy, x1 - cx)
    n = max(1, math.ceil(abs(th) / BUOC_CUNG))
    return [[cx + r * math.cos(a0 + th * k / n), cy + r * math.sin(a0 + th * k / n)] for k in range(1, n + 1)]


def pts_lw(pl):
    v = [(p[0], p[1], p[4]) for p in pl.get_points("xyseb")]
    kin = bool(pl.closed)
    out = [[v[0][0], v[0][1]]]
    m = len(v) if kin else len(v) - 1
    for i in range(m):
        a, b = v[i], v[(i + 1) % len(v)]
        out += chia_cung(a[0], a[1], b[0], b[1], a[2])
    return out, kin


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    doc = ezdxf.readfile(sys.argv[1])
    msp = doc.modelspace()
    layers = {l.dxf.name: l.dxf.color for l in doc.layers}
    segs, texts, hatches, attrs = [], [], [], []
    for e in msp:
        t, ly = e.dxftype(), e.dxf.layer
        try:
            if t == "LINE":
                segs.append({"l": ly, "p": [[e.dxf.start.x, e.dxf.start.y], [e.dxf.end.x, e.dxf.end.y]]})
            elif t == "LWPOLYLINE":
                p, kin = pts_lw(e)
                if len(p) > 1:
                    s = {"l": ly, "p": p}
                    if kin:
                        s["c"] = 1
                    segs.append(s)
            elif t == "POLYLINE" and not e.is_3d_polyline and not e.is_polygon_mesh:
                v = [(q.dxf.location.x, q.dxf.location.y, q.dxf.bulge) for q in e.vertices]
                p = [[v[0][0], v[0][1]]]
                for i in range(len(v) if e.is_closed else len(v) - 1):
                    a, b = v[i], v[(i + 1) % len(v)]
                    p += chia_cung(a[0], a[1], b[0], b[1], a[2])
                segs.append({"l": ly, "p": p, **({"c": 1} if e.is_closed else {})})
            elif t == "ARC":
                a0, a1 = math.radians(e.dxf.start_angle), math.radians(e.dxf.end_angle)
                if a1 <= a0:
                    a1 += 2 * math.pi
                n = max(2, int((a1 - a0) / BUOC_CUNG))
                c, r = e.dxf.center, e.dxf.radius
                segs.append({"l": ly, "p": [[c.x + r * math.cos(a0 + (a1 - a0) * k / n), c.y + r * math.sin(a0 + (a1 - a0) * k / n)] for k in range(n + 1)]})
            elif t == "CIRCLE":
                c, r = e.dxf.center, e.dxf.radius
                segs.append({"l": ly, "c": 1, "p": [[c.x + r * math.cos(2 * math.pi * k / 72), c.y + r * math.sin(2 * math.pi * k / 72)] for k in range(72)]})
            elif t == "TEXT":
                texts.append({"l": ly, "t": e.dxf.text, "x": e.dxf.insert.x, "y": e.dxf.insert.y, "h": e.dxf.height, "r": e.dxf.get("rotation", 0)})
            elif t == "MTEXT":
                texts.append({"l": ly, "t": e.plain_text().replace("\n", " "), "x": e.dxf.insert.x, "y": e.dxf.insert.y,
                              "h": e.dxf.get("char_height", 0), "r": e.dxf.get("rotation", 0)})
            elif t == "HATCH":
                loops = []
                for pa in e.paths:
                    if hasattr(pa, "vertices"):
                        pts = [[v[0], v[1]] for v in pa.vertices]
                    else:
                        pts = []
                        for ed in pa.edges:
                            if ed.EDGE_TYPE == "LineEdge":
                                pts += [[ed.start[0], ed.start[1]], [ed.end[0], ed.end[1]]]
                            elif ed.EDGE_TYPE in ("ArcEdge", "EllipseEdge"):
                                if ed.EDGE_TYPE == "ArcEdge":
                                    a0, a1 = math.radians(ed.start_angle), math.radians(ed.end_angle)
                                    if not ed.ccw:
                                        a0, a1 = -a1 if False else a0, a1
                                    if a1 <= a0:
                                        a1 += 2 * math.pi
                                    n = max(2, int((a1 - a0) / BUOC_CUNG))
                                    pts += [[ed.center[0] + ed.radius * math.cos(a0 + (a1 - a0) * k / n),
                                             ed.center[1] + ed.radius * math.sin(a0 + (a1 - a0) * k / n)] for k in range(n + 1)]
                    # bỏ điểm trùng liên tiếp
                    ded = [q for i, q in enumerate(pts) if i == 0 or q != pts[i - 1]]
                    if len(ded) > 2:
                        loops.append(ded)
                if loops:
                    hatches.append({"l": ly, "loops": loops, "m": mau(e, layers), "pat": e.dxf.pattern_name})
            elif t == "INSERT" and e.attribs:
                attrs.append({"l": ly, "b": e.dxf.name, "x": e.dxf.insert.x, "y": e.dxf.insert.y,
                              "a": {a.dxf.tag: a.dxf.text for a in e.attribs}})
        except Exception as ex:  # một thực thể hỏng không làm hỏng cả bản vẽ
            print("bỏ", t, ly, ex)
    if segs:
        xs = [q[0] for s in segs for q in s["p"]]
        ys = [q[1] for s in segs for q in s["p"]]
        kb = [min(xs), min(ys), max(xs), max(ys)]
    else:
        kb = None
    raw = {"meta": {"file": Path(sys.argv[1]).name, "insunits": doc.header.get("$INSUNITS", 0), "khung": kb},
           "segs": segs, "texts": texts, "hatches": hatches, "attrs": attrs}
    Path(sys.argv[2]).parent.mkdir(parents=True, exist_ok=True)
    Path(sys.argv[2]).write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    print(f"segs {len(segs)} · texts {len(texts)} · hatches {len(hatches)} · attrs {len(attrs)} → {sys.argv[2]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
