"""Sinh dữ liệu phái sinh của mẫu căn trong web/public/lib (chạy lại sau mỗi lần chép / bóc lại căn):

1. `cua_x` trong can.json: tim cửa chính căn, chuẩn hoá 0..1 theo mặt tiền — đúng thuật toán `tinhCuaCan`
   (web/src/tinh/pccc.ts). App đọc thẳng từ can.json, không phải tải 34 tệp can/*.json chỉ để tính một số
   (de_xuat_hieu_nang.md P3). Test web/src/tinh/cuaCanTienTinh.test.ts đối chiếu với tinhCuaCan.
2. Tách nội thất / thiết bị (nét `furn`, `equip`, `hidd` ≈ 81% dung lượng) khỏi can/<id>.json sang
   can/<id>.noithat.json; tệp chính ghi `"tach_noi_that": true`. App chỉ tải phần nội thất khi bật lớp Nội thất
   (màn Tầng) hoặc khi xuất CAD; ghép lại theo thứ tự [nét chính..., nét nội thất...]. Lúc tách, `stretch.cung`
   (chỉ số nét) trong can.json được đánh số lại theo thứ tự ghép đó. Tệp chính bị bóc lại (không còn cờ) thì lần chạy
   sau tách lại — khi đó `stretch.cung` trong can.json phải là bản theo thứ tự tệp gốc (chép lại cùng lúc với tệp căn).

    python scripts/sinh_phai_sinh_can.py [--kiem]   # --kiem: chỉ báo tệp lệch, không ghi (mã thoát 1 nếu lệch)
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from chep_thu_vien import LIB, ghi_can  # noqa: E402

NET_NOI_THAT = {"furn", "equip", "hidd"}  # = NET_NOI_THAT trong web/src/ve/kieuMb.ts


def tinh_cua_can(ve: list, rong_mm: float) -> float:
    """Bản Python của tinhCuaCan (pccc.ts): nét `door` có y·8500 < 350 (chạm tường hành lang), gom theo khe > 1.500 mm,
    lấy nhóm nhiều nét nhất, tim = giữa hai mép. Không có cửa thì 0,5."""
    gan = []
    for p in ve:
        if p.get("cat") != "door" or not p.get("pts"):
            continue
        y0 = min(q[1] for q in p["pts"])
        x0 = min(q[0] for q in p["pts"])
        x1 = max(q[0] for q in p["pts"])
        if y0 * 8500 < 350:
            gan.append((x0, x1))
    if not gan:
        return 0.5
    gan.sort(key=lambda z: z[0])  # sort ổn định như Array.prototype.sort
    nhom = [[gan[0]]]
    for z in gan[1:]:
        cuoi = nhom[-1]
        hi = max(w[1] for w in cuoi)
        if (z[0] - hi) * rong_mm > 1500:
            nhom.append([z])
        else:
            cuoi.append(z)
    nhom.sort(key=len, reverse=True)  # ổn định: bằng nhau giữ thứ tự (JS sort b.length - a.length)
    g = nhom[0]
    return (min(w[0] for w in g) + max(w[1] for w in g)) / 2


def _doc(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def _gon(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def chay(kiem: bool) -> int:
    ds = _doc(LIB / "can.json")
    lech = []
    for c in ds:
        f = LIB / "can" / f"{c['id']}.json"
        fn = LIB / "can" / f"{c['id']}.noithat.json"
        j = _doc(f)
        ve = list(j["ve"])
        if j.get("tach_noi_that"):
            ve += _doc(fn)["ve"] if fn.exists() else []
        cua = tinh_cua_can(ve, c["rong_mm"])
        if c.get("cua_x") != cua:
            lech.append(f"can.json {c['id']}: cua_x {c.get('cua_x')} -> {cua}")
            c["cua_x"] = cua
        if not j.get("tach_noi_that"):
            chinh = {k: v for k, v in j.items() if k != "ve"}
            i_chinh = [i for i, n in enumerate(ve) if n.get("cat") not in NET_NOI_THAT]
            i_nt = [i for i, n in enumerate(ve) if n.get("cat") in NET_NOI_THAT]
            moi = {"ve": [ve[i] for i in i_chinh], **chinh, "tach_noi_that": True}
            nt = {"ve": [ve[i] for i in i_nt]}
            # `stretch.cung` đánh số nét theo thứ tự tệp: đổi sang thứ tự mới [nét chính..., nét nội thất...] (= cách app ghép).
            if c.get("stretch") and c["stretch"].get("cung"):
                so_moi = {cu: moi_i for moi_i, cu in enumerate(i_chinh + i_nt)}
                c["stretch"]["cung"] = [[so_moi[i], d] for i, d in c["stretch"]["cung"]]
                lech.append(f"can.json {c['id']}: đánh số lại stretch.cung")
            lech.append(f"{f.name}: tách {len(nt['ve'])} nét nội thất")
            if not kiem:
                f.write_text(_gon(moi), encoding="utf-8", newline="\n")
                fn.write_text(_gon(nt), encoding="utf-8", newline="\n")
    if not kiem and any(x.startswith("can.json") for x in lech):
        ghi_can(ds, LIB / "can.json")
    print("\n".join(lech) if lech else "Dữ liệu phái sinh căn đã khớp.")
    return 1 if (kiem and lech) else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--kiem", action="store_true")
    sys.exit(chay(ap.parse_args().kiem))
