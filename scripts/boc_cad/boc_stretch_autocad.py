# -*- coding: utf-8 -*-
# QT-81 · BUOC 1 do duong STRETCH: IronPython chay TRONG AutoCAD (qua MDI-autocad-connector,
# autocad_execute_python:  REPO_MDI = r"<repo>"; import io
#                          exec(io.open(REPO_MDI + r"\scripts\boc_stretch_autocad.py", encoding="utf-8").read()) ).
# Chi DOC tep thu vien bang side database - khong mo, khong sua tep nao, khong dung ban ve dang mo.
# Ghi dump tho ra C:\Temp\mdi_stretch\stretch_raw.json (KHONG dua vao repo):
#   {ma: {insbase:[x,y],
#         pk:  [[x0,x1,y0,y1],..]                  khung bao block noi that phong khach F-PK-*
#         blk: [[ten,x0,x1,y0,y1,xChen,yChen],..]  moi block cap ngoai cung (STRETCH doi block theo DIEM CHEN)
#         net: [[layer, c, xChen|null, iBlk|-1, loai],..]  MOI net do bo boc du an phat ra, DUNG THU TU cua
#                                                   scripts/boc_cad_p16_autocad.py boc_net() (= thu tu
#                                                   unit_geometry.json truoc khi loc lop) + diem chen x cua
#                                                   block cap ngoai cung chua net do (null = thuc the rieng),
#                                                   so thu tu block do (-1) va kieu net goc (Line, Arc...)}}
# Toa do da TRU INSBASE (bay 12, AI_START §4) = dung he mm cua app (x mat tien, y 0 = hanh lang).
import os, io, json
from Autodesk.AutoCAD.DatabaseServices import *
from Autodesk.AutoCAD.Geometry import *

REPO = globals().get("REPO_MDI") or r"E:\Projects\MDI_Unitmix_v4"   # dat REPO_MDI truoc khi exec neu repo o cho khac
THU_VIEN = os.path.join(REPO, r"data\dwg\x-canho-bt")
RA = r"C:\Temp\mdi_stretch"
if not os.path.isdir(RA): os.makedirs(RA)

# dung CHINH ham walk() cua bo boc du an de thu tu net trung khit unit_geometry.json
_src = io.open(os.path.join(REPO, r"scripts\boc_cad_p16_autocad.py"), encoding="utf-8").read()
_src = _src[:_src.rstrip().rfind("main()")]
_g = {}
exec(_src, _g)


def boc_net_gan_nhan(path):
    d = _g["mo"](path)
    tr = d.TransactionManager.StartTransaction()
    ctx = _g["Hop"](); ctx.tr = tr; ctx.out = []; ctx.err = 0; ctx.tat = set()
    hien = [None, -1, ""]

    def emit(layer, pts, closed):
        if len(pts) >= 2:
            ctx.out.append([_g["ten_layer"](layer), 1 if closed else 0, hien[0], hien[1], hien[2]])
    ctx.emit = emit
    # ghi KIEU net goc (Arc / Circle = canh cua mo, khong duoc STRETCH xuyen qua) - boc do_curve, walk() goi qua _g
    goc_do = _g.get("_do_goc") or _g["do_curve"]; _g["_do_goc"] = goc_do

    def do_curve(c, e, xf, layer):
        hien[2] = e.GetType().Name
        goc_do(c, e, xf, layer)
    _g["do_curve"] = do_curve
    try:
        lt = tr.GetObject(d.LayerTableId, OpenMode.ForRead)
        for lid in lt:
            lr = tr.GetObject(lid, OpenMode.ForRead)
            if lr.IsOff or lr.IsFrozen:
                ctx.tat.add(_g["ten_layer"](lr.Name).lower())
        bt = tr.GetObject(d.BlockTableId, OpenMode.ForRead)
        ms = tr.GetObject(bt[BlockTableRecord.ModelSpace], OpenMode.ForRead)
        ib = 0
        for oid in ms:
            e = tr.GetObject(oid, OpenMode.ForRead)
            if isinstance(e, BlockReference):
                hien[0] = round(e.Position.X - d.Insbase.X, 1); hien[1] = ib; ib += 1
            else:
                hien[0] = None; hien[1] = -1
            _g["walk"](ctx, oid, Matrix3d.Identity, "0", 0)
    finally:
        tr.Dispose()
    return ctx.out


kq = {}
for fn in sorted(os.listdir(THU_VIEN)):
    if not fn.lower().endswith(".dwg"): continue
    ma = fn[:-4]
    sdb = Database(False, True)
    try:
        sdb.ReadDwgFile(os.path.join(THU_VIEN, fn), FileOpenMode.OpenForReadAndAllShare, True, None)
        sdb.CloseInput(True)
        ib = sdb.Insbase; bx, by = ib.X, ib.Y
        pk = []; blk = []
        t = sdb.TransactionManager.StartTransaction()
        ms = t.GetObject(SymbolUtilityServices.GetBlockModelSpaceId(sdb), OpenMode.ForRead)
        for oid in ms:
            e = t.GetObject(oid, OpenMode.ForRead)
            if not isinstance(e, BlockReference): continue
            ten = t.GetObject(e.BlockTableRecord, OpenMode.ForRead).Name
            try: ex = e.GeometricExtents
            except: continue
            r = [ex.MinPoint.X - bx, ex.MaxPoint.X - bx, ex.MinPoint.Y - by, ex.MaxPoint.Y - by]
            # diem chen: lenh STRETCH doi NGUYEN block khi diem chen nam trong cua so cat
            blk.append([ten] + [round(v, 1) for v in r] + [round(e.Position.X - bx, 1), round(e.Position.Y - by, 1)])
            if ten.upper().startswith("F-PK-"): pk.append([round(v, 1) for v in r])
        t.Commit()
        kq[ma] = {"insbase": [round(bx, 3), round(by, 3)], "pk": pk, "blk": blk,
                  "net": boc_net_gan_nhan(os.path.join(THU_VIEN, fn))}
    except Exception as ex:
        kq[ma] = {"loi": str(ex)}
    # KHONG Dispose(): AI_START §9 - Dispose side database lien tiep lam AutoCAD sap
with open(os.path.join(RA, "stretch_raw.json"), "w") as f:
    json.dump(kq, f)
print("%d tep - %d co F-PK - loi: %s" % (len(kq), sum(1 for v in kq.values() if v.get("pk")),
                                          [k for k, v in kq.items() if v.get("loi")]))
