# -*- coding: utf-8 -*-
"""Làm NHẸ DXF cho app Unitmix, GIỮ MỌI LỚP như CAD (khác lam_dxf_sach.py chỉ lấy ô đất).

    python scripts/boc_cad/lam_nhe_dxf.py <vao.dxf> <ra.dxf>

Bỏ: WIPEOUT (che nền, app không dùng), thực thể trùng khít, đa tuyến suy biến (< 2 điểm / dài 0), chữ rỗng,
khối không dùng, lớp không còn đối tượng, đối tượng rác trong OBJECTS (proxy, xref, ảnh nền). Lưu R2010.
"""
import sys

import ezdxf


def khoa(e):
    t = e.dxftype()
    try:
        if t == 'LWPOLYLINE':
            return (t, e.dxf.layer, bool(e.closed), tuple((round(p[0], 3), round(p[1], 3)) for p in e.get_points('xy')))
        if t in ('MTEXT', 'TEXT'):
            s = e.plain_text() if t == 'MTEXT' else e.dxf.text
            return (t, e.dxf.layer, round(e.dxf.insert.x, 3), round(e.dxf.insert.y, 3), s)
        if t == 'LINE':
            return (t, e.dxf.layer, tuple(map(lambda v: round(v, 3), (*e.dxf.start.xy, *e.dxf.end.xy))))
    except Exception:
        pass
    return None


def hong(e):
    t = e.dxftype()
    if t == 'LWPOLYLINE':
        return len(e) < 2
    if t == 'MTEXT':
        return not e.plain_text().strip()
    if t == 'TEXT':
        return not e.dxf.text.strip()
    return False


def main():
    vao, ra = sys.argv[1], sys.argv[2]
    d = ezdxf.readfile(vao)
    ms = d.modelspace()
    bo = {}
    thay = set()
    for e in list(ms):
        t = e.dxftype()
        if t == 'WIPEOUT' or hong(e):
            ms.delete_entity(e)
            bo[t] = bo.get(t, 0) + 1
            continue
        k = khoa(e)
        if k is not None:
            if k in thay:
                ms.delete_entity(e)
                bo['trùng ' + t] = bo.get('trùng ' + t, 0) + 1
                continue
            thay.add(k)
    dung = {e.dxf.name for e in ms.query('INSERT')}
    for b in list(d.blocks):
        ten = b.name
        if not ten.startswith('*') and ten not in dung:
            d.blocks.delete_block(ten, safe=False)
            bo['khối ' + ten] = 1
    lop_dung = {e.dxf.layer for e in ms} | {e.dxf.layer for b in d.blocks for e in b} | {'0', 'Defpoints'}
    for l in list(d.layers):
        if l.dxf.name not in lop_dung:
            d.layers.remove(l.dxf.name)
    d.header['$INSUNITS'] = 6
    d.saveas(ra)
    print('đã bỏ:', bo)
    print('còn', len(ms), 'đối tượng,', len(d.layers), 'lớp')


if __name__ == '__main__':
    main()
