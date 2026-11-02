# -*- coding: utf-8 -*-
"""Cập nhật cột "xếp tháp VTK" của LB_o_cao_tang_*.xlsx (sheet Chi tieu QH + Doi chieu CAD) theo sheet 'VTK_Tháp  (17)'.

    python scripts/boc_cad/cap_nhat_vtk17.py <bang_tinh_can_VTK.xlsx> <LB_o_cao_tang_vN.xlsx> <ra.xlsx>

Chỉ đọc nguồn, ghi ra tệp mới. Khớp theo tên ô (bỏ "Ô", khoảng trắng). Cập nhật: số tòa, số căn VTK, dân số VTK, tầng tháp VTK (+ tổng tầng
trong Doi chieu CAD). Cột QH giữ nguyên; ô QH trống đang lấy dự phòng theo VTK (ghi chú nói rõ) thì đi theo VTK mới và tính lại tổng sàn / HSSDĐ
khi tầng đổi. Ghi chú mỗi dòng thêm "VTK cập nhật theo sheet ... dòng N".
"""
import re
import sys

import openpyxl

SHEET = 'VTK_Tháp  (17)'
NHAN = 'VTK cập nhật theo sheet "VTK_Tháp (17)" dòng %d'


def main():
    nguon, dich, ra = sys.argv[1:4]
    src = openpyxl.load_workbook(nguon, data_only=True)[SHEET]
    vtk = {}
    for r in range(31, 57):
        ten = str(src.cell(r, 3).value or '').replace(' ', '').replace('Ô', '')
        if re.match(r'(NOTM|NOXH|TĐC)-', ten):
            vtk[ten] = dict(dong=r, tang_thap=src.cell(r, 4).value, toa=src.cell(r, 15).value, can=src.cell(r, 17).value,
                            dan=src.cell(r, 20).value, tong_tang=src.cell(r, 33).value)
    wb = openpyxl.load_workbook(dich)
    ws, wc = wb['Chi tieu QH'], wb['Doi chieu CAD']
    num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0
    for r in range(2, ws.max_row + 1):
        t = ws.cell(r, 1).value
        v = vtk.get(t)
        if not v:
            print('KHÔNG có trong sheet 17:', t)
            continue
        ghi = ws.cell(r, 24).value or ''
        ws.cell(r, 17).value, ws.cell(r, 18).value, ws.cell(r, 19).value, ws.cell(r, 20).value = v['toa'], v['can'], v['dan'], v['tang_thap']
        if 'dân số QH trống/0 → lấy theo xếp tháp VTK' in ghi:
            ws.cell(r, 10).value = v['dan']
        if 'số căn QH trống/0 → lấy theo xếp tháp VTK' in ghi:
            ws.cell(r, 11).value = v['can']
        if 'tầng tháp QH trống → lấy theo xếp tháp VTK' in ghi:
            tang_cu, tang = ws.cell(r, 7).value, v['tang_thap']
            ws.cell(r, 7).value, ws.cell(r, 8).value = tang, tang + 1
            dt, de, thap = ws.cell(r, 2).value, ws.cell(r, 12).value, ws.cell(r, 13).value
            if num(de) and num(thap) and tang != tang_cu:
                sang = round(thap * tang, 1)
                tong = round(de + sang, 1)
                ws.cell(r, 15).value, ws.cell(r, 16).value, ws.cell(r, 9).value = sang, tong, round(tong / dt, 2)
        ws.cell(r, 24).value = (ghi + '; ' if ghi else '') + NHAN % v['dong']
    for r in range(2, wc.max_row + 1):
        v = vtk.get(wc.cell(r, 1).value)
        if v and wc.cell(r, 2).value == 'cao tầng':
            wc.cell(r, 10).value, wc.cell(r, 12).value, wc.cell(r, 16).value, wc.cell(r, 17).value, wc.cell(r, 18).value = (
                v['can'], v['dan'], v['tang_thap'], v['tong_tang'], v['toa'])
    wb.save(ra)
    print('Đã ghi', ra)


if __name__ == '__main__':
    main()
