/**
 * GIÓ — hoa gió từ chuỗi gió giờ (Open-Meteo, 10 m) và phân loại tiện nghi gió mức đi bộ theo tiêu chí kiểu Lawson (LDDC).
 * Hàm thuần.
 *
 * Tiêu chí tiện nghi (Lawson LDDC, ngưỡng tốc độ trung bình / GEM vượt quá ≤ 5 % thời gian) — nguồn: BRE review of wind assessment
 * (https://images.reading.gov.uk/2022/03/CD7.35-BRE-Review-of-Wind-Assessment-dated-and-rec-31-1-22.pdf), SimScale
 * (https://www.simscale.com/blog/lawson-wind-comfort-criteria/): ngồi lâu 4 m/s · đứng 6 m/s · dạo bộ 8 m/s · đi nhanh 10 m/s ·
 * vượt 10 m/s > 5 % = không tiện nghi. Ngưỡng an toàn 15 m/s vượt > 0,022 % (~ 2 h/năm) là GIÁ TRỊ TẠM theo các phiên bản Lawson phổ biến,
 * chưa đối chiếu văn bản gốc — chờ chủ nhiệm chốt. VN chưa có quy chuẩn tiện nghi gió mức đi bộ (kho QCVN không có).
 */

export const SO_HUONG = 16;
/** Mốc tốc độ (m/s) của các dải hoa gió. */
export const MOC_HOA_GIO = [0.5, 2, 4, 6, 8, 10];
/** Bước dải tốc độ (m/s) của phân bố tích luỹ dùng tính vượt ngưỡng. */
export const BUOC_V = 0.5, SO_DAI_V = 60;

export type PhanBoGio = {
  /** Tần suất (0–1) theo [hướng 16][dải tốc độ BUOC_V] — hướng gió THỔI TỪ (khí tượng), 0 = Bắc, theo chiều kim đồng hồ. */
  f: number[][];
  /** Tỷ lệ lặng (< 0,5 m/s). */
  lang: number;
  vTb: number;
  soGio: number;
  /** Nguồn + khoảng thời gian (ghi ở chú giải). */
  nguon?: string;
};

/** Chỉ số hướng 16 phương của góc (°) từ Bắc. */
export const huong16 = (goc: number) => ((Math.round((((goc % 360) + 360) % 360) / 22.5) % SO_HUONG) + SO_HUONG) % SO_HUONG;

/** Gom chuỗi (tốc độ m/s, hướng °) thành phân bố hướng × dải tốc độ. Bỏ mẫu NaN. */
export function phanBo(v: ArrayLike<number | null>, huong: ArrayLike<number | null>): PhanBoGio {
  const f = Array.from({ length: SO_HUONG }, () => new Array(SO_DAI_V).fill(0));
  let n = 0, lang = 0, tong = 0;
  for (let i = 0; i < v.length; i++) {
    const s = v[i], h = huong[i];
    if (s == null || h == null || !Number.isFinite(s) || !Number.isFinite(h)) continue;
    n++; tong += s;
    if (s < 0.5) { lang++; continue; }
    f[huong16(h)][Math.min(SO_DAI_V - 1, Math.floor(s / BUOC_V))]++;
  }
  return { f: f.map((r) => r.map((c) => (n ? c / n : 0))), lang: n ? lang / n : 0, vTb: n ? tong / n : 0, soGio: n };
}

/** Hoa gió: tần suất theo [hướng][dải MOC_HOA_GIO] (dải cuối = ≥ mốc cuối), tổng theo hướng. */
export function hoaGio(p: PhanBoGio): { dai: number[][]; tongHuong: number[] } {
  const dai = p.f.map((r) => {
    const d = new Array(MOC_HOA_GIO.length).fill(0);
    r.forEach((c, k) => {
      const v = (k + 0.5) * BUOC_V;
      let j = MOC_HOA_GIO.length - 1;
      while (j > 0 && v < MOC_HOA_GIO[j]) j--;
      d[j] += c;
    });
    return d;
  });
  return { dai, tongHuong: dai.map((d) => d.reduce((a, b) => a + b, 0)) };
}

/** Hướng chủ đạo: các hướng sắp theo "năng lượng" tần suất × v² (gió mạnh quyết định tiện nghi), kèm tần suất. */
export function huongChuDao(p: PhanBoGio): { i: number; tanSuat: number; trongSo: number }[] {
  return p.f.map((r, i) => ({
    i, tanSuat: r.reduce((a, b) => a + b, 0),
    trongSo: r.reduce((a, c, k) => a + c * ((k + 0.5) * BUOC_V) ** 2, 0),
  })).sort((a, b) => b.trongSo - a.trongSo);
}

/** Phân bố tích luỹ bù theo hướng: P(V > x, hướng) với x = k·BUOC_V (mảng SO_DAI_V + 1 phần tử). */
export function vuotTheoHuong(p: PhanBoGio): number[][] {
  return p.f.map((r) => {
    const c = new Array(SO_DAI_V + 1).fill(0);
    for (let k = SO_DAI_V - 1; k >= 0; k--) c[k] = c[k + 1] + r[k];
    return c;
  });
}
/** P(V > x) nội suy tuyến tính trong dải (mẫu đều trong dải). */
export function pVuot(c: number[], x: number): number {
  if (x <= 0) return c[0];
  const k = x / BUOC_V, i = Math.floor(k);
  if (i >= SO_DAI_V) return 0;
  const a = c[i], b = c[i + 1];
  return a + (b - a) * (k - i);
}

/** Hệ số đổi gió 10 m (khí tượng, địa hình trống) → 1,5 m đầu gió trong đô thị: luỹ thừa (1,5 / 10)^α, α tạm 0,22 (ngoại ô). */
export const heSoCaoDiBo = (alpha = 0.22, zDiBo = 1.5) => Math.pow(zDiBo / 10, alpha);

export const NGUONG_LAWSON = [4, 6, 8, 10];
export type LopTienNghi = 0 | 1 | 2 | 3 | 4;
/**
 * Lớp tiện nghi của một điểm: 0 ngồi lâu · 1 đứng · 2 dạo bộ · 3 đi nhanh · 4 không tiện nghi. `kHuong[h]` = hệ số tăng tốc cục bộ
 * (tốc độ điểm / tốc độ đầu gió cùng cao độ) khi gió thổi từ hướng h (NaN = trong khối). `vuot` = `vuotTheoHuong`, `heSoCao` = 10 m → 1,5 m.
 * Trả thêm xác suất vượt 15 m/s (an toàn, giá trị tạm).
 */
export function lopTienNghi(kHuong: ArrayLike<number>, vuot: number[][], heSoCao: number, phanTram = 0.05): { lop: LopTienNghi; pAnToan: number } {
  const p = (T: number) => {
    let s = 0;
    for (let h = 0; h < SO_HUONG; h++) {
      const k = kHuong[h] * heSoCao;
      if (!(k > 1e-6)) continue;
      s += pVuot(vuot[h], T / k);
    }
    return s;
  };
  let lop: LopTienNghi = 4;
  for (let i = 0; i < NGUONG_LAWSON.length; i++) if (p(NGUONG_LAWSON[i]) <= phanTram) { lop = i as LopTienNghi; break; }
  return { lop, pAnToan: p(15) };
}
