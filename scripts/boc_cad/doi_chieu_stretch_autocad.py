# -*- coding: utf-8 -*-
# QT-81 · DOI CHIEU STRETCH app <-> AutoCAD that. IronPython chay TRONG AutoCAD (MDI-autocad-connector):
#   REPO_MDI = r"<repo>"; DS_ST = [["<ma goc>", 500], ["<ma goc>", -500], ...]   # toi da ~8 tep / luot (AI_START §9)
#   import io; exec(io.open(REPO_MDI + r"\scripts\doi_chieu_stretch_autocad.py", encoding="utf-8").read())
# Buoc 1: chay NGUYEN VAN doan "# ---- 0. QT-81" cua PY_THAN (lay thang tu prototype/shell.src.html, khong chep tay)
#         de sinh data/dwg/x-canho-stretch/<ma>__s+500.dwg - dung tep ma nut Dong bo CAD sinh ra.
# Buoc 2: boc net tho tep goc + tep bien the bang CHINH walk() cua scripts/boc_cad_p16_autocad.py, mo bang mo()
#         (side database nhu bo boc dung cho tep can), KHONG Dispose database (AI_START §9). Ghi C:\Temp\mdi_stretch\dc_<ma>.json:
#         {insbase:[x,y], "0":[[layer, c, pts]...], "500":[...]}
# So sanh (ngoai AutoCAD): python scripts/doi_chieu_stretch.py
import os, io, json
from Autodesk.AutoCAD.DatabaseServices import *
from Autodesk.AutoCAD.Geometry import *

REPO = globals().get("REPO_MDI") or r"E:\Projects\MDI_Unitmix_v4"
DS = globals().get("DS_ST") or []
GOC = os.path.join(REPO, r"data\dwg")
RA = r"C:\Temp\mdi_stretch"
if not os.path.isdir(RA): os.makedirs(RA)

# ---- ma that cua app: PY_THAN trong shell.src.html (String.raw, khong can giai ma) ----
_sh = io.open(os.path.join(REPO, r"prototype\shell.src.html"), encoding="utf-8").read()
_py = _sh[_sh.index("const PY_THAN = String.raw`"):]
_i = _py.index("def t_ten("); _t_ten = _py[_i:_py.index("\n\n", _i)]
_a = _py.index("        # ---- 0. QT-81"); _b = _py.index("        # ---- 1. attach")
_buoc0 = "\n".join(l[8:] if l.startswith("        ") else l for l in _py[_a:_b].split("\n"))

# ---- bo boc du an (walk, mo, ten_layer, Hop) ----
_src = io.open(os.path.join(REPO, r"scripts\boc_cad_p16_autocad.py"), encoding="utf-8").read()
_src = _src[:_src.rstrip().rfind("main()")]
_g = {}
exec(_src, _g)

units = json.load(io.open(os.path.join(REPO, r"data\master\units.json"), encoding="utf-8"))
units = dict((u["ma"], u) for u in (units if isinstance(units, list) else units.values()))
paths = {}
for d0 in os.listdir(GOC):
    p = os.path.join(GOC, d0)
    if os.path.isdir(p) and d0 != "x-canho-stretch":
        for fn in os.listdir(p):
            if fn.lower().endswith(".dwg"): paths[fn[:-4]] = d0 + "/" + fn


def boc_tho(path):
    d = _g["mo"](path)          # side database y nhu bo boc dung cho tep can
    tr = d.TransactionManager.StartTransaction()
    ctx = _g["Hop"](); ctx.tr = tr; ctx.out = []; ctx.err = 0; ctx.tat = set()

    def emit(layer, pts, closed):
        if len(pts) >= 2: ctx.out.append([_g["ten_layer"](layer), 1 if closed else 0, pts])
    ctx.emit = emit
    try:
        lt = tr.GetObject(d.LayerTableId, OpenMode.ForRead)
        for lid in lt:
            lr = tr.GetObject(lid, OpenMode.ForRead)
            if lr.IsOff or lr.IsFrozen: ctx.tat.add(_g["ten_layer"](lr.Name).lower())
        ms = tr.GetObject(SymbolUtilityServices.GetBlockModelSpaceId(d), OpenMode.ForRead)
        for oid in ms: _g["walk"](ctx, oid, Matrix3d.Identity, "0", 0)
        ib = [d.Insbase.X, d.Insbase.Y]
    finally:
        tr.Dispose()            # KHONG d.Dispose()
    return ctx.out, ib


bao = []
theo_ma = {}
for ma, st in DS: theo_ma.setdefault(ma, []).append(int(st))
for ma, ds_st in theo_ma.items():
    u = units[ma]; K = u["stretch"]
    D = {"st": []}
    for st in ds_st:
        rel_st = "x-canho-stretch/%s__s%s%d.dwg" % (ma, "+" if st > 0 else "", st)
        p1 = os.path.join(GOC, rel_st.replace("/", "\\"))
        if os.path.isfile(p1): os.remove(p1)          # luon sinh lai bang ma hien hanh
        dtim = round(u["dt_tim_m2"] + st * K["sau_tim_mm"] / 1e6, 2) if "dt_tim_m2" in u else 0.0
        dtt = round(u["dt_tt_m2"] + st * K["sau_tt_mm"] / 1e6, 2) if "dt_tt_m2" in u else 0.0
        D["st"].append([ma + "~s%+d" % st, paths[ma], rel_st, K["x_mm"], st, dtim, dtt, K.get("no") or []])
    g = {"os": os, "D": D, "goc": GOC, "kq": {}}
    exec("from Autodesk.AutoCAD.DatabaseServices import *\nfrom Autodesk.AutoCAD.Geometry import *\n"
         + _t_ten + "\n" + _buoc0, g)
    out = {}
    net, ib = boc_tho(os.path.join(GOC, paths[ma].replace("/", "\\")))
    out["insbase"] = ib; out["0"] = net
    for (k, rel0, rel_st, x, st, a, b, no), r in zip(D["st"], g["kq"]["stretch"]):
        out[str(st)] = boc_tho(os.path.join(GOC, rel_st.replace("/", "\\")))[0]
    with open(os.path.join(RA, "dc_%s.json" % ma), "w") as f: json.dump(out, f)
    bao.append("%s %s: %s" % (ma, ds_st, g["kq"]["stretch"]))
print("\n".join(bao))
