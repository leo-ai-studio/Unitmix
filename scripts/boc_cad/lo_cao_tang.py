# -*- coding: utf-8 -*-
"""Lô đất ở CAO TẦNG (NOTM / NOXH / TĐC) từ layer 2_QHSDD_DAT_DD_Nhom o của DXF phương án SDĐ + chỉ tiêu từ Excel.

    python scripts/boc_cad/lo_cao_tang.py <ban_ve.dxf> <chi_tieu.xlsx> <ra.dxf>

Ra: <ra.dxf> (LB-RANH ô cao tầng · LB-THAPTANG ô thấp tầng bỏ ra · LB-TEM số hiệu theo QH · LB-DUONG/BOVIA/TIMDUONG)
    <ra>.xlsx (mỗi lô một dòng: số hiệu QH, DT bản vẽ, dòng bảng chỉ tiêu ghép, lệch %, chỉ tiêu, cờ cần xác nhận)
Số hiệu lô = nhãn trong CAD. Ô nào nhãn nằm ngoài ô thì lấy nhãn gần nhất (tham lam theo khoảng cách); ghép dòng bảng theo số hiệu, DT chỉ để đối chiếu.
"""
import math
import re
import sys

import ezdxf
import ezdxf.path as P
import openpyxl
from shapely.geometry import Point, Polygon

LOP = '2_QHSDD_DAT_DD_Nhom o'
MA = re.compile(r'(NOTM|NOXH|TĐC)-[\d.]+')
# Ô thấp tầng (LK 2.1/2.2, biệt thự 2.3/2.4): sheet 'Chi tiet Dat O doi TDC' không liệt kê là cao tầng → không lấy
THAP_TANG = {'NOTM-2.1', 'NOTM-2.2', 'NOTM-2.3', 'NOTM-2.4'}
# Ô có hai nhãn CAD trong cùng hatch / nhãn lệch: chốt tay theo DT hatch khớp bảng
GHI_TAY = {'TĐC-7.2': 'nhãn TĐC-7.2 trong CAD nằm đè lên ô NOTM-6.2; DT bảng 12.291 m² khớp ô NOXH-7.2 trong CAD → kiểm lại số hiệu'}


def doc_hatch(m):
    ds = []
    for e in m.query('HATCH'):
        if e.dxf.layer != LOP:
            continue
        sub = [Polygon([(v.x, v.y) for v in pp.flattening(0.2)]).buffer(0) for pp in P.make_path(e).sub_paths()]
        g = sub[0]
        for h in sub[1:]:
            g = g.difference(h)
        ds.append(g)
    return ds


def doc_bang(xlsx):
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    kq = {}
    for i, r in enumerate(wb['Chi tiet Dat O doi TDC'].iter_rows(min_row=4, max_col=26, values_only=True), 4):
        mm = MA.search((r[1] or '').replace(' ', ''))
        if r[1] and str(r[1]).strip().startswith('Ô') and mm and isinstance(r[6], (int, float)) and r[6] > 0:
            kq.setdefault(mm.group(0), dict(dong=i, ten=str(r[1]).strip(), dt=r[6], can_qh=r[2], can_vtk=r[3], dan_qh=r[4], dan_vtk=r[5],
                                            md_de=r[7], md_thap=r[9], dtxd_de=r[11], dtxd_thap=r[14], dts_thap=r[17], tang_thap_qh=r[20],
                                            tang_thap_vtk=r[21], tong_tang_qh=r[22], tong_tang_vtk=r[23], so_toa=r[24]))
    kq84 = {}
    for i, r in enumerate(wb['296HA-PA 84K'].iter_rows(min_row=4, max_col=26, values_only=True), 4):
        for mm in MA.finditer((r[1] or '').replace(' ', '')):
            if isinstance(r[2], (int, float)):
                kq84.setdefault(mm.group(0), (i, r[2]))
    return kq, kq84


def main():
    dxf, xlsx, ra = sys.argv[1:4]
    d = ezdxf.readfile(dxf)
    m = d.modelspace()
    hatch = doc_hatch(m)
    gd = [Point(e.dxf.insert.x, e.dxf.insert.y) for e in m.query('MTEXT') if e.dxf.layer == '!QH-KIHIEU' and e.plain_text().strip().startswith('GD-')]
    hatch = [g for g in hatch if not any(g.contains(p_) for p_ in gd)]  # hatch của lô giáo dục nằm chung layer
    nhan = {}
    for e in m.query('MTEXT'):
        s = e.plain_text().strip()
        if e.dxf.layer == '!QH-KIHIEU' and MA.fullmatch(s):
            nhan[s] = (e.dxf.insert.x, e.dxf.insert.y)
    ten = sorted(nhan)
    # Chi phí = khoảng cách từ nhãn tới ô (0 nếu nằm trong ô)
    C = [[0 if g.contains(Point(*nhan[t])) else g.distance(Point(*nhan[t])) for t in ten] for g in hatch]
    gan, dung = {}, set()
    for cp, i, j in sorted((C[i][j], i, j) for i in range(len(hatch)) for j in range(len(ten))):
        if cp < 400 and i not in dung and ten[j] not in gan:
            gan[ten[j]] = hatch[i]
            dung.add(i)
    bang, b84 = doc_bang(xlsx)

    out = ezdxf.new('R2010')
    out.units = 6
    for t, mau in (('LB-RANH', 3), ('LB-THAPTANG', 30), ('LB-TEM', 7), ('LB-DUONG', 8), ('LB-BOVIA', 9), ('LB-TIMDUONG', 1), ('LB-RANHQH', 6)):
        out.layers.add(t, color=mau)
    ms = out.modelspace()
    # Đường giao thông: lấy TOÀN BỘ, không cắt khung
    DUONG = {'!QH-GT-Duongdo': 'LB-DUONG', '!QH-GT-Bovia': 'LB-BOVIA', '!QH-GT-Timduong': 'LB-TIMDUONG', 'GT-DUONG CT DO THI': 'LB-DUONG',
             'QH_DuongLienKhuVuc': 'LB-DUONG', 'TIM LKV': 'LB-TIMDUONG', 'GT_Tim': 'LB-TIMDUONG', 'Mep Cau': 'LB-DUONG'}
    for e in m:
        t_ = DUONG.get(e.dxf.layer)
        if not t_:
            continue
        k = e.dxftype()
        if k == 'LWPOLYLINE':
            ms.add_lwpolyline([(a[0], a[1]) for a in e.get_points('xy')], close=bool(e.closed), dxfattribs={'layer': t_})
        elif k == 'LINE':
            ms.add_line((e.dxf.start.x, e.dxf.start.y), (e.dxf.end.x, e.dxf.end.y), dxfattribs={'layer': t_})
        elif k == 'ARC':
            ms.add_arc((e.dxf.center.x, e.dxf.center.y), e.dxf.radius, e.dxf.start_angle, e.dxf.end_angle, dxfattribs={'layer': t_})
        elif k == 'POLYLINE':
            ms.add_lwpolyline([(v.dxf.location.x, v.dxf.location.y) for v in e.vertices], close=e.is_closed, dxfattribs={'layer': t_})
    # Ranh giới quy hoạch (RGDVO có 4 bản trùng → lấy 1)
    rg = [e for e in m.query('LWPOLYLINE[layer=="RGDVO"]')]
    if rg:
        ms.add_lwpolyline([(a[0], a[1]) for a in rg[0].get_points('xy')], close=True, dxfattribs={'layer': 'LB-RANHQH'})
    # Các lô khác (không phải layer Nhom o): giáo dục, công cộng, hỗn hợp, cây xanh, di tích, quốc phòng… mỗi layer CAD một layer LB-LO-*
    LOKHAC = {'qh-truong THCS TH mam non': 'GD', 'qh-dat cong cong dvo': 'CC', 'qh-dat cong tinh dau moi HTKT': 'HTKT',
              'qh-dat cay xanh do thi': 'CX', '2_QHDD_DAT_DD_CayxanhCCdothi': 'CX', '2_QHDD_DAT_DD_Honhop': 'TMDV',
              'DAT_CTSX_Congnghiep': 'CN', '1_HT_DAT_NDD_Ditich': 'DT', '1_HT_DAT_NDD_Quocphong': 'QP'}
    nhan_khac = {k: v for k, v in ((e.plain_text().strip(), (e.dxf.insert.x, e.dxf.insert.y)) for e in m.query('MTEXT') if e.dxf.layer == '!QH-KIHIEU')
                 if re.fullmatch(r'(TMDV|GD|CC|CX)-[\d.]+', k)}
    n_khac, dem = 0, {}
    for e in m.query('HATCH'):
        ma = LOKHAC.get(e.dxf.layer)
        if not ma:
            continue
        sub = [Polygon([(v.x, v.y) for v in pp.flattening(0.2)]).buffer(0) for pp in P.make_path(e).sub_paths()]
        if not sub:
            continue
        g = sub[0]
        ms.add_lwpolyline(list(g.exterior.coords)[:-1], close=True, dxfattribs={'layer': 'LB-RANH'})
        n_khac += 1
        tens = [k for k, (x, y) in nhan_khac.items() if g.contains(Point(x, y))]
        if not tens:
            dem[ma] = dem.get(ma, 0) + 1
            tens = ['%s-%d' % (ma, dem[ma])]
        rp = g.representative_point()
        ms.add_text(' / '.join(tens), height=12, dxfattribs={'layer': 'LB-TEM', 'insert': (rp.x, rp.y)})
    print(n_khac, 'lô khác')

    cot = ['so_hieu_QH', 'loai', 'dt_ban_ve_m2', 'dong_bang', 'ten_dong_bang', 'dt_chot_m2_theo_excel', 'lech_pct_cad_so_excel', 'dt_84K_m2', 'so_can_QH', 'so_can_VTK', 'dan_so_QH', 'dan_so_VTK',
           'mat_do_de_pct', 'mat_do_thap_pct', 'tang_thap_QH', 'tang_thap_VTK', 'tong_tang_VTK', 'so_toa', 'ghi_chu']
    dong = []
    for t in sorted(gan, key=lambda k: (k.split('-')[0], [float(x) for x in k.split('-')[1].split('.')])):
        g = gan[t]
        thap = t in THAP_TANG
        pts = list(g.exterior.coords)[:-1]
        ms.add_lwpolyline(pts, close=True, dxfattribs={'layer': 'LB-RANH'})
        ms.add_text(t, height=12, dxfattribs={'layer': 'LB-TEM', 'insert': (g.representative_point().x, g.representative_point().y)})
        b = bang.get(t)
        lech = round(100 * (g.area - b['dt']) / b['dt'], 1) if b else ''
        gc = []
        if thap:
            gc.append('THẤP TẦNG 4 TẦNG — không lấy vào cao tầng')
        if not b:
            gc.append('KHÔNG có dòng trong sheet Chi tiet Dat O doi TDC')
        elif abs(lech) > 1:
            gc.append('DT bảng lệch %.1f %% so với bản vẽ' % lech)
        kc = g.distance(Point(*nhan[t]))
        if kc > 1:
            gc.append('nhãn CAD nằm ngoài ô %d m (ghép theo nhãn gần nhất)' % kc)
        if t in GHI_TAY:
            gc.append(GHI_TAY[t])
        dong.append([t, 'thấp tầng' if thap else 'cao tầng', round(g.area, 1), b['dong'] if b else '', b['ten'] if b else '', b['dt'] if b else '', lech,
                     b84[t][1] if t in b84 else '', *(b[k] if b else '' for k in ('can_qh', 'can_vtk', 'dan_qh', 'dan_vtk', 'md_de', 'md_thap', 'tang_thap_qh', 'tang_thap_vtk', 'tong_tang_vtk', 'so_toa')),
                     '; '.join(gc)])
    chua = [t for t in ten if t not in gan and t not in THAP_TANG]
    for t in chua:
        dong.append([t, '', '', bang[t]['dong'] if t in bang else '', '', '', '', '', *[''] * 10, 'KHÔNG có ô nào trong layer Nhom o gần nhãn này (nhãn CAD ở %d,%d)' % nhan[t]])
    out.saveas(ra)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Chi tieu QH'
    num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0  # 0 / âm trong Excel là ô công thức lỗi hoặc trống
    ws.append(['Ký hiệu ô đất', 'Diện tích đất (m²)', 'MĐXD khối đế (%)', 'MĐXD khối tháp (%)', 'Tầng hầm', 'Tầng đế', 'Tầng tháp', 'Tầng cao tổng',
               'Hệ số SDĐ (lần)', 'Dân số (người)', 'Số căn', 'DTXD khối đế QH (m²)', 'DTXD khối tháp QH (m²)', 'Tổng DTXD QH (m²)',
               'Tổng sàn khối tháp QH (m²)', 'Tổng sàn QH (m²)', 'Số tòa (TB 2000)', 'Số căn xếp tháp VTK', 'Dân số xếp tháp VTK',
               'Tầng tháp xếp tháp VTK', 'DT trên bản vẽ CAD (m²)', 'Lệch CAD so Excel (%)', 'Dòng Excel', 'Ghi chú'])
    for t in sorted(gan, key=lambda k: (k.split('-')[0], [float(x) for x in k.split('-')[1].split('.')])):
        b = bang.get(t)
        if t in THAP_TANG or not b:
            continue
        ghi = []
        dt = b['dt']
        md_de, md_thap = b['md_de'], b['md_thap']
        dtxd_de = b['dtxd_de'] if num(b['dtxd_de']) else (dt * md_de / 100 if num(md_de) else None)
        dtxd_thap = b['dtxd_thap'] if num(b['dtxd_thap']) else (dt * md_thap / 100 if num(md_thap) else None)
        if num(b['tang_thap_qh']):
            tang_thap = b['tang_thap_qh']
        else:
            tang_thap = b['tang_thap_vtk'] if num(b['tang_thap_vtk']) else None
            if tang_thap is not None:
                ghi.append('tầng tháp QH trống → lấy theo xếp tháp VTK')
        tang_de = 1
        tang_cao = b['tong_tang_qh'] if num(b['tong_tang_qh']) and b['tong_tang_qh'] <= 80 else (tang_thap + tang_de if tang_thap is not None else None)
        dts_thap = b['dts_thap'] if num(b['dts_thap']) else (dtxd_thap * tang_thap if dtxd_thap is not None and tang_thap is not None else None)
        san = dtxd_de * tang_de + dts_thap if dtxd_de is not None and dts_thap is not None else None
        if san is None:
            ghi.append('thiếu MĐXD / sàn khối tháp QH → chưa tính tổng sàn và HSSDĐ')
        hssd = round(san / dt, 2) if san else None
        can = b['can_qh'] if num(b['can_qh']) and b['can_qh'] > 0 else (b['can_vtk'] if num(b['can_vtk']) else None)
        dan = b['dan_qh'] if num(b['dan_qh']) and b['dan_qh'] > 0 else (b['dan_vtk'] if num(b['dan_vtk']) else None)
        if can is not None and can == b['can_vtk'] and not (num(b['can_qh']) and b['can_qh'] > 0):
            ghi.append('số căn QH trống/0 → lấy theo xếp tháp VTK')
        if dan is not None and dan == b['dan_vtk'] and not (num(b['dan_qh']) and b['dan_qh'] > 0):
            ghi.append('dân số QH trống/0 → lấy theo xếp tháp VTK')
        if not num(md_de):
            ghi.append('MĐXD khối đế QH trống')
        if not num(md_thap):
            ghi.append('MĐXD khối tháp QH trống')
        ghi.append('tầng đế = 1, tầng cao tổng = tháp + 1 (quy ước Excel); HSSDĐ = (DTXD đế × tầng đế + sàn tháp) / DT đất; tổng DTXD = DTXD khối đế')
        g = gan[t]
        ws.append([t, dt, md_de, md_thap, None, tang_de if tang_thap is not None else None, tang_thap, tang_cao, hssd, dan, can,
                   round(dtxd_de, 1) if dtxd_de is not None else None, round(dtxd_thap, 1) if dtxd_thap is not None else None,
                   round(dtxd_de, 1) if dtxd_de is not None else None, round(dts_thap, 1) if dts_thap is not None else None,
                   round(san, 1) if san else None, b['so_toa'], b['can_vtk'], b['dan_vtk'], b['tang_thap_vtk'],
                   round(g.area, 1), round(100 * (g.area - dt) / dt, 1), b['dong'], '; '.join(ghi)])
    for col, w in zip('ABCDEFGHIJKLMNOPQRSTUVWX', [14, 14, 12, 12, 8, 8, 9, 10, 12, 12, 9, 16, 16, 16, 18, 16, 10, 12, 12, 12, 16, 14, 9, 70]):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = 'B2'
    ws2 = wb.create_sheet('Doi chieu CAD')
    ws2.append(cot)
    for r_ in dong:
        ws2.append(r_)
    wb.save(ra[:-4] + '.xlsx')
    print(len(gan), 'ô gắn nhãn;', sum(1 for x in dong if x[1] == 'cao tầng'), 'cao tầng;', 'nhãn chưa có ô:', chua)
    for x in dong:
        print(x[0], x[1], x[2], x[5], x[6], '|', x[-1])


if __name__ == '__main__':
    main()
