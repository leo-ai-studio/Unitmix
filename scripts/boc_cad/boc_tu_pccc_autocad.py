# -*- coding: utf-8 -*-
"""Boc BLOCK TU PCCC (data/dwg/tu-pccc.dwg) - IronPython, chay TRONG AutoCAD.

Khong chay bang python.exe. Mo data/dwg/tu-pccc.dwg trong AutoCAD (khong can la ban ve dang hien), roi chay qua
cong cu MCP `autocad_execute_python`:

    OUT = r"E:\\Projects\\MDI_Unitmix_v4\\data\\master\\tu_pccc.json"
    exec(open(r"E:\\Projects\\MDI_Unitmix_v4\\scripts\\boc_tu_pccc_autocad.py").read())

Doc hai block `pccc-800x200` (tu doi) va `pccc-500x200` (tu don), KHONG sua gi. Quy uoc block (QT-77g):
    y = 0      mat tuong hanh lang; y < 0 vao trong can ho; canh tu mo ra hanh lang (y > 0)
    lhp-fire equipment  than tu (polyline kin), duong cheo, net canh mo
    A-WALL     tuong xay sau lung tu (chu U: sau + hai ben)
    A-FNSH     lop hoan thien tuong xay
    A-AREA-SPACE  bao DT cua tuong xay sau lung tu (tu mat tuong HL); phan tru DT thong thuy can = phan nam SAU tuong HL
Ghi ra <OUT>:
    {"nguon", "don_vi", "khoi": {ten: {"rong", "sau", "than": [[x,y]...]..., "net": [[[x,y],[x,y]]...],
                                       "tuong": [[x,y]...], "hoan_thien": [[x,y]...], "dt": [[x,y]...],
                                       "tuong_day", "ht_day", "dt_m2"}}}
"""
import json

from Autodesk.AutoCAD.DatabaseServices import *          # noqa: F403

KHOI = ["pccc-800x200", "pccc-500x200"]


def _r(v):
    return round(v, 1)


def _boc():
    d = [x for x in docs if x.Name.lower().replace("/", "\\").endswith("\\tu-pccc.dwg")]   # noqa: F821
    if not d:
        raise Exception("chua mo data/dwg/tu-pccc.dwg trong AutoCAD")
    d = d[0]
    db2 = d.Database
    kq = {"nguon": "data/dwg/tu-pccc.dwg", "don_vi": db2.Insunits.ToString(), "khoi": {}}
    lk = d.LockDocument()
    try:
        tr = db2.TransactionManager.StartTransaction()
        bt = tr.GetObject(db2.BlockTableId, OpenMode.ForRead)
        for ten in KHOI:
            if not bt.Has(ten):
                raise Exception("thieu block " + ten)
            b = tr.GetObject(bt[ten], OpenMode.ForRead)
            k = {"than": [], "net": [], "tuong": None, "hoan_thien": None, "dt": None}
            for eid in b:
                e = tr.GetObject(eid, OpenMode.ForRead)
                lop = e.Layer.lower()
                if isinstance(e, Polyline):
                    pts = [[_r(e.GetPoint2dAt(i).X), _r(e.GetPoint2dAt(i).Y)] for i in range(e.NumberOfVertices)]
                    if lop == "lhp-fire equipment":
                        k["than"].append(pts)
                    elif lop == "a-wall":
                        k["tuong"] = pts
                    elif lop == "a-fnsh":
                        k["hoan_thien"] = pts
                    elif lop == "a-area-space":
                        k["dt"] = pts
                elif isinstance(e, Line) and lop == "lhp-fire equipment":
                    k["net"].append([[_r(e.StartPoint.X), _r(e.StartPoint.Y)], [_r(e.EndPoint.X), _r(e.EndPoint.Y)]])
            xs = [p[0] for P in k["than"] for p in P]
            ys = [p[1] for P in k["than"] for p in P]
            k["rong"] = _r(max(xs) - min(xs))
            k["sau"] = _r(max(ys) - min(ys))
            # day tuong xay / lop hoan thien = phan nho ra hai ben than tu
            tx = [p[0] for p in k["tuong"]]
            hx = [p[0] for p in k["dt"]]
            k["tuong_day"] = _r(max(tx) - max(xs))
            k["ht_day"] = _r(max(hx) - max(tx))
            dx = [p[0] for p in k["dt"]]
            dy = [p[1] for p in k["dt"]]
            k["dt_sau"] = _r(max(dy) - min(dy))          # chieu sau tu mat tuong HL (y = 0) toi mep hoan thien sau lung
            # DT bao cua block (ca phan nam trong tuong HL). Phan tru DT thong thuy can = rong x (dt_sau - tuong HL - hoan thien):
            # tuong HL da nam ngoai DT thong thuy roi (chu nhiem 22/10/2026) - app tinh theo tuong HL that cua tung mau can
            k["dt_m2"] = round((max(dx) - min(dx)) * (max(dy) - min(dy)) / 1e6, 4)
            kq["khoi"][ten] = k
        tr.Commit()
    finally:
        lk.Dispose()
    return kq


_kq = _boc()
with open(OUT, "w") as _f:                                 # noqa: F821
    _f.write(json.dumps(_kq, ensure_ascii=False, indent=1))
print("da ghi " + OUT + " · " + ", ".join("%s %sx%s DT %s m2" % (t, v["rong"], v["sau"], v["dt_m2"]) for t, v in _kq["khoi"].items()))   # noqa: F821
