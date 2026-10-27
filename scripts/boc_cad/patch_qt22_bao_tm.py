# -*- coding: utf-8 -*-
"""QT-22 · vá 2 đỉnh sai của `bao_tm` (layer MDI-BAO-TM) trong core_geometry.json.

CHẠY NGAY SAU `python scripts/boc_cad_p16.py <raw> [--tinh-lai-gieng]` — bước bóc
CAD ghi đè `bao_tm` từ .dwg mỗi lần chạy nên bản vá này MẤT nếu quên (đã mất 3 lần
trong một phiên 15/9, và lần nữa 19/9). File .dwg của hai lõi chưa được sửa, nên
vá ở đây là biện pháp duy nhất cho tới khi đội CAD sửa khung MDI-BAO-TM tại nguồn.

Hai đỉnh (commit 2e5a3e5, đối chiếu độc lập qua lớp tường A-WALL và `bb_ve_mm`
của khối trong bản vẽ tòa — khung tường mới mới là đúng):
  · x_tmkt_i1 : góc tây dãy B  x = -8700  →  -8900   (lệch đúng 1 bề dày tường 200)
  · x_tmkt_y1 : hai đầu chéo   x = ±9919,6 →  ±9789,7 (vượt ra ngoài chính bao_tuong_mm)

Chạy lại được (idempotent): mỗi phép vá kiểm MỐC `dau` (trạng thái đã vá) TRƯỚC khi
kiểm trạng thái chưa vá, và dừng với thông báo rõ nếu gặp trạng thái thứ ba (dữ liệu
CAD đã đổi — phải đo lại, không được vá mù).

Chạy: python scripts/patch_qt22_bao_tm.py   rồi   python scripts/build_shell.py
"""
import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

P = Path(__file__).resolve().parent.parent / "data" / "master" / "core_geometry.json"
d = json.loads(P.read_text(encoding="utf-8"))

# (lõi, hàm chọn đỉnh cần vá, giá trị x chưa vá, giá trị x đã vá)
VA = [
    ("x_tmkt_i1", lambda x: x == -8700.0, -8700.0, -8900.0),
    ("x_tmkt_y1", lambda x: abs(abs(x) - 9919.6) < 0.05, 9919.6, 9789.7),
]


def va(ma, chon, cu, moi):
    pl = d[ma]["bao_tm"]
    xs = [q[0] for q in pl]
    n_moi = sum(1 for x in xs if abs(abs(x) - abs(moi)) < 0.05 and (x == moi or ma == "x_tmkt_y1"))
    n_cu = sum(1 for x in xs if chon(x))
    # MỐC `dau` trước: đã vá (không còn đỉnh chưa vá, và có đỉnh đã vá)
    if n_cu == 0 and n_moi > 0:
        print("  %-10s đã vá — bỏ qua" % ma)
        return False
    assert n_cu > 0, ("%s: không thấy đỉnh chưa vá (%s) lẫn đã vá (%s) — dữ liệu CAD đổi, "
                      "ĐO LẠI trước khi vá. x hiện có: %s" % (ma, cu, moi, sorted(set(xs))))
    for q in pl:
        if chon(q[0]):
            q[0] = round(moi if ma == "x_tmkt_i1" else (moi if q[0] > 0 else -moi), 1)
    print("  %-10s vá %d đỉnh: %s → %s" % (ma, n_cu, cu, moi))
    return True


doi = False
for a in VA:
    doi = va(*a) or doi
if doi:
    P.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Đã ghi", P.name)
else:
    print("Không có gì để vá.")
