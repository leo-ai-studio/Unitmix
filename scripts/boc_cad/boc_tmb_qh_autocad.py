# -*- coding: utf-8 -*-
"""BUOC 1 - boc TONG MAT BANG QUY HOACH (QH 1/500, QHSDD) - IronPython, chay TRONG AutoCAD.

Khong chay bang python.exe. Mo ban ve QH trong AutoCAD (nen CHEP ra thu muc ten KHONG DAU truoc,
vi duong dan co chu "QD" lam cau noi MCP loi ma hoa), roi chay qua cong cu MCP `autocad_execute_python`:

    OUT = r"C:\\Temp\\mdi_qh\\raw_tmb.json"
    exec(open(r"E:\\Projects\\MDI_Unitmix_v4\\scripts\\boc_tmb_qh_autocad.py").read())

Doc BAN VE DANG MO (model space), KHONG sua gi. Ghi ra <OUT> mot tep JSON:
    meta    ten tep, don vi (INSUNITS), khung bao
    segs    moi NET (LINE, LWPOLYLINE ho/kin - cung theo bulge chia doan, ARC chia doan, POLYLINE 2D):
            {"l": layer, "p": [[x,y],...], "c": kin?}   - toa do GIU NGUYEN cua ban ve (thuong la VN2000, met)
    texts   DBText + MText: {"l","t" (chu thuan), "x","y","h","r"}
    hatches loai dat theo lop hatch: {"l", "loops": [[[x,y],...],...], "m": mau, "pat": ten mau to}
            (mau = "i<ACI>" hoac "rgb<r>,<g>,<b>"; ByLayer -> mau cua layer) - ban ve QHPK dung CHUNG mot lop cho NOXH / NOTM,
            chi khac mau -> buoc 2 ghep chu thich theo (lop, mau, mau to)
    attrs   block co THUOC TINH (ky hieu o dat QHPK 1/2000 "A=A-3 DTDVO=118,33 TC=1-12 MDDVO=14-53"...):
            {"l", "b": ten block, "x","y": diem chen, "a": {TAG: gia tri}}

Buoc 2 (python thuong):  python scripts/boc_tmb_qh.py <OUT> --kt 105.75 [--kml ra.kml] [--json lo_dat.json]
Ky tu loi (font TCVN3 .VnHelvet...) giu nguyen dang tho; buoc 2 doi sang Unicode.
"""
import json
import math
import traceback

from Autodesk.AutoCAD.DatabaseServices import *          # noqa: F403
from Autodesk.AutoCAD.Geometry import *                  # noqa: F403

try:
    OUT
except NameError:
    OUT = r"C:\Temp\mdi_qh\raw_tmb.json"

BUOC_CUNG = math.radians(5.0)     # chia cung moi 5 do


def _s(s):
    """bo surrogate le (font TCVN3 cu) - cau noi MCP / json khong doc duoc."""
    return u"".join(ch if not (0xD800 <= ord(ch) <= 0xDFFF) else u"?" for ch in (s or u""))


def _cung(cx, cy, r, a0, a1):
    if a1 < a0:
        a1 += 2 * math.pi
    n = max(2, int(math.ceil((a1 - a0) / BUOC_CUNG)))
    return [[cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)] for i in range(n + 1)]


def _pl(e):
    """LWPOLYLINE -> diem, cung (bulge) chia doan."""
    n = e.NumberOfVertices
    pts = []
    m = n if e.Closed else n - 1
    for i in range(n):
        p = e.GetPoint2dAt(i)
        pts.append([p.X, p.Y])
        if i < m:
            b = e.GetBulgeAt(i)
            if abs(b) > 1e-9:
                q = e.GetPoint2dAt((i + 1) % n)
                th = 4 * math.atan(b)
                ch = math.hypot(q.X - p.X, q.Y - p.Y)
                r = ch / (2 * math.sin(abs(th) / 2))
                mx, my = (p.X + q.X) / 2, (p.Y + q.Y) / 2
                d = math.sqrt(max(r * r - (ch / 2) ** 2, 0))
                ux, uy = (q.X - p.X) / ch, (q.Y - p.Y) / ch
                sg = 1 if (b > 0) == (abs(th) < math.pi) else -1
                cx, cy = mx - sg * uy * d, my + sg * ux * d
                a0 = math.atan2(p.Y - cy, p.X - cx)
                a1 = math.atan2(q.Y - cy, q.X - cx)
                seg = _cung(cx, cy, r, a0, a1) if b > 0 else _cung(cx, cy, r, a1, a0)[::-1]
                pts.extend(seg[1:-1])
    return pts


def _mau(e, tr):
    """mau thuc cua doi tuong: ByLayer -> mau layer."""
    c = e.Color
    try:
        if c.IsByLayer:
            c = tr.GetObject(e.LayerId, OpenMode.ForRead).Color
    except Exception:
        pass
    try:
        if c.IsByAci or c.IsByLayer:
            return "i%d" % c.ColorIndex
        return "rgb%d,%d,%d" % (c.Red, c.Green, c.Blue)
    except Exception:
        return ""


res = {"meta": {}, "segs": [], "texts": [], "hatches": [], "attrs": [], "err": None}
try:
    res["meta"] = {"file": _s(doc.Name), "insunits": int(db.Insunits),
                   "ext": [db.Extmin.X, db.Extmin.Y, db.Extmax.X, db.Extmax.Y]}
    with db.TransactionManager.StartTransaction() as tr:
        ms = tr.GetObject(SymbolUtilityServices.GetBlockModelSpaceId(db), OpenMode.ForRead)
        for oid in ms:
            e = tr.GetObject(oid, OpenMode.ForRead)
            L = _s(e.Layer)
            try:
                if isinstance(e, Line):
                    res["segs"].append({"l": L, "p": [[e.StartPoint.X, e.StartPoint.Y], [e.EndPoint.X, e.EndPoint.Y]], "c": False})
                elif isinstance(e, Polyline):
                    res["segs"].append({"l": L, "p": _pl(e), "c": bool(e.Closed)})
                elif isinstance(e, Arc):
                    res["segs"].append({"l": L, "p": _cung(e.Center.X, e.Center.Y, e.Radius, e.StartAngle, e.EndAngle), "c": False})
                elif isinstance(e, Polyline2d):
                    pts = [[tr.GetObject(v, OpenMode.ForRead).Position.X, tr.GetObject(v, OpenMode.ForRead).Position.Y] for v in e]
                    res["segs"].append({"l": L, "p": pts, "c": bool(e.Closed)})
                elif isinstance(e, DBText):
                    res["texts"].append({"l": L, "t": _s(e.TextString), "x": e.Position.X, "y": e.Position.Y,
                                         "h": e.Height, "r": e.Rotation})
                elif isinstance(e, MText):
                    res["texts"].append({"l": L, "t": _s(e.Text), "x": e.Location.X, "y": e.Location.Y,
                                         "h": e.TextHeight, "r": e.Rotation, "mt": True})
                elif isinstance(e, Hatch):
                    loops = []
                    for li in range(e.NumberOfLoops):
                        lp = e.GetLoopAt(li)
                        if lp.IsPolyline:
                            loops.append([[v.Vertex.X, v.Vertex.Y] for v in lp.Polyline])
                        else:
                            pts = []
                            for c in lp.Curves:
                                if isinstance(c, LineSegment2d):
                                    pts.append([c.StartPoint.X, c.StartPoint.Y])
                                elif isinstance(c, CircularArc2d):
                                    a0, a1 = c.StartAngle, c.EndAngle
                                    rf = c.ReferenceVector.Angle
                                    seg = _cung(c.Center.X, c.Center.Y, c.Radius, rf + a0, rf + a1)
                                    pts.extend(seg[:-1] if not c.IsClockWise else seg[::-1][:-1])
                            if len(pts) >= 3:
                                loops.append(pts)
                    if loops:
                        res["hatches"].append({"l": L, "loops": loops, "m": _mau(e, tr), "pat": _s(e.PatternName)})
                elif isinstance(e, BlockReference) and e.AttributeCollection.Count:
                    a = {}
                    for aid in e.AttributeCollection:
                        ar = tr.GetObject(aid, OpenMode.ForRead)
                        a[_s(ar.Tag)] = _s(ar.TextString)
                    b = tr.GetObject(e.BlockTableRecord, OpenMode.ForRead)
                    res["attrs"].append({"l": L, "b": _s(b.Name), "x": e.Position.X, "y": e.Position.Y, "a": a})
            except Exception:
                pass                                     # mot doi tuong hong khong lam hong ca lan boc
        tr.Commit()
except Exception:
    res["err"] = _s(traceback.format_exc())

_f = open(OUT, "w")
_f.write(json.dumps(res, ensure_ascii=True))
_f.close()
__output__ = "boc TMB QH: %d net | %d chu | %d hatch | %d block thuoc tinh -> %s%s" % (
    len(res["segs"]), len(res["texts"]), len(res["hatches"]), len(res["attrs"]), OUT, (" | LOI: " + res["err"][-300:]) if res["err"] else "")
