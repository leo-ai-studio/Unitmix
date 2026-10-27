# -*- coding: utf-8 -*-
"""BUOC 1 cua bo boc CAD phien 16 - IronPython, chay TRONG AutoCAD.

Khong chay bang python.exe. Dan noi dung tep nay vao cong cu MCP
`autocad_execute_python`, hoac goi tu mot phien AutoCAD co IronPython.

Vi sao phai qua AutoCAD: ezdxf khong doc duoc `.dwg`, va ban ve mau toa lap bang
XREF - khong `ResolveXrefs` thi moi `BlockReference` nem exception o
`GeometricExtents` va dinh nghia block chi con mot dong text "Xref ..".

CHEP THU VIEN RA THU MUC TAM TRUOC KHI CHAY: tep dang mo trong AutoCAD bi khoa
(`eFileSharingViolation`) khi doc bang side database.

Ghi ra <OUT>:
    toa_<file>.json        luot chen + polyline MDI-BAO + chu + polyline/circle
                           MDI-HANHLANG (tim hanh lang + moc co keo) cua tung mau toa
    toa_loi_bb.json        khung bao HINH HOC DA PHAN LOAI cua tung luot chen loi/thang
    can2_<file>.json       net ve can ho (mm, he toa do cuc bo cua tep)
    loi2_<file>.json       net ve loi thang (mm, he toa do cuc bo cua tep)
    meta_text_block.json   chu + ten block trong tep can / loi
    insbase.json           INSBASE cua tung tep thu vien

Roi chay buoc 2:  python scripts/boc_cad_p16.py <OUT>
"""
import json
import math
import os

from Autodesk.AutoCAD.ApplicationServices import (         # noqa: F403
    Application, DocumentCollectionExtension, DocumentExtension)
from Autodesk.AutoCAD.DatabaseServices import *          # noqa: F403
from Autodesk.AutoCAD.Geometry import *                  # noqa: F403
from System.IO import FileShare

# ---- SUA HAI DUONG DAN NAY -------------------------------------------------
BASE = r"C:\Temp\mdi_boc"          # <BASE>\dwg\{x-canho-bt,x-thang,x-mautoa-bt}
OUT = r"C:\Temp\mdi_boc\raw"
# ---------------------------------------------------------------------------

# Chay MOT PHAN (tuy chon): dat truoc khi dan tep nay, vi du
#   STAGE = ("toa",)      # chi mau toa; mac dinh ("can", "loi", "toa")
#   ONLY = ["mttm_hn_i1_2000_25t_bt.dwg"]   # chi cac tep nay (tuy STAGE); mac dinh tat ca
# Tep gop (toa_loi_bb / meta_text_block / insbase) duoc GOP voi ban da co trong
# OUT khi chay mot phan, khong ghi de bang ban thieu.
try:
    STAGE
except NameError:
    STAGE = ("can", "loi", "toa")
try:
    ONLY
except NameError:
    ONLY = None

# Phan loai lop theo TIEN TO (QT-12). Giu KHOP voi LOP_CAN trong boc_cad_p16.py.
CAT = ["a-area-space", "a-area-wall-center", "a-dien tich tt", "a-thietbivs",
       "a-thietbi-nt", "a-wall", "a-conc", "a-glaz", "a-hevy", "a-door", "a-rail",
       "a-eqpm", "a-tbi", "a-furn", "cdc-kt-noi that", "a-hidd", "a-fine",
       "a-fnsh", "a-stair", "a-flor"]

SKIP = set(["Hatch", "DBText", "MText", "AttributeDefinition", "AttributeReference",
            "RotatedDimension", "AlignedDimension", "RadialDimension",
            "DiametricDimension", "Point3AngularDimension", "LineAngularDimension2",
            "OrdinateDimension", "ArcDimension", "Leader", "MLeader", "Table",
            "Solid", "Face", "Region", "RasterImage", "Wipeout", "Viewport",
            "Ole2Frame", "ProxyEntity", "DBPoint"])


def ten_layer(l):
    """XREF chua bind -> "ten_xref|A-WALL"; da bind -> "...$0$A-WALL".

    Cat thieu dau "|" thi moi net trong XREF roi khoi bang phan loai va dau chan
    loi do ra RONG o ca 17 toa, khong nem loi nao. Da can.
    """
    if "|" in l:
        l = l.rsplit("|", 1)[-1]
    if "$0$" in l:
        l = l.rsplit("$0$", 1)[-1]
    return l.strip()


def hop_le(l):
    t = ten_layer(l).lower()
    for p in CAT:
        if t.startswith(p):
            return True
    return False


class Hop(object):
    pass


def mo(path):
    """Side database - CHI cho tep can ho / loi thang (khong co XREF long nhau)."""
    d = Database(False, True)
    d.ReadDwgFile(path, FileShare.Read, True, "")
    # KHONG ResolveXrefs nua (1/10/2026): goi no tren side database lam acad.exe
    # 2027 SAP (coreclr 0xc0000005 @0x3594df - xem mo_doc). Do that ca 59 tep
    # can/loi: chi 2 tep co XREF va deu khong can giai - chxh_hn_stu_m1 gan khung
    # ten x-kt-vtk-a1, x_tb_n1 tro o "E:\00. TK\..." khong ton tai. Tep moi co
    # XREF thi `xref_trong()` bao ra de nguoi quyet, khong tu giai.
    return d


def xref_trong(d):
    tr = d.TransactionManager.StartTransaction()
    try:
        bt = tr.GetObject(d.BlockTableId, OpenMode.ForRead)
        return [tr.GetObject(b, OpenMode.ForRead).Name for b in bt
                if tr.GetObject(b, OpenMode.ForRead).IsFromExternalReference]
    finally:
        tr.Dispose()


def mo_doc(path):
    """Mo bang Document THAT (doc-only) - danh cho MAU TOA (co ~8 XREF long nhau).

    Vi sao khong dung mo(): `Database.ResolveXrefs()` tren side database lam
    acad.exe cua AutoCAD 2027 SAP (coreclr.dll, 0xc0000005, fault offset
    0x3594df, tai lap 6/6 lan tu 4/9). Mo nhu nguoi dung mo tay thi AutoCAD tu
    giai XREF - do that: mttm_hn_i1 mo 2,5 s, 8/8 XREF Resolved, khong sap.

    Dong tai lieu TRUOC (khi da co tai lieu moi lam active) - dong tai lieu cuoi
    cung cua mot luot chay se lam connector nem `eNoDocument` va MAT sach output
    print; nen luot chay de lai tai lieu cuoi dang mo, luot sau (hoac
    dong_tat_ca) dong no. Tra ve (Database, Document) - KHONG Dispose database.
    """
    dm = Application.DocumentManager
    doc = DocumentCollectionExtension.Open(dm, path, True)
    for c in list(dm):
        if c is not doc:
            try:
                DocumentExtension.CloseAndDiscard(c)
            except Exception:
                pass
    return doc.Database, doc


# --------------------------- net ve ----------------------------------------
def px(xf, p):
    q = p.TransformBy(xf)
    return [round(q.X, 2), round(q.Y, 2)]


def do_curve(ctx, e, xf, layer):
    t = e.GetType().Name
    try:
        if t == "Line":
            ctx.emit(layer, [px(xf, e.StartPoint), px(xf, e.EndPoint)], False)
        elif t == "Polyline":
            n = e.NumberOfVertices
            segs = n if e.Closed else n - 1
            pts = []
            for i in range(segs):
                if e.GetSegmentType(i) == SegmentType.Line:
                    if not pts:
                        pts.append(px(xf, e.GetPointAtParameter(i)))
                    pts.append(px(xf, e.GetPointAtParameter(i + 1.0)))
                else:
                    if not pts:
                        pts.append(px(xf, e.GetPointAtParameter(i)))
                    for k in range(1, 9):
                        pts.append(px(xf, e.GetPointAtParameter(i + k / 8.0)))
            ctx.emit(layer, pts, bool(e.Closed))
        elif t in ("Polyline2d", "Polyline3d"):
            a, b = e.StartParam, e.EndParam
            k = max(2, min(200, int(abs(b - a)) * 2 + 2))
            ctx.emit(layer, [px(xf, e.GetPointAtParameter(a + (b - a) * i / (k - 1.0)))
                             for i in range(k)], bool(e.Closed))
        elif t in ("Arc", "Circle", "Ellipse", "Spline"):
            a, b = e.StartParam, e.EndParam
            k = 25 if t != "Spline" else 33
            ctx.emit(layer, [px(xf, e.GetPointAtParameter(a + (b - a) * i / (k - 1.0)))
                             for i in range(k)], t == "Circle")
    except Exception:
        ctx.err += 1


def walk(ctx, oid, xf, playr, dep):
    if dep > 8:
        return
    try:
        e = ctx.tr.GetObject(oid, OpenMode.ForRead)
    except Exception:
        return
    t = e.GetType().Name
    if t in SKIP:
        return
    try:
        if not e.Visible:            # block dong: entity trang thai an mang co nay
            return
    except Exception:
        pass
    layer = e.Layer if e.Layer not in ("0", "") else playr
    if ten_layer(layer).lower() in ctx.tat:
        return
    if t == "BlockReference":
        try:
            btr = ctx.tr.GetObject(e.BlockTableRecord, OpenMode.ForRead)
        except Exception:
            return
        nx = xf * e.BlockTransform
        for c in btr:
            walk(ctx, c, nx, layer, dep + 1)
        return
    if t == "Mline":                 # MLINE khong co duong dan hinh hoc, phai no ra
        col = DBObjectCollection()
        try:
            e.Explode(col)
        except Exception:
            return
        for o in col:
            if o.GetType().Name not in SKIP:
                do_curve(ctx, o, xf, layer)
        return
    do_curve(ctx, e, xf, layer)


def boc_net(path):
    d = mo(path)
    tr = d.TransactionManager.StartTransaction()
    ctx = Hop()
    ctx.tr = tr
    ctx.out = []
    ctx.err = 0
    ctx.tat = set()

    def emit(layer, pts, closed):
        if len(pts) >= 2:
            ctx.out.append({"layer": ten_layer(layer), "pts": pts,
                            "c": 1 if closed else 0})
    ctx.emit = emit
    try:
        lt = tr.GetObject(d.LayerTableId, OpenMode.ForRead)
        for lid in lt:
            lr = tr.GetObject(lid, OpenMode.ForRead)
            if lr.IsOff or lr.IsFrozen:
                ctx.tat.add(ten_layer(lr.Name).lower())
        bt = tr.GetObject(d.BlockTableId, OpenMode.ForRead)
        ms = tr.GetObject(bt[BlockTableRecord.ModelSpace], OpenMode.ForRead)
        for oid in ms:
            walk(ctx, oid, Matrix3d.Identity, "0", 0)
    finally:
        tr.Dispose(); d.Dispose()
    return ctx.out, ctx.err


# --------------------------- mau toa ---------------------------------------
def ten_luot_chen(tr, e):
    """Ten thu vien cua mot luot chen. XREF thi lay TEN TEP no tro toi, khong lay ten block:
    3/10/2026 - mttm_hn_y1 chen 2 can goc `chtm_hn_2pn_y1_8500x6000.dwg` duoi ten block
    `chhn_2pn_y1 8500x6000` -> buoc 2 khong nhan ra (RE_MA), toa Y1 mat 2 can y1 tu phien 24
    (35 -> 33 can/tang) ma khong co canh bao nao."""
    n = e.Name
    try:
        btr = tr.GetObject(e.BlockTableRecord, OpenMode.ForRead)
        if btr.IsFromExternalReference and btr.PathName:
            goc = os.path.splitext(os.path.basename(btr.PathName.replace("/", "\\")))[0]
            if goc and goc != n and goc.lower().startswith(("chtm_", "chxh_", "x_")):
                return goc
    except Exception:
        pass
    return n


def boc_toa(path, d=None):
    """`d` = Database cua Document that (mo_doc) - khong Dispose. Khong truyen thi
    mo side database nhu cu (chi an toan khi tep khong co XREF long nhau)."""
    own = d is None
    if own:
        d = mo(path)
    res = {"file": os.path.basename(path), "insunits": str(d.Insunits),
           "inserts": [], "bao": [], "texts": [], "hanhlang_ve": [], "hanhlang_circ": [],
           "bao_ungvien": []}
    tr = d.TransactionManager.StartTransaction()
    try:
        bt = tr.GetObject(d.BlockTableId, OpenMode.ForRead)
        ms = tr.GetObject(bt[BlockTableRecord.ModelSpace], OpenMode.ForRead)
        for oid in ms:
            e = tr.GetObject(oid, OpenMode.ForRead)
            t = e.GetType().Name
            if t == "BlockReference":
                p = e.Position
                res["inserts"].append({
                    "name": ten_luot_chen(tr, e), "block": e.Name, "layer": e.Layer,
                    "x": round(p.X, 3), "y": round(p.Y, 3),
                    "rot": round(e.Rotation * 180.0 / math.pi, 3),
                    "sx": round(e.ScaleFactors.X, 3),
                    "sy": round(e.ScaleFactors.Y, 3)})
            elif (t == "Line"
                  and e.Layer.upper().replace("-", "").replace("_", "").find("HANHLANG") >= 0):
                # Tim hanh lang VE BANG LINE (1/10/2026): doi CAD ve lai MDI-HANHLANG
                # bang LINE thay cho Polyline 2 dinh - mttm_hn_u3 con 1 Polyline + 4
                # Line; u1/u2/i1/l1/xh_u1/xh_z1 khong con Polyline nao. Chi doc Polyline
                # la mat sach tim hanh lang -> ca 5 toa U bao 0 can loi doi (QT-25).
                # Cung du lieu, chi khac kieu doi tuong: ghi nhu polyline 2 dinh.
                res["hanhlang_ve"].append({"layer": e.Layer, "pts": [
                    [round(e.StartPoint.X, 3), round(e.StartPoint.Y, 3)],
                    [round(e.EndPoint.X, 3), round(e.EndPoint.Y, 3)]]})
            elif t == "Polyline" and ten_layer(e.Layer).upper() == "MDI-BAO":
                # Khop DUNG TEN, khong con dung substring "BAO": lop MDI-BAO-TM
                # (phien 17, chan long thang may) cung chua chu "BAO" - dung
                # substring se gom nham net chan long vao net bao DTXD.
                pts = []
                for i in range(e.NumberOfVertices):
                    q = e.GetPoint2dAt(i)
                    pts.append([round(q.X, 3), round(q.Y, 3)])
                res["bao"].append({"layer": e.Layer, "closed": bool(e.Closed),
                                   "pts": pts})
            elif t == "Polyline" and e.Layer.upper().replace("-", "").replace("_", "").find("HANHLANG") >= 0:
                # Tim hanh lang NGUOI VE chinh tay qua hub 3 canh (T, Y) - xem
                # MDI-HANHLANG trong mttm_hn_y1: duong that co GAY KHUC truoc khi
                # toi diem chung, khac han duong app tu tinh bang giao 2 duong
                # thang keo dai (lech ~3000 mm o toa Y). Uu tien doc net nay khi co.
                pts = []
                for i in range(e.NumberOfVertices):
                    q = e.GetPoint2dAt(i)
                    pts.append([round(q.X, 3), round(q.Y, 3)])
                res["hanhlang_ve"].append({"layer": e.Layer, "pts": pts})
            elif t == "Polyline" and e.Closed and e.NumberOfVertices >= 4:
                # UNG VIEN net bao cho toa VE NHAM LOP (22/9/2026, chu nhiem chot).
                # 5 mau toa moi (v3, xh_l1, xh_z4..z6) khong co lop MDI-BAO nao; net
                # bao nam tren A-WALL-INT. KHONG nhan bua theo ten lop: buoc 2 chi
                # lay ung vien khi dien tich shoelace KHOP con so DIEN TICH nguoi ve
                # ghi tren ban ve (<= 0,1 m2) - chinh con so do la phep thu.
                # Loc theo do lon de dump khong phinh: san tang dien hinh ~1.600 m2,
                # phong/giengs nho hon mot bac do lon.
                try:
                    if e.Area < 300e6:
                        continue
                except Exception:
                    continue
                pts = []
                for i in range(e.NumberOfVertices):
                    q = e.GetPoint2dAt(i)
                    pts.append([round(q.X, 3), round(q.Y, 3)])
                res["bao_ungvien"].append({"layer": e.Layer, "closed": True,
                                           "pts": pts})
            elif (t == "Circle"
                  and e.Layer.upper().replace("-", "").replace("_", "").find("HANHLANG") >= 0):
                # Diem co keo dau hanh lang (phien 17): Circle ban kinh ~200mm dat
                # DUNG tai dau mut cac doan Polyline MDI-HANHLANG o tren. Ghi tam +
                # ban kinh de buoc 2 (boc_cad_p16.py) ghep voi dau mut polyline gan
                # nhat trong dung sai - khong lam gi voi toa do o day.
                res["hanhlang_circ"].append({"layer": e.Layer,
                                             "x": round(e.Center.X, 3),
                                             "y": round(e.Center.Y, 3),
                                             "r": round(e.Radius, 3)})
            elif t in ("DBText", "MText"):
                s = e.TextString if t == "DBText" else e.Contents
                p = e.Position if t == "DBText" else e.Location
                res["texts"].append({"layer": e.Layer, "s": s,
                                     "x": round(p.X, 1),
                                     "y": round(p.Y, 1)})
    finally:
        tr.Dispose()
        if own:
            d.Dispose()
    return res


def bb_loi(path, d=None):
    """Khung bao HINH HOC DA PHAN LOAI cua tung luot chen loi / thang.

    KHONG dung `GeometricExtents`: no gom ca chu, ghi chu, chuoi kich thuoc va
    BO QUA XCLIP - hai cai deu cho ket luan sai (xem bay so 8 trong AI_START).
    `d` nhu o boc_toa: Database cua Document that, khong Dispose.
    """
    own = d is None
    if own:
        d = mo(path)
    tr = d.TransactionManager.StartTransaction()
    rows = []
    try:
        bt = tr.GetObject(d.BlockTableId, OpenMode.ForRead)
        ms = tr.GetObject(bt[BlockTableRecord.ModelSpace], OpenMode.ForRead)
        for oid in ms:
            e = tr.GetObject(oid, OpenMode.ForRead)
            if e.GetType().Name != "BlockReference":
                continue
            n = ten_luot_chen(tr, e)
            # x_xh_*: loi NOXH theo quy tac ten 1/10/2026 (x-thang/_QUY_TAC_TEN_FILE.md)
            if not n.startswith(("x_tmkt", "x_tmdv", "x_xh_", "x_tb")):
                continue
            ctx = Hop()
            ctx.tr = tr
            ctx.err = 0
            ctx.tat = set()
            ctx.box = [1e30, 1e30, -1e30, -1e30]

            def emit(layer, pts, closed, _c=ctx):
                if not hop_le(layer):
                    return
                for p in pts:
                    if p[0] < _c.box[0]: _c.box[0] = p[0]
                    if p[1] < _c.box[1]: _c.box[1] = p[1]
                    if p[0] > _c.box[2]: _c.box[2] = p[0]
                    if p[1] > _c.box[3]: _c.box[3] = p[1]
            ctx.emit = emit
            try:
                btr = tr.GetObject(e.BlockTableRecord, OpenMode.ForRead)
                m = e.BlockTransform
                for c in btr:
                    walk(ctx, c, m, e.Layer, 1)
            except Exception:
                pass
            bb = None if ctx.box[0] > 1e29 else [round(v, 1) for v in ctx.box]
            rows.append({"name": n, "x": round(e.Position.X, 2),
                         "y": round(e.Position.Y, 2), "bb": bb})
    finally:
        tr.Dispose()
        if own:
            d.Dispose()
    return rows


def meta(path):
    """Vi tri BlockReference/chu long trong khoi long nhau - PHAI cong don ma
    tran bien doi qua tung cap (giong walk()), khong duoc dung thang e.Position:
    do la toa do CUC BO theo khoi CHA TRUC TIEP, chi dung o cap 1. Da gap that
    voi x_tmkt_l3 (giengthang long sau hon 1 cap): toa do ra 83 trieu mm."""
    d = mo(path)
    tr = d.TransactionManager.StartTransaction()
    out = {"texts": [], "blocks": []}
    try:
        bt = tr.GetObject(d.BlockTableId, OpenMode.ForRead)
        ms = tr.GetObject(bt[BlockTableRecord.ModelSpace], OpenMode.ForRead)
        stack = [(oid, 0, Matrix3d.Identity) for oid in ms]
        n = 0
        while stack and n < 60000:
            oid, dep, xf = stack.pop()
            n += 1
            try:
                e = tr.GetObject(oid, OpenMode.ForRead)
            except Exception:
                continue
            t = e.GetType().Name
            if t == "BlockReference":
                p = e.Position.TransformBy(xf)
                out["blocks"].append({"n": e.Name, "x": round(p.X, 1),
                                      "y": round(p.Y, 1), "d": dep})
                if dep < 4:
                    try:
                        nx = xf * e.BlockTransform
                        btr = tr.GetObject(e.BlockTableRecord, OpenMode.ForRead)
                        for c in btr:
                            stack.append((c, dep + 1, nx))
                    except Exception:
                        pass
            elif t in ("DBText", "MText"):
                s = e.TextString if t == "DBText" else e.Contents
                p0 = e.Position if t == "DBText" else e.Location
                p = p0.TransformBy(xf)
                out["texts"].append({"l": ten_layer(e.Layer), "s": s[:80],
                                     "x": round(p.X, 1),
                                     "y": round(p.Y, 1)})
    finally:
        tr.Dispose(); d.Dispose()
    return out


def ghi(ten, o):
    h = open(os.path.join(OUT, ten), "w")
    h.write(json.dumps(o))
    h.close()


def nap(ten):
    """Doc tep tong hop da co trong OUT ({} neu chua co) de GOP khi chay mot phan."""
    p = os.path.join(OUT, ten)
    if not os.path.isfile(p):
        return {}
    h = open(p)
    try:
        return json.loads(h.read())
    finally:
        h.close()


# Tệp chủ nhiệm chốt BỎ (19/9/2026) — không bóc. Không xoá .dwg khỏi thư viện.
BO_QUA = ("chtm_hn_2pn_y2.dwg", "x-kt-vtk-a1.dwg")


def chon(f):
    return f not in BO_QUA and (ONLY is None or f in ONLY)


def main():
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    ib, mt, bbs = nap("insbase.json"), nap("meta_text_block.json"), nap("toa_loi_bb.json")
    for sub, pre, st_ in (("x-canho-bt", "can2_", "can"), ("x-thang", "loi2_", "loi")):
        if st_ not in STAGE:
            continue
        src = os.path.join(BASE, "dwg", sub)
        for f in sorted(os.listdir(src)):
            if not f.lower().endswith(".dwg") or not chon(f):
                continue
            p = os.path.join(src, f)
            st, err = boc_net(p)
            ghi(pre + f[:-4] + ".json", {"file": f, "strokes": st, "err": err})
            mt[("can|" if pre == "can2_" else "loi|") + f] = meta(p)
            d = mo(p)
            ib[f] = [round(d.Insbase.X, 3), round(d.Insbase.Y, 3)]
            xr = xref_trong(d)
            d.Dispose()
            print("%-36s net %5d err %d%s" % (f, len(st), err,
                                             ("  XREF CHUA GIAI: " + ", ".join(xr)) if xr else ""))
    if "toa" in STAGE:
        src = os.path.join(BASE, "dwg", "x-mautoa-bt")
        for f in sorted(os.listdir(src)):
            # chi tep mau toa (mttm_/mtxh_) - x_thongke_canho.dwg la bang thong ke
            if not f.lower().startswith(("mttm_", "mtxh_")):
                continue
            if not f.lower().endswith(".dwg") or not chon(f):
                continue
            p = os.path.join(src, f)
            d, doc = mo_doc(p)          # Document THAT - KHONG ResolveXrefs (xem mo_doc)
            r = boc_toa(p, d)
            bbs[f] = bb_loi(p, d)
            # XREF khong giai duoc (tro sai thu muc / tep da doi ten) -> loi mat
            # hinh im lang (bb = None). Bao ra, khong tu sua. Ghi VAO DUMP (r) chu
            # khong chi print: dong tai lieu lam connector nuot het phan in.
            hong = []
            try:
                g = d.GetHostDwgXrefGraph(True)
                for i in range(1, g.NumNodes):
                    nd = g.GetXrefNode(i)
                    if str(nd.XrefStatus) != "Resolved":
                        hong.append("%s(%s)" % (nd.Name, nd.XrefStatus))
            except Exception as ex:
                hong.append("graph? %s" % ex)
            r["xref_hong"] = hong
            ghi("toa_" + f[:-4] + ".json", r)
            print("%-36s chen %3d bao %d hl %d circ %d%s" % (
                f, len(r["inserts"]), len(r["bao"]), len(r["hanhlang_ve"]),
                len(r["hanhlang_circ"]), ("  XREF HONG: " + ", ".join(hong)) if hong else ""))
    ghi("toa_loi_bb.json", bbs)
    ghi("meta_text_block.json", mt)
    ghi("insbase.json", ib)
    print("XONG - chay tiep: python scripts/boc_cad_p16.py " + OUT)


main()
