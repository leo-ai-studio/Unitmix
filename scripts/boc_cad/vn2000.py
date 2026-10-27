"""Đổi toạ độ VN2000 (phẳng, múi 3°) ↔ WGS84 (kinh/vĩ độ — Google Earth). Python thuần, không cần pyproj.

VN2000 phẳng = phép chiếu UTM ngang (Transverse Mercator) trên ellipsoid WGS84, múi 3°, k₀ = 0,9999, E₀ = 500 000 m, N₀ = 0,
kinh tuyến trục THEO TỈNH (Thông tư 973/2001/TT-TCĐC) — truyền vào `kt` (độ thập phân, vd Hải Phòng 105°45' = 105.75).
Đổi datum VN2000 → WGS84: Helmert 7 tham số = EPSG:6960 "VN-2000 to WGS 84 (2)", phương pháp COORDINATE FRAME (EPSG:9607),
độ chính xác EPSG ghi 1 m (lưu ý: epsg.io in cùng các số này vào +towgs84 của PROJ — vốn hiểu là position vector; hai quy ước
chỉ khác dấu 3 góc quay, lệch < 1 m trên lãnh thổ VN). Toạ độ pháp lý luôn giữ VN2000 gốc; WGS84 chỉ để xem trên Google Earth:
    ΔX −191,90441429 m · ΔY −39,30318279 m · ΔZ −111,45032835 m · ωX −0,00928836″ · ωY +0,01975479″ · ωZ −0,00427372″ · k +0,252906278 ppm
TM dùng chuỗi Krüger bậc 6 (sai số < 1 mm trong múi) — cùng thuật toán với bản JS trong app (`vn2000ToWgs`).
"""
import math

A = 6378137.0
F = 1 / 298.257223563
K0 = 0.9999
E0 = 500000.0
HELMERT = (-191.90441429, -39.30318279, -111.45032835, -0.00928836, 0.01975479, -0.00427372, 0.252906278)

# Kinh tuyến trục VN2000 một số tỉnh (Thông tư 973/2001/TT-TCĐC) — tỉnh khác nhập tay.
KT_TINH = {"ha_noi": 105.0, "hai_phong": 105.75, "tp_hcm": 105.75, "da_nang": 107.75, "quang_ninh": 107.75,
           "kien_giang": 104.5, "khanh_hoa": 108.25, "binh_duong": 105.75, "dong_nai": 107.75}

_n = F / (2 - F)
_AA = A / (1 + _n) * (1 + _n ** 2 / 4 + _n ** 4 / 64 + _n ** 6 / 256)
_al = [None,
       _n / 2 - 2 * _n ** 2 / 3 + 5 * _n ** 3 / 16 + 41 * _n ** 4 / 180 - 127 * _n ** 5 / 288 + 7891 * _n ** 6 / 37800,
       13 * _n ** 2 / 48 - 3 * _n ** 3 / 5 + 557 * _n ** 4 / 1440 + 281 * _n ** 5 / 630 - 1983433 * _n ** 6 / 1935360,
       61 * _n ** 3 / 240 - 103 * _n ** 4 / 140 + 15061 * _n ** 5 / 26880 + 167603 * _n ** 6 / 181440,
       49561 * _n ** 4 / 161280 - 179 * _n ** 5 / 168 + 6601661 * _n ** 6 / 7257600,
       34729 * _n ** 5 / 80640 - 3418889 * _n ** 6 / 1995840,
       212378941 * _n ** 6 / 319334400]
_be = [None,
       _n / 2 - 2 * _n ** 2 / 3 + 37 * _n ** 3 / 96 - _n ** 4 / 360 - 81 * _n ** 5 / 512 + 96199 * _n ** 6 / 604800,
       _n ** 2 / 48 + _n ** 3 / 15 - 437 * _n ** 4 / 1440 + 46 * _n ** 5 / 105 - 1118711 * _n ** 6 / 3870720,
       17 * _n ** 3 / 480 - 37 * _n ** 4 / 840 - 209 * _n ** 5 / 4480 + 5569 * _n ** 6 / 90720,
       4397 * _n ** 4 / 161280 - 11 * _n ** 5 / 504 - 830251 * _n ** 6 / 7257600,
       4583 * _n ** 5 / 161280 - 108847 * _n ** 6 / 3991680,
       20648693 * _n ** 6 / 638668800]
_E2 = F * (2 - F)
_e = math.sqrt(_E2)


def tm_xuoi(lat, lon, kt):
    """(độ, độ) → (E, N) mét, cùng datum."""
    phi, lam = math.radians(lat), math.radians(lon - kt)
    t = math.sinh(math.atanh(math.sin(phi)) - _e * math.atanh(_e * math.sin(phi)))
    xi_ = math.atan2(t, math.cos(lam))
    eta_ = math.atanh(math.sin(lam) / math.sqrt(1 + t * t))
    xi = xi_ + sum(_al[j] * math.sin(2 * j * xi_) * math.cosh(2 * j * eta_) for j in range(1, 7))
    eta = eta_ + sum(_al[j] * math.cos(2 * j * xi_) * math.sinh(2 * j * eta_) for j in range(1, 7))
    return E0 + K0 * _AA * eta, K0 * _AA * xi


def tm_nguoc(E, N, kt):
    """(E, N) mét → (độ, độ), cùng datum."""
    xi = N / (K0 * _AA)
    eta = (E - E0) / (K0 * _AA)
    xi_ = xi - sum(_be[j] * math.sin(2 * j * xi) * math.cosh(2 * j * eta) for j in range(1, 7))
    eta_ = eta - sum(_be[j] * math.cos(2 * j * xi) * math.sinh(2 * j * eta) for j in range(1, 7))
    tau_ = math.sin(xi_) / math.sqrt(math.sinh(eta_) ** 2 + math.cos(xi_) ** 2)
    tau = tau_
    for _ in range(8):                                    # lặp Newton tìm tan(φ)
        sg = math.sinh(_e * math.atanh(_e * tau / math.sqrt(1 + tau * tau)))
        tp = tau * math.sqrt(1 + sg * sg) - sg * math.sqrt(1 + tau * tau)
        d = (tau_ - tp) / math.sqrt(1 + tp * tp) * (1 + (1 - _E2) * tau * tau) / ((1 - _E2) * math.sqrt(1 + tau * tau))
        tau += d
        if abs(d) < 1e-14:
            break
    return math.degrees(math.atan(tau)), kt + math.degrees(math.atan2(math.sinh(eta_), math.cos(xi_)))


def _ecef(lat, lon, h=0.0):
    p, l = math.radians(lat), math.radians(lon)
    Nn = A / math.sqrt(1 - _E2 * math.sin(p) ** 2)
    return ((Nn + h) * math.cos(p) * math.cos(l), (Nn + h) * math.cos(p) * math.sin(l), (Nn * (1 - _E2) + h) * math.sin(p))


def _geo(X, Y, Z):
    lon = math.atan2(Y, X)
    p = math.hypot(X, Y)
    lat = math.atan2(Z, p * (1 - _E2))
    for _ in range(10):
        Nn = A / math.sqrt(1 - _E2 * math.sin(lat) ** 2)
        h = p / math.cos(lat) - Nn
        lat = math.atan2(Z, p * (1 - _E2 * Nn / (Nn + h)))
    return math.degrees(lat), math.degrees(lon)


def _helmert(X, Y, Z, dau=1):
    tx, ty, tz, rx, ry, rz, s = HELMERT
    r = math.radians(1 / 3600)
    rx, ry, rz = dau * rx * r, dau * ry * r, dau * rz * r
    m = 1 + dau * s * 1e-6
    tx, ty, tz = dau * tx, dau * ty, dau * tz
    # coordinate frame (EPSG:9607): [X'] = T + m·R·[X], R = [[1,rz,-ry],[-rz,1,rx],[ry,-rx,1]]
    return (tx + m * (X + rz * Y - ry * Z), ty + m * (-rz * X + Y + rx * Z), tz + m * (ry * X - rx * Y + Z))


def vn2000_sang_wgs84(E, N, kt):
    """VN2000 phẳng (E = X đông, N = Y bắc của bản vẽ CAD) → (vĩ độ, kinh độ) WGS84."""
    lat, lon = tm_nguoc(E, N, kt)
    return _geo(*_helmert(*_ecef(lat, lon)))


def wgs84_sang_vn2000(lat, lon, kt):
    """WGS84 → VN2000 phẳng (E, N). Helmert nghịch xấp xỉ bậc nhất (đủ cho tham số nhỏ — sai < 1 mm)."""
    X, Y, Z = _ecef(lat, lon)
    la, lo = _geo(*_helmert(X, Y, Z, dau=-1))
    return tm_xuoi(la, lo, kt)


if __name__ == "__main__":
    # tự kiểm: xuôi ↔ ngược TM và VN2000 ↔ WGS84 khép kín
    for E, N in ((600000.0, 2300000.0), (512345.678, 2323456.789)):
        la, lo = tm_nguoc(E, N, 105.75)
        E2, N2 = tm_xuoi(la, lo, 105.75)
        wl = vn2000_sang_wgs84(E, N, 105.75)
        E3, N3 = wgs84_sang_vn2000(*wl, 105.75)
        print(f"E,N {E},{N} → TM {la:.8f},{lo:.8f} (khép {abs(E2-E)*1000:.4f}/{abs(N2-N)*1000:.4f} mm) "
              f"→ WGS84 {wl[0]:.8f},{wl[1]:.8f} (khép {abs(E3-E)*1000:.2f}/{abs(N3-N)*1000:.2f} mm)")
