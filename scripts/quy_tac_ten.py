"""Quy tắc đặt mã và tên hiển thị cho thư viện mẫu tòa, mẫu căn, lõi."""
import re

HINH = {
    "i": ("Thanh đơn", "Bar"),
    "l": ("Chữ L", "L-shape"),
    "t": ("Chữ T", "T-shape"),
    "u": ("Chữ U", "U-shape"),
    "v": ("Chữ V", "V-shape"),
    "y": ("Chữ Y", "Y-shape"),
    "z": ("Chữ Z", "Z-shape"),
}
LOAI = {
    "stu": ("Studio", "Studio"),
    "1pn": ("1PN", "1BR"),
    "2pn": ("2PN", "2BR"),
    "2pnp": ("2PN+", "2BR+"),
    "3pn": ("3PN", "3BR"),
}
VI_TRI = {"giua": ("giữa", "mid"), "goc": ("góc", "corner")}


def id_toa(ma_goc: str) -> str:
    """hn_tm_u2 -> tm-u2"""
    m = re.fullmatch(r"hn_(tm|xh)_([iltuvyz])(\d+)", ma_goc)
    if not m:
        raise ValueError(f"mã tòa không đúng dạng: {ma_goc}")
    return f"{m[1]}-{m[2]}{m[3]}"


def ten_toa(hinh: str, so: int, lang: str) -> str:
    ma = (hinh if hinh == "i" else hinh.upper()) + str(so)
    ten = HINH[hinh][0 if lang == "vi" else 1]
    if so >= 2:
        ten += ", biến thể " + str(so) if lang == "vi" else ", variant " + str(so)
    return f"{ma} · {ten}"


def id_can(ma_goc: str) -> str:
    """chtm_hn_2pn_m1_8500x7500 -> tm-2pn-m1"""
    m = re.fullmatch(r"ch(tm|xh)_hn_(stu|1pn|2pn|2pnp|3pn)_([a-z]\d)_\d+x\d+", ma_goc)
    if not m:
        raise ValueError(f"mã căn không đúng dạng: {ma_goc}")
    return f"{m[1]}-{m[2]}-{m[3]}"


def rong_tu_ma(ma_goc: str) -> int:
    """Bề ngang mặt tiền (mm) = số sau dấu x trong mã gốc."""
    return int(ma_goc.rsplit("x", 1)[1])


def ten_can(loai: str, vi_tri: str, vi_tri_ma: str, rong_mm: int, lang: str) -> str:
    i = 0 if lang == "vi" else 1
    m = f"{rong_mm / 1000:.1f}"
    if lang == "vi":
        m = m.replace(".", ",")
    return f"{LOAI[loai][i]} {vi_tri_ma.upper()} · {VI_TRI[vi_tri][i]} · {m} m"


def id_loi(ma_goc: str) -> str:
    """x_tmdv_i1_tm_09 -> loi-tmdv-i1-tm-09"""
    if not ma_goc.startswith("x_"):
        raise ValueError(f"mã lõi không đúng dạng: {ma_goc}")
    return "loi-" + ma_goc[2:].replace("_", "-")
