# -*- coding: utf-8 -*-
"""
Unitmix: dung model Revit goc tu goi BIM (*.bim.json) roi sinh ho so ban ve.
Chay trong Revit (pyRevit, RevitPythonShell hoac MDI connector), du an tao tu template metric:
    dung_tat_ca(doc, r"...\Long_Bien_i2.bim.json", r"...\thu_muc_ra")
Tung buoc goi rieng duoc: buoc_level, buoc_model, buoc_ban_ve, buoc_pdf.
Don vi goi: mm, toa do tinh tu tam toa.
"""
import json, math, os
import clr
from Autodesk.Revit.DB import *
from Autodesk.Revit.DB.Architecture import *
from Autodesk.Revit.DB.Structure import StructuralType
from System.Collections.Generic import HashSet, List

MM = 1.0 / 304.8
CAO_LAN_CAN = 1100.0
CAO_TUM = 3000.0


class BoCanhBao(IFailuresPreprocessor):
    def PreprocessFailures(self, a):
        co = False
        for f in a.GetFailureMessages():
            if f.GetSeverity() == FailureSeverity.Warning:
                a.DeleteWarning(f)
            elif f.HasResolutions():
                a.ResolveFailure(f)
                co = True
        return FailureProcessingResult.ProceedWithCommit if co else FailureProcessingResult.Continue


class GD(object):
    """Transaction nuot canh bao."""
    def __init__(self, doc, ten):
        self.t = Transaction(doc, ten)
    def __enter__(self):
        self.t.Start()
        o = self.t.GetFailureHandlingOptions()
        o.SetFailuresPreprocessor(BoCanhBao())
        o.SetClearAfterRollback(True)
        self.t.SetFailureHandlingOptions(o)
        return self.t
    def __exit__(self, kieu, gt, tb):
        if kieu:
            self.t.RollBack()
        else:
            self.t.Commit()
        return False


def doc_goi(duong):
    with open(duong, 'rb') as f:
        return json.loads(f.read().decode('utf-8'))


def pt(p, z=0.0):
    return XYZ(p[0] * MM, p[1] * MM, z * MM)


def ten(e):
    return Element.Name.GetValue(e)


def tat_ca(doc, lop):
    return list(FilteredElementCollector(doc).OfClass(lop))


def theo_loai(doc, bic):
    return list(FilteredElementCollector(doc).OfCategory(bic).WhereElementIsElementType())


def cao_tang(g):
    return dict((t['ten'], t['cao']) for t in g['tang'])


def level_theo_ten(doc):
    return dict((l.Name, l) for l in tat_ca(doc, Level))


def buoc_level(doc, g):
    """Level + mat bang can dung. Dat ten level theo goi."""
    cu = sorted(tat_ca(doc, Level), key=lambda l: l.Elevation)
    with GD(doc, 'Unitmix level'):
        for i, t in enumerate(g['tang']):
            if i < len(cu):
                l = cu[i]
                l.Name = '_tam_%d' % i
                l.Elevation = t['cao'] * MM
            else:
                l = Level.Create(doc, t['cao'] * MM)
            l.Name = t['ten']
        doc.ProjectInformation.Name = u'%s - %s' % (g['duAn'], g['mau'])
    return level_theo_ten(doc)


def kieu_tuong(doc, nho, day, nhom):
    day = max(50, int(round(day / 10.0)) * 10)
    k = '%s %d' % (nhom, day)
    if k in nho:
        return nho[k]
    goc = [w for w in tat_ca(doc, WallType) if w.Kind == WallKind.Basic and ten(w) == 'Generic - 200mm'][0]
    m = [w for w in tat_ca(doc, WallType) if ten(w) == 'UM ' + k]
    w = m[0] if m else goc.Duplicate('UM ' + k)
    cs = w.GetCompoundStructure()
    for i in range(cs.LayerCount):
        if i == 0:
            cs.SetLayerWidth(0, day * MM)
    w.SetCompoundStructure(cs)
    nho[k] = w
    return w


def kieu_san(doc, day):
    n = 'UM San %d' % int(day)
    m = [f for f in tat_ca(doc, FloorType) if ten(f) == n]
    if m:
        return m[0]
    goc = [f for f in tat_ca(doc, FloorType) if ten(f).startswith('Generic Floor')][0]
    f = goc.Duplicate(n)
    cs = f.GetCompoundStructure()
    cs.SetLayerWidth(cs.GetFirstCoreLayerIndex() if cs.LayerCount > 1 else 0, day * MM)
    f.SetCompoundStructure(cs)
    return f


def kieu_cua(doc, nho, ho, rong, cao, tien_to):
    rong = int(round(rong / 10.0)) * 10
    k = '%s %dx%d' % (tien_to, rong, int(cao))
    if k in nho:
        return nho[k]
    goc = [s for s in theo_loai(doc, ho) if s.GetType().Name == 'FamilySymbol' or True]
    m = [s for s in goc if ten(s) == k]
    if m:
        nho[k] = m[0]
        return m[0]
    s = goc[0].Duplicate(k)
    for pn, v in (('Width', rong), ('Height', cao)):
        p = s.LookupParameter(pn)
        if p and not p.IsReadOnly:
            p.Set(v * MM)
    if not s.IsActive:
        s.Activate()
    nho[k] = s
    return s


def kc_doan(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    l = dx * dx + dy * dy
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) if l else 0.0
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def vong_cong(chan):
    c = CurveLoop()
    n = len(chan)
    for i in range(n):
        a, b = chan[i], chan[(i + 1) % n]
        if math.hypot(a[0] - b[0], a[1] - b[1]) > 2:
            c.Append(Line.CreateBound(pt(a), pt(b)))
    return c


def kieu_lan_can(doc):
    return tat_ca(doc, RailingType)[0]


def khoi_hop(a, b, rong, z0, cao):
    """Khoi hop theo tim a-b (mm), z0 tuyet doi, hoac None neu suy bien."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    if L < 50:
        return None
    nx, ny = -dy / L * rong / 2.0, dx / L * rong / 2.0
    v = [(a[0] + nx, a[1] + ny), (b[0] + nx, b[1] + ny), (b[0] - nx, b[1] - ny), (a[0] - nx, a[1] - ny)]
    cl = CurveLoop()
    for i in range(4):
        cl.Append(Line.CreateBound(pt(v[i], z0), pt(v[(i + 1) % 4], z0)))
    if not cl.IsCounterclockwise(XYZ.BasisZ):
        cl.Flip()
    ds = List[CurveLoop]()
    ds.Add(cl)
    return GeometryCreationUtilities.CreateExtrusionGeometry(ds, XYZ.BasisZ, cao * MM)


def dat_khoi(doc, bic, ten_khoi, khoi):
    khoi = [k for k in khoi if k is not None]
    if not khoi:
        return 0
    ds = DirectShape.CreateElement(doc, ElementId(bic))
    hinh = List[GeometryObject]()
    for k in khoi:
        hinh.Add(k)
    ds.SetShape(hinh)
    ds.Name = ten_khoi
    return 1


def buoc_ngoai_that(doc, g):
    """Dam bien va louver moi tang: khoi hinh hoc dung kich thuoc vi template khong co family dam, louver."""
    theo_id = dict((b['id'], b) for b in g['boCuc'])
    so_dam, so_lv = 0, 0
    tangs = [t for t in g['tang'] if t['loai'] == 'dien_hinh']
    for t in tangs:
        bc = theo_id[t['boCuc']]
        with GD(doc, 'Unitmix dam louver'):
            so_dam += dat_khoi(doc, BuiltInCategory.OST_StructuralFraming, u'Dam bien ' + t['ten'], [khoi_hop(d['a'], d['b'], d['rong'], t['cao'] + g['caoTang'] - d['cao'], d['cao']) for d in bc.get('dam', [])])
            nan = []
            for l in bc.get('louver', []):
                n = max(1, int(l['cao'] // 150))
                for i in range(n):
                    nan.append(khoi_hop(l['a'], l['b'], 90, t['cao'] + l['bau'] + i * 150, 30))
            so_lv += dat_khoi(doc, BuiltInCategory.OST_GenericModel, u'Louver ' + t['ten'], nan)
    return dict(dam=so_dam, louver=so_lv)


def dung_bo_cuc(doc, g, bc, lv, cao, nho):
    """Dung mot bo cuc tai level lv, tra ve danh sach id. cao = chieu cao tuong (mm)."""
    ids = []
    tuong = []
    tam = doc.GetElement(lv.Id)
    if bc['id'] != 'mai_khong':
        san = kieu_san(doc, g['daySan'])
        try:
            loops = List[CurveLoop]()
            loops.Add(vong_cong(bc['chan']))
            f = Floor.Create(doc, loops, san.Id, lv.Id)
            ids.append(f.Id)
        except Exception:
            pass
    cw = [w for w in tat_ca(doc, WallType) if w.Kind == WallKind.Curtain]
    for t in bc['tuong']:
        a, b = t['a'], t['b']
        if math.hypot(a[0] - b[0], a[1] - b[1]) < 60:
            continue
        h = cao
        if t['loai'] == 'lan_can' and bc['id'] != 'mai':  # ban cong: Railing that, mai giu tuong can
            try:
                vl = CurveLoop()
                vl.Append(Line.CreateBound(pt(a), pt(b)))
                ids.append(Railing.Create(doc, vl, kieu_lan_can(doc).Id, lv.Id).Id)
                continue
            except Exception:
                pass
        if t['loai'] == 'lan_can':
            h = CAO_LAN_CAN
            kieu = kieu_tuong(doc, nho['tuong'], t['day'], 'Lan can')
        elif t['loai'] == 'kinh' and cw:
            kieu = cw[0]
        elif bc['id'] == 'mai':
            h = CAO_TUM
            kieu = kieu_tuong(doc, nho['tuong'], t['day'], 'Tum')
        else:
            kieu = kieu_tuong(doc, nho['tuong'], t['day'], {'ngoai': 'Ngoai', 'trong': 'Trong', 'loi': 'Loi'}.get(t['loai'], 'Trong'))
        try:
            w = Wall.Create(doc, Line.CreateBound(pt(a), pt(b)), kieu.Id, lv.Id, h * MM, 0.0, False, False)
            tuong.append((w, t))
            ids.append(w.Id)
        except Exception:
            pass
    doc.Regenerate()
    so_cua = 0
    for c in bc['cua']:
        p = (c['x'], c['y'])
        tot = None
        for w, t in tuong:
            d = kc_doan(p, t['a'], t['b'])
            if d <= t['day'] / 2.0 + 25 and (tot is None or d < tot[0]):
                tot = (d, w)
        if tot is None or c['rong'] < 200:
            continue
        la_so = c['loai'] == 'so'
        s = kieu_cua(doc, nho['cua'], BuiltInCategory.OST_Windows if la_so else BuiltInCategory.OST_Doors, c['rong'], c['cao'], 'UM SO' if la_so else ('UM TRUOT' if c['loai'] == 'truot' else 'UM DI'))
        try:
            i = doc.Create.NewFamilyInstance(XYZ(p[0] * MM, p[1] * MM, lv.Elevation + c['bau'] * MM), s, tot[1], lv, StructuralType.NonStructural)
            if la_so:
                q = i.get_Parameter(BuiltInParameter.INSTANCE_SILL_HEIGHT_PARAM)
                if q and not q.IsReadOnly:
                    q.Set(c['bau'] * MM)
            ids.append(i.Id)
            so_cua += 1
        except Exception:
            pass
    doc.Regenerate()
    so_phong = 0
    dem_can = {}
    for k in bc['phong']:
        try:
            r = doc.Create.NewRoom(lv, UV(k['x'] * MM, k['y'] * MM))
            r.Name = k['ten']
            dem_can[k['can']] = dem_can.get(k['can'], 0) + 1
            r.Number = '%s.%d' % (k['can'], dem_can[k['can']])
            q = r.get_Parameter(BuiltInParameter.ROOM_DEPARTMENT)
            if q:
                q.Set(k['can'])
            ids.append(r.Id)
            so_phong += 1
        except Exception:
            pass
    return ids, len(tuong), so_cua, so_phong


def buoc_model(doc, g):
    """Dung moi bo cuc mot lan o tang dau, nhom Model Group, dat len cac tang con lai."""
    lv = level_theo_ten(doc)
    theo_id = dict((b['id'], b) for b in g['boCuc'])
    ds = {}
    for t in g['tang']:
        ds.setdefault(t['boCuc'], []).append(t)
    kq = {}
    nho = {'tuong': {}, 'cua': {}}
    for id_bc, tangs in ds.items():
        bc = theo_id[id_bc]
        dau = tangs[0]
        i = [x['ten'] for x in g['tang']].index(dau['ten'])
        cao = (g['tang'][i + 1]['cao'] - dau['cao']) if i + 1 < len(g['tang']) else 3000
        with GD(doc, 'Unitmix ' + id_bc):
            ids, nt, nc, np_ = dung_bo_cuc(doc, g, bc, lv[dau['ten']], cao, nho)
        kq[id_bc] = dict(tuong=nt, cua=nc, phong=np_, tang=len(tangs))
        if len(tangs) > 1:
            co = [x for x in ids if doc.GetElement(x) is not None]
            with GD(doc, 'Unitmix nhom ' + id_bc):
                ids_nhom = List[ElementId]()
                for x in co:
                    e = doc.GetElement(x)
                    if not isinstance(e, Room):
                        ids_nhom.Add(x)
                gr = doc.Create.NewGroup(ids_nhom)
                gr.GroupType.Name = u'%s - %s' % (g['mau'], bc['ten'])
            with GD(doc, 'Unitmix dat ' + id_bc):
                # goc nhom la tam khung bao luc tao, khong phai goc toa do: dat theo goc cua nhom dau
                g0 = gr.Location.Point
                for t in tangs[1:]:
                    doc.Create.PlaceGroup(XYZ(g0.X, g0.Y, g0.Z + (t['cao'] - dau['cao']) * MM), gr.GroupType)
    # cot tang de
    de = [t for t in g['tang'] if t['loai'] == 'de']
    if de and g['cot']:
        s = theo_loai(doc, BuiltInCategory.OST_Columns)
        s = [x for x in s if '610' in ten(x)] or s
        if s:
            with GD(doc, 'Unitmix cot'):
                if not s[0].IsActive:
                    s[0].Activate()
                for t in de:
                    for p in g['cot']:
                        try:
                            c = doc.Create.NewFamilyInstance(pt(p), s[0], lv[t['ten']], StructuralType.NonStructural)
                            q = c.get_Parameter(BuiltInParameter.FAMILY_TOP_LEVEL_OFFSET_PARAM)
                        except Exception:
                            pass
    kq['thang'] = buoc_thang(doc, g)
    try:
        kq['ngoai_that'] = buoc_ngoai_that(doc, g)
    except Exception as ex:
        kq['ngoai_that'] = str(ex)[:160]
    return kq


def dung_thang(doc, th, lv0, lv1, cao):
    """Thang bo hai ve, chieu nghi tu dong giua hai ve."""
    bac = int(round(math.hypot(th['b'][0] - th['a'][0], th['b'][1] - th['a'][1]) / th['sauBac'])) + 1
    pham = StairsEditScope(doc, 'Unitmix thang')
    sid = pham.Start(lv0.Id, lv1.Id)
    t = Transaction(doc, 'Unitmix ve thang')
    t.Start()
    o = t.GetFailureHandlingOptions()
    o.SetFailuresPreprocessor(BoCanhBao())
    t.SetFailureHandlingOptions(o)
    try:
        z0 = lv0.Elevation  # duong ve tinh theo cao do tuyet doi
        s = doc.GetElement(sid)
        s.DesiredRisersNumber = 2 * bac
        s.ActualTreadDepth = th['sauBac'] * MM
        r1 = StairsRun.CreateStraightRun(doc, sid, Line.CreateBound(pt(th['a']).Add(XYZ(0, 0, z0)), pt(th['b']).Add(XYZ(0, 0, z0))), StairsRunJustification.Center)
        r1.ActualRunWidth = th['rong'] * MM
        z = z0 + r1.TopElevation
        r2 = StairsRun.CreateStraightRun(doc, sid, Line.CreateBound(pt(th['c']).Add(XYZ(0, 0, z)), pt(th['d']).Add(XYZ(0, 0, z))), StairsRunJustification.Center)
        r2.ActualRunWidth = th['rong'] * MM
        StairsLanding.CreateAutomaticLanding(doc, r1.Id, r2.Id)
        t.Commit()
    except Exception:
        if t.HasStarted() and not t.HasEnded():
            t.RollBack()
        pham.Cancel()
        raise
    pham.Commit(BoCanhBao())
    return doc.GetElement(sid)


def buoc_thang(doc, g):
    """Lo thong tang cho gieng thang may, buong thang; thang bo that, tang dien hinh noi bang MultistoryStairs."""
    dh = [b for b in g['boCuc'] if b['id'] == 'dh'][0]
    lv = level_theo_ten(doc)
    tangs = [t for t in g['tang'] if t['loai'] in ('de', 'dien_hinh', 'mai')]
    with GD(doc, 'Unitmix lo thong tang'):
        for lo in dh['lo']:
            ca = CurveArray()
            n = len(lo['vong'])
            for i in range(n):
                ca.Append(Line.CreateBound(pt(lo['vong'][i]), pt(lo['vong'][(i + 1) % n])))
            doc.Create.NewOpening(lv[tangs[0]['ten']], lv[tangs[-1]['ten']], ca)
    with GD(doc, 'Unitmix cabin thang may'):
        z0 = tangs[0]['cao']
        so_cabin = 0
        for lo in dh['lo']:
            if lo['loai'] != 'thang_may':
                continue
            n = len(lo['vong'])
            cx = sum(p[0] for p in lo['vong']) / float(n)
            cy = sum(p[1] for p in lo['vong']) / float(n)
            v = [(cx + (p[0] - cx) * 0.75, cy + (p[1] - cy) * 0.75) for p in lo['vong']]
            cl = CurveLoop()
            for i in range(n):
                cl.Append(Line.CreateBound(pt(v[i], z0), pt(v[(i + 1) % n], z0)))
            if not cl.IsCounterclockwise(XYZ.BasisZ):
                cl.Flip()
            ds_cl = List[CurveLoop]()
            ds_cl.Add(cl)
            khoi = GeometryCreationUtilities.CreateExtrusionGeometry(ds_cl, XYZ.BasisZ, 2400 * MM)
            ds = DirectShape.CreateElement(doc, ElementId(BuiltInCategory.OST_SpecialityEquipment))
            hinh = List[GeometryObject]()
            hinh.Add(khoi)
            ds.SetShape(hinh)
            so_cabin += 1
            ds.Name = 'Thang may %d' % so_cabin
    so_thang = 0
    loi = []
    dien_hinh = [t for t in tangs if t['loai'] == 'dien_hinh']
    for th in dh['thang']:
        for i in range(len(tangs) - 1):  # tang de cao khac, tang tren cung cua chuoi dien hinh
            a, b = tangs[i], tangs[i + 1]
            if a['loai'] == 'dien_hinh' and a is not dien_hinh[0]:
                continue
            try:
                s = dung_thang(doc, th, lv[a['ten']], lv[b['ten']], b['cao'] - a['cao'])
                so_thang += 1
            except Exception as ex:
                loi.append(str(ex)[:120])
                continue
            if a is dien_hinh[0] and len(dien_hinh) > 1:
                try:
                    with GD(doc, 'Unitmix thang nhieu tang'):
                        ms = MultistoryStairs.Create(s)
                        ids = HashSet[ElementId]()
                        for t in tangs[tangs.index(a) + 2:]:  # thang goc da toi tang ke, noi tiep cac tang tren
                            if ms.CanConnectLevel(lv[t['ten']].Id):
                                ids.Add(lv[t['ten']].Id)
                        if ids.Count:
                            ms.ConnectLevels(ids)
                except Exception as ex:
                    loi.append(str(ex)[:120])
    return dict(lo=len(dh['lo']), ve=so_thang, cabin=so_cabin, loi=loi[:3])


def khung(g):
    bc = [b for b in g['boCuc'] if b['id'] == 'dh'][0]
    xs = [p[0] for p in bc['chan']]
    ys = [p[1] for p in bc['chan']]
    return min(xs), min(ys), max(xs), max(ys)


def khung_ngoai(g):
    """Khung bao moi bo cuc: tang de thuong rong hon tang dien hinh."""
    xs, ys = [], []
    for b in g['boCuc']:
        xs += [p[0] for p in b['chan']]
        ys += [p[1] for p in b['chan']]
    return min(xs), min(ys), max(xs), max(ys)


def khop_khung_view(doc, v, g, le=6000.0):
    """Khung view theo ca tang de, dua dau cao do ra ngoai nha hai ben."""
    x0, y0, x1, y1 = khung_ngoai(g)
    b = v.CropBox
    R, O = b.Transform.BasisX, b.Transform.Origin
    ds = [(pt((x, y)) - O).DotProduct(R) for x in (x0, x1) for y in (y0, y1)]
    a, c = min(ds), max(ds)
    b.Min = XYZ(a - le * MM, b.Min.Y, b.Min.Z)
    b.Max = XYZ(c + le * MM, b.Max.Y, b.Max.Z)
    v.CropBox = b
    doc.Regenerate()
    trai, phai = a - (le - 1500) * MM, c + (le - 1500) * MM
    for lv in FilteredElementCollector(doc).OfClass(Level):
        if not lv.CanBeVisibleInView(v):  # level mac dinh ngan hon nha: mat dung ke rong truoc, mat cat moi thay
            continue
        for loai in (DatumExtentType.Model, DatumExtentType.ViewSpecific):
            ds_c = lv.GetCurvesInView(loai, v)
            if ds_c.Count == 0:
                continue
            e0, e1 = ds_c[0].GetEndPoint(0), ds_c[0].GetEndPoint(1)
            s0, s1 = (e0 - O).DotProduct(R), (e1 - O).DotProduct(R)
            d0, d1 = (trai, phai) if s1 > s0 else (phai, trai)
            lv.SetCurveInView(loai, v, Line.CreateBound(e0 + R * (d0 - s0), e1 + R * (d1 - s1)))
        lv.ShowBubbleInView(DatumEnds.End0, v)
        lv.ShowBubbleInView(DatumEnds.End1, v)


def ti_le(rong_mm, cao_mm, kho_w=1000.0, kho_h=720.0):
    for s in (100, 150, 200, 250, 300, 400, 500):
        if rong_mm / s <= kho_w and cao_mm / s <= kho_h:
            return s
    return 500


def kieu_view(doc, ho):
    return [v for v in tat_ca(doc, ViewFamilyType) if v.ViewFamily == ho][0]


def tao_mat_bang(doc, g, lv, ten_v, s):
    for q in tat_ca(doc, ViewPlan):
        if q.Name == ten_v:
            return q
    v = ViewPlan.Create(doc, kieu_view(doc, ViewFamily.FloorPlan).Id, lv.Id)
    v.Name = ten_v
    v.Scale = s
    v.DetailLevel = ViewDetailLevel.Medium
    x0, y0, x1, y1 = khung(g)
    b = BoundingBoxXYZ()
    b.Min = XYZ((x0 - 3000) * MM, (y0 - 3000) * MM, -100)
    b.Max = XYZ((x1 + 3000) * MM, (y1 + 3000) * MM, 100)
    v.CropBox = b
    v.CropBoxActive = True
    v.CropBoxVisible = False
    return v


def kieu_chu(doc, cao_mm):
    n = 'UM %.1fmm' % cao_mm
    m = [k for k in tat_ca(doc, TextNoteType) if ten(k) == n]
    if m:
        return m[0]
    k = tat_ca(doc, TextNoteType)[0].Duplicate(n)
    k.get_Parameter(BuiltInParameter.TEXT_SIZE).Set(cao_mm * MM)
    return k


def nhan_can(doc, g, v, bc):
    kieu = kieu_chu(doc, 2.2)
    for c in bc['can']:
        n = u'%s  %s\nTT %.1f m2' % (c['so'], c['ten'].split(' · ')[0], c['dt_tt'])
        TextNote.Create(doc, v.Id, pt((c['x'], c['y'])), n, kieu.Id)


def ky_hieu(doc, v, bc):
    for l in bc['kyHieu']:
        for i in range(len(l) - 1):
            a, b = l[i], l[i + 1]
            if math.hypot(a[0] - b[0], a[1] - b[1]) > 30:
                try:
                    doc.Create.NewDetailCurve(v, Line.CreateBound(pt(a), pt(b)))
                except Exception:
                    pass


def dat_dxf(doc, g, v, dxf):
    """Dua dung tep .dxf cua nut Xuat CAD vao mat bang (chi view nay), an cau kien model de ban ve la net CAD."""
    o = DWGImportOptions()
    o.ThisViewOnly = True
    o.Unit = ImportUnit.Millimeter
    o.Placement = ImportPlacement.Origin
    o.ColorMode = ImportColorMode.BlackAndWhite
    kq = clr.Reference[ElementId]()
    doc.Import(dxf, o, v, kq)
    e = doc.GetElement(kq.Value)
    e.Pinned = False
    c = g.get('gocCad', [0, 0])
    ElementTransformUtils.MoveElement(doc, e.Id, XYZ(-c[0] * MM, -c[1] * MM, 0))
    for bic in (BuiltInCategory.OST_Walls, BuiltInCategory.OST_Doors, BuiltInCategory.OST_Windows, BuiltInCategory.OST_Rooms, BuiltInCategory.OST_Floors, BuiltInCategory.OST_SectionBox, BuiltInCategory.OST_Stairs, BuiltInCategory.OST_StairsRailing, BuiltInCategory.OST_ShaftOpening, BuiltInCategory.OST_SpecialityEquipment, BuiltInCategory.OST_StructuralFraming, BuiltInCategory.OST_GenericModel, BuiltInCategory.OST_Railings):
        try:
            v.SetCategoryHidden(ElementId(bic), True)
        except Exception:
            pass
    return e.Id


def the_phong(doc, v, lv):
    n = 0
    for r in FilteredElementCollector(doc).OfCategory(BuiltInCategory.OST_Rooms):
        if r.LevelId == lv.Id and r.Area > 0:
            c = r.Location.Point
            try:
                doc.Create.NewRoomTag(LinkElementId(r.Id), UV(c.X, c.Y), v.Id)
                n += 1
            except Exception:
                pass
    return n


def huong_canh(bc):
    """Cac huong tuong ngoai (do, mod 90) chiem tu 10% tong chieu dai: toa thang mot huong, toa xien nhieu huong."""
    tong = {}
    for t in bc['tuong']:
        if t['loai'] != 'ngoai':
            continue
        dx, dy = t['b'][0] - t['a'][0], t['b'][1] - t['a'][1]
        k = int(round(math.degrees(math.atan2(dy, dx)) % 90)) % 90
        tong[k] = tong.get(k, 0) + math.hypot(dx, dy)
    tat = sum(tong.values()) or 1.0
    ds = []
    for k in sorted(tong, key=lambda x: -tong[x]):
        if tong[k] / tat >= 0.1 and all(min((k - h) % 90, (h - k) % 90) > 3 for h in ds):
            ds.append(k)
    return ds


def truc_theo_huong(bc, goc):
    """Vi tri truc song song huong goc (do): tu tuong dai cung huong, gom cum, moi truc (s, t0, t1) mm."""
    w = (math.cos(math.radians(goc)), math.sin(math.radians(goc)))
    n = (-w[1], w[0])
    ds = []
    for t in bc['tuong']:
        if t['loai'] not in ('ngoai', 'trong'):
            continue
        dx, dy = t['b'][0] - t['a'][0], t['b'][1] - t['a'][1]
        L = math.hypot(dx, dy)
        if L < 2000:
            continue
        if abs(dx * n[0] + dy * n[1]) / L > 0.03:
            continue
        ta = t['a'][0] * w[0] + t['a'][1] * w[1]
        tb = t['b'][0] * w[0] + t['b'][1] * w[1]
        ds.append((t['a'][0] * n[0] + t['a'][1] * n[1], min(ta, tb), max(ta, tb), L))
    ds.sort()
    cum = []
    for x in ds:
        if cum and x[0] - cum[-1][-1][0] <= 1500:
            cum[-1].append(x)
        else:
            cum.append([x])
    ra = []
    for c in cum:
        L = sum(x[3] for x in c)
        if L >= 5000:
            ra.append((sum(x[0] * x[3] for x in c) / L, min(x[1] for x in c), max(x[2] for x in c), L))
    if ra:  # bo truc phu it tuong (vach sanh lech khoi canh), con lai cung do dai de dau truc xep hang ngoai nha
        L = sorted(x[3] for x in ra)[len(ra) // 2]
        ra = [x for x in ra if x[3] >= 0.5 * L]
    if ra:  # moi truc cung mot do dai de dau truc xep thang hang ngoai nha
        t0, t1 = min(x[1] for x in ra), max(x[2] for x in ra)
        ra = [(x[0], t0, t1) for x in ra]
    return w, n, ra


def trong_vong(p, vong):
    """Diem p nam trong da giac (mm)."""
    co = False
    n = len(vong)
    for i in range(n):
        a, b = vong[i], vong[(i + 1) % n]
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]:
            co = not co
    return co


def luoi_truc_xien(doc, g, v, bc, huong):
    """Toa xien: moi canh mot ho truc theo dung huong canh. Ho nhieu truc danh so, ho it truc danh chu."""
    ho = []
    for h in huong:
        for goc in (h, h + 90):
            w, n, ds = truc_theo_huong(bc, goc)
            # hai dau deu trong nha la truc phu cua sanh giua hai canh: bo
            ds = [x for x in ds if not all(trong_vong((n[0] * x[0] + w[0] * t, n[1] * x[0] + w[1] * t), bc['chan']) for t in (x[1] - 3000, x[2] + 3000))]
            if ds:
                ho.append((w, n, ds))
    dem = 0
    an_dau = []
    for w, n, ds in ho:
        luoi = []
        for s, t0, t1 in ds:
            a = (n[0] * s + w[0] * (t0 - 3000), n[1] * s + w[1] * (t0 - 3000))
            b = (n[0] * s + w[0] * (t1 + 3000), n[1] * s + w[1] * (t1 + 3000))
            q = Grid.Create(doc, Line.CreateBound(pt(a), pt(b)))
            dem += 1
            q.Name = '_t%d' % dem
            luoi.append(q)
            an_dau.append((q, a, b))
        doc.Regenerate()
        if len(luoi) >= 2:
            t = min(x[1] for x in ds) - 1500
            r = ReferenceArray()
            for q in luoi:
                r.Append(Reference(q))
            A = (n[0] * ds[0][0] + w[0] * t, n[1] * ds[0][0] + w[1] * t)
            B = (n[0] * ds[-1][0] + w[0] * t, n[1] * ds[-1][0] + w[1] * t)
            try:
                doc.Create.NewDimension(v, Line.CreateBound(pt(A), pt(B)), r)
            except Exception:
                pass
    doc.Regenerate()
    ds_v = [x for x in tat_ca(doc, ViewPlan) if not x.IsTemplate and x.ViewType == ViewType.FloorPlan and x.GetPrimaryViewId() == ElementId.InvalidElementId]
    for q, a, b in an_dau:  # dau truc lot vao canh khac: an ky hieu de khong de len mat bang
        for dau, p in ((DatumEnds.End0, a), (DatumEnds.End1, b)):
            if trong_vong(p, bc['chan']):
                for x in ds_v:
                    if q.CanBeVisibleInView(x):
                        q.HideBubbleInView(dau, x)
    return dat_ten_truc(doc)


def dat_ten_truc(doc):
    """Moi canh hai ho truc vuong goc: ho nhieu truc danh so, ho it truc danh chu, tang dan theo vi tri."""
    ho = {}
    for q in tat_ca(doc, Grid):
        c = q.Curve
        d = c.GetEndPoint(1) - c.GetEndPoint(0)
        goc = int(round(math.degrees(math.atan2(d.Y, d.X)) % 180)) % 180
        k = next((x for x in ho if min(abs(x - goc), 180 - abs(x - goc)) <= 2), goc)
        ho.setdefault(k, []).append(q)
    cap = {}
    for k in ho:
        c = next((x for x in cap if min((k - x) % 90, (x - k) % 90) <= 2), k % 90)
        cap.setdefault(c, []).append(k)
    tam = 0
    for ds in ho.values():
        for q in ds:
            tam += 1
            q.Name = '_d%d' % tam
    so, chu = 0, 0
    for c in sorted(cap, key=lambda x: -sum(len(ho[k]) for k in cap[x])):
        hai = sorted(cap[c], key=lambda k: -len(ho[k]))
        for i, k in enumerate(hai):
            n = XYZ(-math.sin(math.radians(k)), math.cos(math.radians(k)), 0)
            for q in sorted(ho[k], key=lambda g: g.Curve.GetEndPoint(0).DotProduct(n)):
                if i == 0:
                    so += 1
                    q.Name = str(so)
                else:
                    chu += 1
                    q.Name = chr(64 + chu) if chu <= 26 else 'A%d' % (chu - 26)
    return so, chu


def luoi_truc(doc, g, v):
    """Luoi truc tu tuong ngoai song song truc toa do, kem chuoi kich thuoc tong."""
    bc = [b for b in g['boCuc'] if b['id'] == 'dh'][0]
    H = g['tang'][-1]['cao']
    huong = huong_canh(bc)
    if len(huong) > 1 or (huong and huong[0] not in (0, 89)):
        kq = luoi_truc_xien(doc, g, v, bc, huong)
        for q in FilteredElementCollector(doc).OfClass(Grid):
            q.SetVerticalExtents(-1500 * MM, (H + 3000) * MM)
        return kq
    x0, y0, x1, y1 = khung(g)
    xs = [p[0] for p in g['cot']]
    ys = [p[1] for p in g['cot']]
    def cum(ds, kc):
        r = []
        for d in sorted(ds):
            if not r or d - r[-1] > kc:
                r.append(d)
        return r
    xs, ys = cum(xs, 2400), cum(ys, 2400)
    gx, gy = [], []
    for i, x in enumerate(xs):
        q = Grid.Create(doc, Line.CreateBound(pt((x, y0 - 5000)), pt((x, y1 + 2000))))
        q.Name = str(i + 1)
        gx.append(q)
    for i, y in enumerate(ys):
        q = Grid.Create(doc, Line.CreateBound(pt((x0 - 5000, y)), pt((x1 + 2000, y))))
        q.Name = chr(65 + i) if i < 26 else 'A%d' % (i - 25)
        gy.append(q)
    doc.Regenerate()
    for q in gx + gy:  # truc phu het chieu cao nha trong mat dung, mat cat
        q.SetVerticalExtents(-1500 * MM, (H + 3000) * MM)
    def chuoi(ds, a, b):
        if len(ds) < 2:
            return
        r = ReferenceArray()
        for q in ds:
            r.Append(Reference(q))
        doc.Create.NewDimension(v, Line.CreateBound(pt(a), pt(b)), r)
    chuoi(gx, (x0, y0 - 4000), (x1, y0 - 4000))
    chuoi(gy, (x0 - 4000, y0), (x0 - 4000, y1))
    return len(gx), len(gy)


def tao_mat_dung(doc, g, mb, s):
    """Bon moc dat ngoai nha, moi moc mot view nhin vao tam."""
    x0, y0, x1, y1 = khung(g)
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    kc = 12000.0
    H = g['tang'][-1]['cao'] + 4000
    kieu = kieu_view(doc, ViewFamily.Elevation)
    ds = ((u'Mặt đứng hướng +Y', (cx, y1 + kc), (0, 1)), (u'Mặt đứng hướng +X', (x1 + kc, cy), (1, 0)), (u'Mặt đứng hướng -Y', (cx, y0 - kc), (0, -1)), (u'Mặt đứng hướng -X', (x0 - kc, cy), (-1, 0)))
    ra = []
    for ten_v, p, h in ds:
        m = ElevationMarker.CreateElevationMarker(doc, kieu.Id, pt(p), s)
        doc.Regenerate()
        v = None
        for i in range(4):
            q = m.CreateElevation(doc, mb.Id, i)
            d = q.ViewDirection
            if d.X * h[0] + d.Y * h[1] > 0.9:
                v = q
                break
            doc.Delete(q.Id)
        if v is None:
            continue
        v.Name = ten_v
        v.Scale = s
        doc.Regenerate()
        b = v.CropBox
        rong = (x1 - x0 if h[1] else y1 - y0) / 2.0 + 4000
        b.Min = XYZ(-rong * MM, -2000 * MM, b.Min.Z)
        b.Max = XYZ(rong * MM, H * MM, b.Max.Z)
        v.CropBox = b
        v.CropBoxActive = True
        v.CropBoxVisible = False
        v.get_Parameter(BuiltInParameter.VIEWER_BOUND_FAR_CLIPPING).Set(0)  # khong cat xa: lo phan nha phia sau
        khop_khung_view(doc, v, g)
        ra.append(v)
    return ra


def tao_mat_cat(doc, g, s):
    x0, y0, x1, y1 = khung(g)
    H = g['tang'][-1]['cao']
    kieu = kieu_view(doc, ViewFamily.Section)
    rong = x1 - x0
    tam_y = y0 + (y1 - y0) * 0.25  # cat qua can ho, khong qua hanh lang
    b = BoundingBoxXYZ()
    t = Transform.Identity
    t.Origin = pt(((x0 + x1) / 2.0, tam_y), 0)
    t.BasisX = XYZ.BasisX
    t.BasisY = XYZ.BasisZ
    t.BasisZ = -XYZ.BasisY
    b.Transform = t
    b.Min = XYZ(-(rong / 2 + 3000) * MM, -3000 * MM, -100 * MM)
    b.Max = XYZ((rong / 2 + 3000) * MM, (H + 4000) * MM, (y1 - y0 + 3000) * MM)
    v = ViewSection.CreateSection(doc, kieu.Id, b)
    v.Name = u'Mặt cắt A-A'
    v.Scale = s
    doc.Regenerate()
    khop_khung_view(doc, v, g)
    return v


def bang_phong(doc, g):
    v = ViewSchedule.CreateSchedule(doc, ElementId(BuiltInCategory.OST_Rooms))
    v.Name = u'Bảng phòng tầng điển hình'
    d = v.Definition
    tr = {}
    for f in d.GetSchedulableFields():
        tr[f.GetName(doc)] = f
    tf = {}
    for k, tieu_de in (('Department', u'Căn'), ('Number', u'Số phòng'), ('Name', u'Tên phòng'), ('Area', u'Diện tích')):
        if k in tr:
            tf[k] = d.AddField(tr[k])
            tf[k].ColumnHeading = tieu_de
    if 'Department' in tf:
        q = ScheduleSortGroupField(tf['Department'].FieldId)
        q.ShowHeader = True
        q.ShowFooter = True
        d.AddSortGroupField(q)
    if 'Area' in tf:
        tf['Area'].DisplayType = ScheduleFieldDisplayType.Totals
    d.ShowGrandTotal = True
    d.ShowGrandTotalTitle = True
    d.GrandTotalTitle = u'Tổng diện tích phòng một tầng'
    return v


def bang_cau_kien(doc, bic, ten_bang, truong):
    """Bang thong ke gom theo loai; truong = (ten tham so, tieu de cot, tong cong)."""
    v = ViewSchedule.CreateSchedule(doc, ElementId(bic))
    v.Name = ten_bang
    d = v.Definition
    co = dict((f.GetName(doc), f) for f in d.GetSchedulableFields())
    dau = None
    for k, tieu_de, tong in truong:
        if k not in co:
            continue
        q = d.AddField(co[k])
        q.ColumnHeading = tieu_de
        if tong:
            q.DisplayType = ScheduleFieldDisplayType.Totals
        if dau is None:
            q.GridColumnWidth = 75 * MM
        dau = dau or q
    d.AddSortGroupField(ScheduleSortGroupField(dau.FieldId))
    d.IsItemized = False
    d.ShowGrandTotal = True
    d.ShowGrandTotalCount = True
    return v


def ghi_chu(doc, g, to):
    """To ghi chu chung: chi ghi dieu co trong du lieu, vat lieu de chu tri bo sung."""
    dh = [t for t in g['tang'] if t['loai'] == 'dien_hinh']
    de = [t for t in g['tang'] if t['loai'] == 'de']
    tuong = sorted(ten(w)[3:] for w in tat_ca(doc, WallType) if ten(w).startswith('UM '))
    dong = [
        u'GHI CHÚ CHUNG',
        u'',
        u'1. Hồ sơ giai đoạn thiết kế ý tưởng, dựng tự động từ phương án Unitmix, mẫu tòa %s.' % g['mau'],
        u'2. Kích thước và cao độ tính bằng mm. Cốt ±0 là mặt sàn tầng 1.',
        u'3. Quy mô: %d tầng đế, %d tầng điển hình cao %d mm, sàn dày %d mm.' % (len(de), len(dh), g['caoTang'], g['daySan']),
        u'4. Mặt bằng tầng điển hình là đúng bản xuất CAD của phương án.',
        u'5. Mặt bằng tầng 1 vẽ từ model: khung bao, lõi, thang, cột. Công năng tầng đế chưa thiết kế ở giai đoạn này.',
        u'6. Loại tường trong model: %s.' % u', '.join(tuong),
        u'7. Thang bộ, giếng thang và lỗ sàn là cấu kiện Revit. Cabin thang máy là khối minh họa, chọn thiết bị ở bước sau.',
        u'8. Cửa sổ dùng mẫu chung, mặt đứng giản lược so với 3D của phương án.',
        u'9. Vật liệu hoàn thiện, kết cấu, cơ điện: chủ trì bổ sung, chưa có trong dữ liệu phương án.',
    ]
    TextNote.Create(doc, to.Id, XYZ(0.25, 2.3, 0), 3.0, u'\n'.join(dong), kieu_chu(doc, 7.0).Id)


class NapLai(IFamilyLoadOptions):
    def OnFamilyFound(self, dang_dung, ghi_de):
        ghi_de.Value = True
        return True
    def OnSharedFamilyFound(self, f, dang_dung, nguon, ghi_de):
        ghi_de.Value = True
        return True


def khung_ten_unitmix(doc):
    """Bo logo va khoi tu van mau cua template khoi khung ten, ghi UNITMIX."""
    tb = theo_loai(doc, BuiltInCategory.OST_TitleBlocks)[0]
    fd = doc.EditFamily(tb.Family)
    t = Transaction(fd, 'Unitmix khung ten')
    t.Start()
    bo = List[ElementId]()
    for e in FilteredElementCollector(fd).OfClass(ImageInstance):
        bo.Add(e.Id)
    vt = None
    for e in FilteredElementCollector(fd).OfClass(TextNote):
        if 'autodesk' in e.Text.lower() or 'Consultant' in e.Text or 'Address' in e.Text:
            bo.Add(e.Id)
    if bo.Count:
        fd.Delete(bo)
    t.Commit()
    fd.LoadFamily(doc, NapLai())
    fd.Close(False)


def tao_to(doc, so, ten_to, view, vi_tri=None):
    tb = theo_loai(doc, BuiltInCategory.OST_TitleBlocks)[0]
    to = ViewSheet.Create(doc, tb.Id)
    to.SheetNumber = so
    to.Name = ten_to
    for pn, gt in (('Drawn By', 'Unitmix'), ('Checked By', '-'), ('Designed By', 'Unitmix'), ('Approved By', '-')):
        p = to.LookupParameter(pn)
        if p and not p.IsReadOnly:
            p.Set(gt)
    if view is not None:
        Viewport.Create(doc, to.Id, view.Id, vi_tri or XYZ(1.62, 1.33, 0))
    return to


def buoc_ban_ve(doc, g, dxf=None):
    lv = level_theo_ten(doc)
    x0, y0, x1, y1 = khung(g)
    W, D = x1 - x0 + 12000, y1 - y0 + 12000
    Hh = g['tang'][-1]['cao'] + 6000
    s = ti_le(W, D)
    sd = ti_le(max(W, D), Hh)
    theo_id = dict((b['id'], b) for b in g['boCuc'])
    de = [t for t in g['tang'] if t['loai'] == 'de']
    dh = [t for t in g['tang'] if t['loai'] == 'dien_hinh']
    mai = [t for t in g['tang'] if t['loai'] == 'mai']
    kq = {}
    with GD(doc, 'Unitmix mat bang'):
        v1 = tao_mat_bang(doc, g, lv[de[0]['ten'] if de else dh[0]['ten']], u'MB tầng 1', s)
        v2 = tao_mat_bang(doc, g, lv[dh[0]['ten']], u'MB tầng điển hình', s)
        v3 = tao_mat_bang(doc, g, lv[mai[0]['ten']], u'MB mái', s)
    with GD(doc, 'Unitmix chu thich'):
        if dxf and os.path.exists(dxf):
            dat_dxf(doc, g, v2, dxf)
            kq['ban_ve'] = 'dxf'
        else:
            kq['the_phong'] = the_phong(doc, v2, lv[dh[0]['ten']])
            nhan_can(doc, g, v2, theo_id['dh'])
            ky_hieu(doc, v2, theo_id['dh'])
        ky_hieu(doc, v1, theo_id['de'])
    try:
        with GD(doc, 'Unitmix luoi truc'):
            kq['truc'] = luoi_truc(doc, g, v2)
    except Exception as ex:
        kq['truc'] = str(ex)
    with GD(doc, 'Unitmix mat dung'):
        mds = tao_mat_dung(doc, g, v2, sd)
        mc = tao_mat_cat(doc, g, sd)
        bp = bang_phong(doc, g)
    try:
        khung_ten_unitmix(doc)
        kq['khung_ten'] = 'ok'
    except Exception as ex:
        kq['khung_ten'] = str(ex)
    with GD(doc, 'Unitmix so ho so'):
        pi = doc.ProjectInformation
        pi.Number = g['mau']
        pi.ClientName = ' '
        pi.IssueDate = __import__('datetime').date.today().strftime('%d/%m/%Y')
        pi.Status = u'Thiết kế ý tưởng'
        ds = [('KT-01', u'MB TẦNG 1', v1), ('KT-02', u'MB ĐIỂN HÌNH', v2), ('KT-03', u'MB MÁI', v3)]
        for i, v in enumerate(mds):
            ds.append(('KT-%02d' % (4 + i), u'MẶT ĐỨNG %d' % (i + 1), v))
        ds.append(('KT-%02d' % (4 + len(mds)), u'MẶT CẮT A-A', mc))
        for so, t, v in ds:
            tao_to(doc, so, t, v)
        to = tao_to(doc, 'KT-%02d' % (5 + len(mds)), u'BẢNG PHÒNG', None)
        ScheduleSheetInstance.Create(doc, to.Id, bp.Id, XYZ(0.3, 2.4, 0))
        ds2 = ViewSchedule.CreateSheetList(doc)
        ds2.Name = u'Danh mục bản vẽ'
        f = ds2.Definition
        for ten_truong, tieu_de in (('Sheet Number', u'Số tờ'), ('Sheet Name', u'Tên bản vẽ')):
            for q in f.GetSchedulableFields():
                if q.GetName(doc) == ten_truong:
                    f.AddField(q).ColumnHeading = tieu_de
        bia = tao_to(doc, 'KT-00', u'DANH MỤC BẢN VẼ', None)
        ScheduleSheetInstance.Create(doc, bia.Id, ds2.Id, XYZ(0.5, 2.4, 0))
        tk = tao_to(doc, 'KT-%02d' % (6 + len(mds)), u'THỐNG KÊ CẤU KIỆN', None)
        ban = (
            bang_cau_kien(doc, BuiltInCategory.OST_Doors, u'Thống kê cửa đi', (('Family and Type', u'Loại', False), ('Count', u'Số lượng', False))),
            bang_cau_kien(doc, BuiltInCategory.OST_Windows, u'Thống kê cửa sổ', (('Family and Type', u'Loại', False), ('Count', u'Số lượng', False))),
            bang_cau_kien(doc, BuiltInCategory.OST_Walls, u'Thống kê tường', (('Family and Type', u'Loại', False), ('Count', u'Số đoạn', False), ('Length', u'Tổng dài', True))),
        )
        for i, b in enumerate(ban):
            ScheduleSheetInstance.Create(doc, tk.Id, b.Id, XYZ(0.3 + i * 1.05, 2.4, 0))
        ghi_chu(doc, g, tao_to(doc, 'KT-%02d' % (7 + len(mds)), u'GHI CHÚ CHUNG', None))
    kq['to'] = len(ds) + 4
    kq['ti_le'] = (s, sd)
    return kq


def buoc_pdf(doc, ra, ten_tep):
    ids = List[ElementId]()
    for s in sorted(tat_ca(doc, ViewSheet), key=lambda x: x.SheetNumber):
        ids.Add(s.Id)
    o = PDFExportOptions()
    o.Combine = True
    o.FileName = ten_tep
    o.PaperPlacement = PaperPlacementType.Center
    o.ZoomType = ZoomType.Zoom
    o.ZoomPercentage = 100
    o.HideCropBoundaries = True
    o.HideScopeBoxes = True
    o.HideUnreferencedViewTags = True
    doc.Export(ra, ids, o)
    return os.path.join(ra, ten_tep + '.pdf')


def dung_tat_ca(doc, duong, ra):
    g = doc_goi(duong)
    buoc_level(doc, g)
    kq = buoc_model(doc, g)
    kq2 = buoc_ban_ve(doc, g, duong.replace('.bim.json', '.dxf'))
    tep = buoc_pdf(doc, ra, os.path.basename(duong).replace('.bim.json', '_ho-so'))
    return kq, kq2, tep
